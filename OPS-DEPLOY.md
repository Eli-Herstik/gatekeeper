# Air-Gapped Deployment

The Gatekeeper UI is a static SPA. After `ng build` it consists of:

```
dist/exposure-gatekeeper/browser/
  index.html
  *.js / *.css   (content-hashed, immutable)
  media/         (Inter + JetBrains Mono woff2/woff bundled at build time)
  favicon.ico
  3rdpartylicenses.txt
```

The bundle makes **no external requests at runtime**. All it needs from the network is its own backend at `/api` (and the SSE endpoint underneath it). Drop `dist/exposure-gatekeeper/browser/` behind any web server that can do SPA routing fallback and reverse-proxy `/api` to the scanner backend.

## Build

Builds normally happen on a developer or CI host with internet access:

```bash
npm ci
npm run build
# → dist/exposure-gatekeeper/browser/
```

Ship that directory to the target environment as a tarball, container image, or RPM/DEB — whatever your release process uses.

### Verify a build is internet-free

Sanity check before release:

```bash
grep -rE 'https?://[a-zA-Z]' dist/exposure-gatekeeper/browser/ \
  | grep -vE '(w3\.org|angular\.dev|app\.intranet\.contoso\.com)' \
  || echo "OK: no external runtime URLs"
```

The allowlisted matches are inert: W3C XML namespaces, Angular's security doc URL embedded in dev-mode error messages, and the placeholder string in the New Scan input field.

### Building inside the air-gapped network

Two options if the build itself must run offline:

1. **Pre-populated npm cache.** On the connected host, run `npm ci` and tar `~/.npm` (or use `npm pack` against every dep). Move the cache in. Then build with `npm ci --offline --prefer-offline`.
2. **Internal registry.** Run Verdaccio/Nexus/Artifactory inside the network and mirror the public registry. Point `.npmrc` at it (`registry=https://npm.internal/`) and `npm ci` works as usual.

Either way, the only build-time dependency on the public internet is the npm registry. Nothing in the source tree fetches at build time beyond what's in `package.json`.

## Web server

### Nginx (recommended)

```nginx
server {
  listen 443 ssl http2;
  server_name gatekeeper.intranet.example;

  ssl_certificate     /etc/ssl/certs/gatekeeper.crt;
  ssl_certificate_key /etc/ssl/private/gatekeeper.key;

  root /var/www/gatekeeper;
  index index.html;

  # Long-cache content-hashed assets, never cache index.html
  location ~* \.(js|css|woff2?|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }
  location = /index.html {
    add_header Cache-Control "no-cache, must-revalidate";
  }

  # SPA fallback — every unknown path serves index.html so the Angular router can take over
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Reverse proxy to the scanner backend
  location /api/ {
    proxy_pass http://gatekeeper-backend.internal:8080;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Required for the SSE stream used by ScanDetail. Without these the
    # browser only sees events when the buffer fills.
    proxy_buffering   off;
    proxy_cache       off;
    proxy_read_timeout 1h;
    proxy_set_header  Connection      "";
    add_header        X-Accel-Buffering no;
  }
}
```

### F5 Big-IP

Same rules apply on the F5 fronting this app:

- iRule or LTM policy that maps unknown URIs back to `/index.html`.
- For the SSE response stream, disable response chunking compression / OneConnect on that path and raise the idle timeout to ≥ 1 hour. SSE connections are long-lived; the default 5-minute idle timeout will look like spurious disconnects to users.

### Container image (optional)

Minimal `Dockerfile` if you ship as a container:

```dockerfile
# Build stage — runs on a connected host or in CI
FROM node:22-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage — pure static, no Node
FROM nginx:1.27-alpine
COPY --from=build /src/dist/exposure-gatekeeper/browser/ /usr/share/nginx/html/
COPY ops/nginx.conf /etc/nginx/conf.d/default.conf
```

Push the built image to your internal registry; pull on the air-gapped side.

## Backend expectations

The UI assumes the backend is reachable at the same origin under `/api`. Anything else (CORS-mode cross-origin, path-prefix change) requires:

- Updating `apiBase` in `src/environments/environment.ts` and rebuilding, **or**
- Configuring the reverse proxy to expose the backend at `/api` on this origin.

The auth model is session-cookie based (`AuthService` reads from a backend hydration call). Ensure the proxy preserves cookies and the backend issues them with `Secure; HttpOnly; SameSite=Lax`.

## Things to verify after first deploy

- `GET /` loads, fonts render (Inter for body, JetBrains Mono in code/log views — if you see system sans-serif everywhere, fonts didn't ship).
- New Scan flow can hit `POST /api/scans`.
- Scan Detail page receives live SSE events (no buffering — events should stream as the backend emits them, not in batches every minute).
- Hard-refresh on a deep link like `/scans/abc123` returns the app, not a 404 (SPA fallback is wired correctly).
