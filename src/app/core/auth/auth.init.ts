import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { buildAuthConfig } from './auth.config';
import { ConfigurationService } from '../services/configuration.service';

export async function initializeOAuth(): Promise<void> {
  const oauthService = inject(OAuthService);
  const config = inject(ConfigurationService);
  oauthService.configure(buildAuthConfig(config));
  oauthService.setupAutomaticSilentRefresh();
  try {
    await oauthService.loadDiscoveryDocumentAndTryLogin();
  } catch {
    // Discovery failure is non-fatal at boot — the auth guard will trigger a
    // login attempt when a protected route is reached, surfacing the real error.
  }
}
