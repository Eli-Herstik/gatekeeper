# Exposure Gatekeeper — Frontend

Internal pre-exposure scanner UI for on-prem web apps fronted by F5 Big-IP.

A developer enters the URL of their app, a backend Playwright crawler identifies every external service the app calls and the auth method it uses; if any service uses a disallowed auth method (NTLM), the app is blocked from being exposed until the auth method is changed or the service is explicitly excluded.


## Quick start

```bash
npm install
npm run msw:init
npm start         # http://localhost:4200
npm test          # Vitest
npm run test:e2e  # Playwright
```