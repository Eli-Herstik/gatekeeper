import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { ReviewPanelComponent } from './review-panel.component';
import type { Finding } from '@core/models';

const cleared = (id: string, host: string): Finding => ({
  id,
  host,
  auth_method: 'oauth2',
  severity: 'cleared',
  request_count: 1,
  first_seen_on_page: '/',
  evidence: { headers_snippet: '', status_code: 200 },
  excluded: false
});

const blocker = (id: string, host: string, excluded = false): Finding => ({
  id,
  host,
  auth_method: 'ntlm',
  severity: 'blocker',
  request_count: 1,
  first_seen_on_page: '/',
  evidence: { headers_snippet: '', status_code: 401 },
  excluded
});

function setup(findings: Finding[]) {
  return render(ReviewPanelComponent, {
    inputs: { scanId: 'scn_test', findings },
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideTanStackQuery(new QueryClient())
    ]
  });
}

// Acceptance test #4:
//   "Submit is enabled by default when there are no blockers."
describe('ReviewPanelComponent — no blockers', () => {
  it('enables Submit by default since findings are included by default', async () => {
    await setup([cleared('f1', 'a.contoso.com'), cleared('f2', 'b.contoso.com')]);
    const submit = screen.getByRole('button', { name: /submit for approval/i });
    expect(submit).not.toBeDisabled();
  });
});

// Acceptance test #5:
//   "With blockers, Submit is disabled until every blocker is excluded."
describe('ReviewPanelComponent — blockers present', () => {
  it('disables Submit while any blocker is unexcluded', async () => {
    await setup([blocker('b1', 'auth.contoso.com'), cleared('c1', 'cdn.contoso.com')]);
    const submit = screen.getByRole('button', { name: /submit for approval/i });
    expect(submit).toBeDisabled();
    expect(
      screen.getByText(/blocker must be excluded or remediated before submitting/i)
    ).toBeInTheDocument();
  });
});
