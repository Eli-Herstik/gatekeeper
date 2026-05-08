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
