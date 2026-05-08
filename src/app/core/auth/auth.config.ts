import { AuthConfig } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';
import { ConfigurationService } from '../services/configuration.service';

export function buildAuthConfig(config: ConfigurationService): AuthConfig {
  const origin = window.location.origin;
  return {
    issuer: config.keycloak.issuer,
    clientId: config.keycloak.clientId,
    redirectUri: origin + '/',
    postLogoutRedirectUri: origin + '/',
    responseType: config.keycloak.responseType,
    scope: config.keycloak.scope,
    requireHttps: config.keycloak.requireHttps,
    showDebugInformation: !environment.production
  };
}
