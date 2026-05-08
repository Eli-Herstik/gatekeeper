import 'zone.js';
import 'zone.js/testing';
import '@testing-library/jest-dom/vitest';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { beforeEach } from 'vitest';
import { ConfigurationService } from '../app/core/services/configuration.service';

const g = globalThis as { __angular_testbed_initialized__?: boolean };
if (!g.__angular_testbed_initialized__) {
  g.__angular_testbed_initialized__ = true;
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
    teardown: { destroyAfterEach: true }
  });
}

ConfigurationService.setForTesting({
  apiBase: '/api',
  keycloak: {
    issuer: 'https://psso/realms/oauth',
    clientId: 'test-client',
    scope: 'openid profile email',
    responseType: 'code',
    requireHttps: false
  }
});

beforeEach(() => {
  TestBed.resetTestingModule();
});
