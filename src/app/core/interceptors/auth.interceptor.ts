import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { ConfigurationService } from '../services/configuration.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const oauthService = inject(OAuthService);
  const config = inject(ConfigurationService);
  const token = oauthService.getAccessToken();
  const isApiRequest = req.url.startsWith(config.apiBase);

  if (token && isApiRequest) {
    return next(
      req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      })
    );
  }

  return next(req);
};
