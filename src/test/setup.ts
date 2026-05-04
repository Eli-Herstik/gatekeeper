import 'zone.js';
import 'zone.js/testing';
import '@testing-library/jest-dom/vitest';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { beforeEach } from 'vitest';

const g = globalThis as { __angular_testbed_initialized__?: boolean };
if (!g.__angular_testbed_initialized__) {
  g.__angular_testbed_initialized__ = true;
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
    teardown: { destroyAfterEach: true }
  });
}

beforeEach(() => {
  TestBed.resetTestingModule();
});
