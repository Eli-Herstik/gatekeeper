import { Injectable, computed, inject, signal } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';

export interface CurrentUser {
  username: string;
  display_name: string;
  email: string;
}

interface KeycloakClaims {
  sub?: string;
  preferred_username?: string;
  name?: string;
  email?: string;
}

interface AccessTokenClaims {
  realm_access?: { roles?: string[] };
}

const ADMIN_ROLE = 'gatekeeper-admin';

function decodeJwt<T>(token: string | null | undefined): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded)) as T;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly oauthService = inject(OAuthService);
  private readonly tokenVersion = signal(0);

  readonly currentUser = computed<CurrentUser | null>(() => {
    this.tokenVersion();
    const claims = this.oauthService.getIdentityClaims() as KeycloakClaims | null;
    if (!claims) return null;
    return {
      username: claims.preferred_username ?? claims.sub ?? '',
      display_name: claims.name ?? claims.preferred_username ?? '',
      email: claims.email ?? ''
    };
  });

  readonly isAuthenticated = computed(() => {
    this.tokenVersion();
    return this.oauthService.hasValidAccessToken() && this.oauthService.hasValidIdToken();
  });

  readonly isAdmin = computed(() => {
    this.tokenVersion();
    const claims = decodeJwt<AccessTokenClaims>(this.oauthService.getAccessToken());
    const roles = claims?.realm_access?.roles;
    return Array.isArray(roles) && roles.includes(ADMIN_ROLE);
  });

  constructor() {
    this.oauthService.events.subscribe(() => {
      this.tokenVersion.update((n) => n + 1);
    });
  }

  login(targetUrl?: string): void {
    this.oauthService.initLoginFlow(targetUrl);
  }

  logout(): void {
    this.oauthService.logOut();
  }
}
