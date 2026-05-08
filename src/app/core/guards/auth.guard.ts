import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';

export const authGuard: CanActivateFn = (_route, state) => {
  const oauthService = inject(OAuthService);
  if (oauthService.hasValidAccessToken() && oauthService.hasValidIdToken()) {
    return true;
  }
  oauthService.initLoginFlow(state.url);
  return false;
};
