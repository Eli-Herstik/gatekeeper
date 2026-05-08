import { Injectable } from '@angular/core';

export interface KeycloakConfig {
  issuer: string;
  clientId: string;
  scope: string;
  responseType: string;
  requireHttps: boolean;
}

export interface AppConfig {
  apiBase: string;
  keycloak: KeycloakConfig;
}

@Injectable({ providedIn: 'root' })
export class ConfigurationService {
  private static config: AppConfig | null = null;

  static async load(url = '/config.json'): Promise<void> {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    ConfigurationService.config = (await response.json()) as AppConfig;
  }

  static setForTesting(config: AppConfig): void {
    ConfigurationService.config = config;
  }

  get apiBase(): string {
    return this.snapshot.apiBase;
  }

  get keycloak(): KeycloakConfig {
    return this.snapshot.keycloak;
  }

  private get snapshot(): AppConfig {
    if (!ConfigurationService.config) {
      throw new Error('ConfigurationService.load() must be called before bootstrap.');
    }
    return ConfigurationService.config;
  }
}
