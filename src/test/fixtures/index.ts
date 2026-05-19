import type {
  Finding,
  ScanDetail,
  ScanEvent,
  ScanSummary,
  AuthMethod,
  Severity
} from '@core/models';

export const APP_NAMES: Record<string, string> = {
  app_payroll: 'Payroll v3',
  app_legacy_erp: 'Legacy ERP shim',
  app_internal_tools: 'Internal Tools',
  app_finops: 'FinOps dashboard',
  app_megaportal: 'Megaportal'
};

const HOSTS = [
  'auth.contoso.com',
  'api.contoso.com',
  'reports.contoso.com',
  'analytics.contoso.com',
  'cdn.contoso.com',
  'data.contoso.com',
  'sso.partner.com',
  'graph.microsoft.com',
  'login.microsoftonline.com',
  'metrics.contoso.com',
  'logs.contoso.com',
  'mail.contoso.com',
  'queue.internal',
  'search.contoso.com',
  'feature-flags.contoso.com'
];

const AUTH_ROTATION: AuthMethod[] = [
  'oauth2', 'bearer', 'basic', 'kerberos', 'mtls', 'unauthenticated'
];

let findingId = 0;
const newFindingId = () => `f_${(++findingId).toString().padStart(5, '0')}`;

function makeFinding(host: string, auth: AuthMethod, severity: Severity, idx: number): Finding {
  return {
    id: newFindingId(),
    host,
    auth_method: auth,
    severity,
    request_count: Math.floor(Math.random() * 80) + 1,
    first_seen_on_page: idx % 2 === 0 ? '/dashboard' : `/reports/${1990 + idx}`,
    evidence: {
      headers_snippet:
        auth === 'ntlm'
          ? 'WWW-Authenticate: Negotiate, NTLM\nWWW-Authenticate: NTLM TlRMTVNTUAAB...'
          : auth === 'oauth2'
          ? 'Authorization: Bearer eyJhbGciOiJSUzI1NiIs...\nWWW-Authenticate: Bearer realm="contoso", error="invalid_token"'
          : auth === 'basic'
          ? 'WWW-Authenticate: Basic realm="contoso"'
          : auth === 'mtls'
          ? 'TLS Client-Cert subject=CN=app01.contoso.com\n  issuer=Contoso Internal CA'
          : 'Authorization: Bearer ********\nContent-Type: application/json',
      status_code: severity === 'blocker' ? 401 : 200
    },
    excluded: false,
  };
}

// ----- Fixture 1: Clean scan -----
export const cleanScan: { scan: ScanDetail; findings: Finding[]; events: ScanEvent[] } = (() => {
  findingId = 0;
  const id = 'scn_clean_001';
  const findings: Finding[] = HOSTS.slice(0, 12).map((h, i) =>
    makeFinding(h, AUTH_ROTATION[i % AUTH_ROTATION.length]!, 'cleared', i)
  );
  const scan: ScanDetail = {
    id,
    app_id: 'app_payroll',
    url: 'https://payroll.intranet.contoso.com',
    status: 'completed',
    started_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    started_by: 'jchen',
    blocker_count: 0,
    finding_count: findings.length,
    duration_ms: 134_000,
    pages_crawled: 22,
    external_hosts: 12,
    auth_methods_identified: 5,
  };
  return { scan, findings, events: scriptEvents(scan, findings, false) };
})();

// ----- Fixture 2: Blocked scan -----
export const blockedScan: { scan: ScanDetail; findings: Finding[]; events: ScanEvent[] } = (() => {
  findingId = 0;
  const id = 'scn_blocked_002';
  const blockers: Finding[] = [
    makeFinding('auth.contoso.com', 'ntlm', 'blocker', 0),
    makeFinding('legacy-erp.contoso.com', 'ntlm', 'blocker', 1)
  ];
  const reviews: Finding[] = HOSTS.slice(2, 7).map((h, i) =>
    makeFinding(h, i % 2 === 0 ? 'basic' : 'unauthenticated', 'review', i + 2)
  );
  const cleared: Finding[] = HOSTS.slice(7, 15).map((h, i) =>
    makeFinding(h, AUTH_ROTATION[i % AUTH_ROTATION.length]!, 'cleared', i + 7)
  );
  const findings = [...blockers, ...reviews, ...cleared];
  const scan: ScanDetail = {
    id,
    app_id: 'app_legacy_erp',
    url: 'https://legacy-erp.contoso.com',
    status: 'completed',
    started_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 56).toISOString(),
    started_by: 'kpatel',
    blocker_count: 2,
    finding_count: findings.length,
    duration_ms: 224_000,
    pages_crawled: 41,
    external_hosts: 15,
    auth_methods_identified: 6,
  };
  return { scan, findings, events: scriptEvents(scan, findings, false) };
})();

// ----- Fixture 3: Running scan -----
export const runningScan: { scan: ScanDetail; findings: Finding[]; events: ScanEvent[] } = (() => {
  findingId = 0;
  const id = 'scn_running_003';
  const findings: Finding[] = HOSTS.slice(0, 6).map((h, i) =>
    makeFinding(h, i === 0 ? 'ntlm' : AUTH_ROTATION[i % AUTH_ROTATION.length]!, i === 0 ? 'blocker' : 'review', i)
  );
  const scan: ScanDetail = {
    id,
    app_id: 'app_internal_tools',
    url: 'https://tools.staging.contoso.com',
    status: 'running',
    started_at: new Date(Date.now() - 1000 * 12).toISOString(),
    started_by: 'mhaskins',
    blocker_count: 1,
    finding_count: findings.length,
    pages_crawled: 8,
    external_hosts: 6,
    auth_methods_identified: 4,
  };
  return { scan, findings, events: scriptRunningEvents(scan, findings) };
})();

// ----- Fixture 4: Failed scan -----
export const failedScan: { scan: ScanDetail; findings: Finding[]; events: ScanEvent[] } = (() => {
  findingId = 0;
  const id = 'scn_failed_004';
  const findings: Finding[] = HOSTS.slice(0, 3).map((h, i) =>
    makeFinding(h, AUTH_ROTATION[i % AUTH_ROTATION.length]!, 'cleared', i)
  );
  const scan: ScanDetail = {
    id,
    app_id: 'app_finops',
    url: 'https://finops.intranet.contoso.com',
    status: 'failed',
    started_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    started_by: 'rjones',
    blocker_count: 0,
    finding_count: findings.length,
    duration_ms: 96_000,
    pages_crawled: 4,
    external_hosts: 3,
    auth_methods_identified: 2,
  };
  const events = scriptEvents(scan, findings, true).slice(0, 30);
  events.push(makeEvent(scan.id, '30', 'scan_failed', { error: 'TLS handshake failed: contoso-root-ca expired' }));
  return { scan, findings, events };
})();

// ----- Fixture 5: Massive scan -----
export const massiveScan: { scan: ScanDetail; findings: Finding[]; events: ScanEvent[] } = (() => {
  findingId = 0;
  const id = 'scn_massive_005';
  const findings: Finding[] = [];
  for (let i = 0; i < 5000; i++) {
    const host = `service-${i.toString().padStart(4, '0')}.contoso.com`;
    const sev: Severity =
      i % 250 === 0 ? 'blocker' : i % 7 === 0 ? 'review' : 'cleared';
    const auth: AuthMethod =
      sev === 'blocker'
        ? 'ntlm'
        : sev === 'review'
        ? (i % 2 === 0 ? 'basic' : 'unauthenticated')
        : AUTH_ROTATION[i % AUTH_ROTATION.length]!;
    findings.push(makeFinding(host, auth, sev, i));
  }
  const scan: ScanDetail = {
    id,
    app_id: 'app_megaportal',
    url: 'https://megaportal.contoso.com',
    status: 'completed',
    started_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
    started_by: 'tanaka',
    blocker_count: findings.filter((f) => f.severity === 'blocker').length,
    finding_count: findings.length,
    duration_ms: 2_400_000,
    pages_crawled: 1300,
    external_hosts: 5000,
    auth_methods_identified: 8,
  };
  return { scan, findings, events: scriptMassiveEvents(scan, findings) };
})();

export const ALL_FIXTURES = {
  clean: cleanScan,
  blocked: blockedScan,
  running: runningScan,
  failed: failedScan,
  massive: massiveScan
} as const;

export type FixtureKey = keyof typeof ALL_FIXTURES;

export function makeEvent(
  scanId: string,
  seq: string,
  type: ScanEvent['type'],
  payload: Record<string, unknown>,
  ts?: number
): ScanEvent {
  return { scan_id: scanId, seq, ts: ts ?? Date.now(), type, payload };
}

function scriptEvents(scan: ScanDetail, findings: Finding[], stopShort: boolean): ScanEvent[] {
  const events: ScanEvent[] = [];
  let seq = 0;
  const t0 = new Date(scan.started_at).getTime();
  events.push(makeEvent(scan.id, String(seq++), 'scan_started', { url: scan.url }, t0));

  let pages = 0;
  let hosts = 0;
  let blockers = 0;
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i]!;
    const t = t0 + 500 + i * 600;
    pages++;
    events.push(
      makeEvent(scan.id, String(seq++), 'page_visited', { path: f.first_seen_on_page, depth: 1 + (i % 3) }, t)
    );
    hosts++;
    events.push(
      makeEvent(scan.id, String(seq++), 'external_host_seen', { host: f.host }, t + 50)
    );
    events.push(
      makeEvent(scan.id, String(seq++), 'request_observed', {
        host: f.host,
        method: 'GET',
        path: '/api/' + f.host.split('.')[0],
        status: f.evidence.status_code
      }, t + 100)
    );
    events.push(
      makeEvent(scan.id, String(seq++), 'auth_detected', {
        host: f.host,
        method: f.auth_method,
      }, t + 150)
    );
    if (f.severity === 'blocker') {
      blockers++;
      events.push(
        makeEvent(scan.id, String(seq++), 'blocker_found', {
          host: f.host,
          reason: `${f.auth_method} — disallowed auth method`
        }, t + 200)
      );
    }
    if (i % 4 === 0) {
      events.push(
        makeEvent(scan.id, String(seq++), 'scan_progress', { pages, hosts, blockers }, t + 250)
      );
    }
  }
  if (!stopShort) {
    events.push(
      makeEvent(
        scan.id,
        String(seq),
        'scan_completed',
        {
          duration_ms: scan.duration_ms ?? 0,
          findings: findings.length,
          blockers
        },
        new Date(scan.completed_at ?? scan.started_at).getTime()
      )
    );
  }
  return events;
}

function scriptRunningEvents(scan: ScanDetail, findings: Finding[]): ScanEvent[] {
  // Pre-populated head so the live feed has *some* history when the user opens.
  // The MSW handler will push additional scripted events over ~60s when streaming.
  return scriptEvents({ ...scan, status: 'completed' }, findings, true);
}

function scriptMassiveEvents(scan: ScanDetail, findings: Finding[]): ScanEvent[] {
  const events: ScanEvent[] = [];
  let seq = 0;
  const t0 = new Date(scan.started_at).getTime();
  events.push(makeEvent(scan.id, String(seq++), 'scan_started', { url: scan.url }, t0));
  // Simulate 8000 events: not every finding emits, but many do.
  for (let i = 0; i < 8000; i++) {
    const f = findings[i % findings.length]!;
    const t = t0 + i * 250;
    const r = i % 5;
    if (r === 0)
      events.push(makeEvent(scan.id, String(seq++), 'page_visited', { path: f.first_seen_on_page, depth: i % 4 }, t));
    else if (r === 1)
      events.push(makeEvent(scan.id, String(seq++), 'external_host_seen', { host: f.host }, t));
    else if (r === 2)
      events.push(
        makeEvent(scan.id, String(seq++), 'request_observed', { host: f.host, method: 'GET', status: 200 }, t)
      );
    else if (r === 3)
      events.push(
        makeEvent(scan.id, String(seq++), 'auth_detected', { host: f.host, method: f.auth_method }, t)
      );
    else
      events.push(makeEvent(scan.id, String(seq++), 'scan_progress', { pages: i, hosts: i / 2, blockers: 20 }, t));
  }
  events.push(
    makeEvent(scan.id, String(seq), 'scan_completed', { duration_ms: scan.duration_ms, findings: findings.length, blockers: scan.blocker_count }, new Date(scan.completed_at!).getTime())
  );
  return events;
}

export function fixtureSummaries(): ScanSummary[] {
  return [
    summary(blockedScan.scan),
    summary(runningScan.scan),
    summary(cleanScan.scan),
    summary(failedScan.scan),
    summary(massiveScan.scan)
  ];
}

function summary(s: ScanDetail): ScanSummary {
  return {
    id: s.id,
    app_id: s.app_id,
    url: s.url,
    status: s.status,
    started_at: s.started_at,
    completed_at: s.completed_at,
    started_by: s.started_by,
    blocker_count: s.blocker_count,
    finding_count: s.finding_count
  };
}
