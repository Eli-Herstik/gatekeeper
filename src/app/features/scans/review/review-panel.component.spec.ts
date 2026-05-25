import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/angular';
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

const review = (id: string, host: string): Finding => ({
  id,
  host,
  auth_method: 'oauth2',
  severity: 'review',
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

interface SetupOpts {
  isLatestScan?: boolean;
  isFrozen?: boolean;
  isCompleted?: boolean;
}

function setup(findings: Finding[], opts: SetupOpts = {}) {
  return render(ReviewPanelComponent, {
    inputs: {
      scanId: 'scn_test',
      findings,
      isLatestScan: opts.isLatestScan ?? true,
      isFrozen: opts.isFrozen ?? false,
      isCompleted: opts.isCompleted ?? true
    },
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

describe('ReviewPanelComponent — non-latest scan', () => {
  it('disables Submit and explains why when the scan is not the latest', async () => {
    await setup([cleared('f1', 'a.contoso.com')], { isLatestScan: false });
    const submit = screen.getByRole('button', { name: /submit for approval/i });
    expect(submit).toBeDisabled();
    expect(
      screen.getByText(/only the latest completed scan can be submitted/i)
    ).toBeInTheDocument();
  });
});

describe('ReviewPanelComponent — non-completed scan', () => {
  it('disables Submit and explains why when the scan is not completed', async () => {
    await setup([cleared('f1', 'a.contoso.com')], { isCompleted: false });
    const submit = screen.getByRole('button', { name: /submit for approval/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/only completed scans can be submitted/i)).toBeInTheDocument();
  });
});

describe('ReviewPanelComponent — frozen scan', () => {
  it('hides the exclusion toggle buttons and disables Submit', async () => {
    // Use `review` severity so the section opens by default and would normally
    // show Exclude buttons — proving the frozen flag actually suppresses them.
    await setup([review('r1', 'a.contoso.com'), review('r2', 'b.contoso.com')], {
      isFrozen: true
    });
    const submit = screen.getByRole('button', { name: /submit for approval/i });
    expect(submit).toBeDisabled();
    expect(
      screen.getByText(/only the latest completed scan can be edited/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^exclude$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^re-include$/i })).toBeNull();
  });

  it('shows Exclude buttons normally when the scan is not frozen', async () => {
    // Sanity check: with the same fixtures but isFrozen=false the buttons appear.
    await setup([review('r1', 'a.contoso.com')], { isFrozen: false });
    expect(screen.getByRole('button', { name: /^exclude$/i })).toBeInTheDocument();
  });
});
