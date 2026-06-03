import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { NewScanComponent } from './new-scan.component';
import { ScansApi } from '../data/scans.api';

// Acceptance test #1:
//   "Submitting the New Scan form without picking an app shows an inline error
//    and does not call the API." The scan now targets the app's own URL, so the
//    form no longer collects a URL — the app selection is the required input.
describe('NewScanComponent', () => {
  it('blocks submit and shows an inline error when no app is picked', async () => {
    const createScan = vi.fn();
    const apiStub: Partial<ScansApi> = {
      listScans: vi.fn().mockResolvedValue([]),
      listApps: vi.fn().mockResolvedValue([]),
      createScan
    };

    const view = await render(NewScanComponent, {
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideTanStackQuery(new QueryClient()),
        { provide: ScansApi, useValue: apiStub }
      ]
    });
    const cmp = view.fixture.componentInstance;

    cmp.submit();
    view.detectChanges();

    expect(screen.getByText(/pick an app first/i)).toBeInTheDocument();
    expect(createScan).not.toHaveBeenCalled();
  });
});
