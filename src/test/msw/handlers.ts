import { http, HttpResponse, delay } from 'msw';
import { ALL_FIXTURES, APP_NAMES, fixtureSummaries, makeEvent } from '../fixtures';
import type {
  AppSummary,
  CreateAppRequest,
  ExposureState,
  Finding,
  ScanDetail,
  ScanEvent,
  ScanSummary
} from '@core/models';

/**
 * In-memory state. Mutations (exclude, submit) update this so the UI reflects
 * optimistic mutations as if they hit a real server.
 */
const memo = {
  list: null as ScanSummary[] | null,
  details: new Map<string, ScanDetail>(),
  findings: new Map<string, Finding[]>(),
  events: new Map<string, ScanEvent[]>(),
  notifications: [] as { scan_id: string; type: string; ts: number }[],
  createdApps: [] as AppSummary[],
  // Sticky submission state per app: which scan was last submitted, when, and
  // by whom. Mirrors the backend's `apps.current_scan_id` + per-scan
  // `submitted_at`/`submitted_by`.
  currentScanByApp: new Map<
    string,
    { scanId: string; submittedAt: string; submittedBy: string }
  >()
};

function ensureLoaded() {
  if (memo.list) return;
  memo.list = fixtureSummaries();
  for (const key of Object.keys(ALL_FIXTURES) as (keyof typeof ALL_FIXTURES)[]) {
    const fx = ALL_FIXTURES[key];
    memo.details.set(fx.scan.id, structuredClone(fx.scan));
    memo.findings.set(fx.scan.id, structuredClone(fx.findings));
    memo.events.set(fx.scan.id, structuredClone(fx.events));
  }
}

const json = (body: unknown, init?: ResponseInit) =>
  HttpResponse.json(body as Parameters<typeof HttpResponse.json>[0], init);

export const handlers = [
  http.get('/api/scans', async () => {
    ensureLoaded();
    await delay(80);
    return json(memo.list);
  }),

  http.get('/api/scans/:id', async ({ params }) => {
    ensureLoaded();
    const id = String(params['id']);
    const s = memo.details.get(id);
    if (!s) return new HttpResponse(null, { status: 404 });
    await delay(80);
    return json(withSubmittedAt(s));
  }),

  http.get('/api/scans/:id/findings', async ({ params }) => {
    ensureLoaded();
    const id = String(params['id']);
    const f = memo.findings.get(id);
    if (!f) return new HttpResponse(null, { status: 404 });
    await delay(120);
    return json(f);
  }),

  http.patch('/api/scans/:id/findings/:findingId', async ({ params, request }) => {
    ensureLoaded();
    const id = String(params['id']);
    const fid = String(params['findingId']);
    const body = (await request.json()) as { excluded: boolean; justification?: string };
    const findings = memo.findings.get(id);
    if (!findings) return new HttpResponse(null, { status: 404 });
    if (isScanSubmitted(id)) {
      return json({ message: 'this scan is submitted and locked' }, { status: 409 });
    }
    const detail = memo.details.get(id);
    if (detail && latestScanIdForApp(detail.app_id) !== id) {
      return json(
        { message: 'only the latest completed scan can be edited' },
        { status: 409 }
      );
    }
    const idx = findings.findIndex((f) => f.id === fid);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    findings[idx] = {
      ...findings[idx]!,
      excluded: body.excluded
    };
    await delay(150);
    return json(findings[idx]);
  }),

  http.post('/api/scans', async ({ request }) => {
    ensureLoaded();
    const body = (await request.json()) as { app_id?: string };
    // Return a scan for the picked app if one exists; otherwise the blocked fixture.
    const match = body.app_id
      ? memo.list?.find((s) => s.app_id === body.app_id)
      : undefined;
    const scanId = match?.id ?? ALL_FIXTURES['blocked'].scan.id;
    await delay(150);
    return json({ scan_id: scanId });
  }),

  http.post('/api/scans/:id/submit', async ({ params }) => {
    ensureLoaded();
    const id = String(params['id']);
    const detail = memo.details.get(id);
    if (!detail) return new HttpResponse(null, { status: 404 });

    const latestForApp = latestScanIdForApp(detail.app_id);
    if (latestForApp !== id) {
      return json({ message: 'only the latest scan can be submitted' }, { status: 409 });
    }
    if (detail.status !== 'completed') {
      return json(
        { message: `scan is ${detail.status}, only completed scans can be submitted` },
        { status: 409 }
      );
    }
    if (isScanSubmitted(id)) {
      return json({ message: 'this scan has already been submitted' }, { status: 409 });
    }

    memo.currentScanByApp.set(detail.app_id, {
      scanId: id,
      submittedAt: new Date().toISOString(),
      submittedBy: 'jchen'
    });
    await delay(250);
    return json({ submission_id: 'sub_' + Math.random().toString(36).slice(2, 12) });
  }),

  http.post('/api/scans/:id/cancel', async ({ params }) => {
    ensureLoaded();
    const id = String(params['id']);
    const d = memo.details.get(id);
    if (!d) return new HttpResponse(null, { status: 404 });
    memo.details.set(id, { ...d, status: 'cancelled', completed_at: new Date().toISOString() });
    await delay(80);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/api/apps', async () => {
    ensureLoaded();
    const byApp = new Map<string, ScanSummary>();
    for (const s of memo.list!) {
      const prev = byApp.get(s.app_id);
      if (!prev || new Date(s.started_at) > new Date(prev.started_at)) {
        byApp.set(s.app_id, s);
      }
    }
    const scanned: AppSummary[] = [...byApp.values()].map((s) => {
      const current = memo.currentScanByApp.get(s.app_id);
      return {
        id: s.app_id,
        name: APP_NAMES[s.app_id] ?? s.app_id,
        url: s.url,
        owner_ad_group: s.started_by,
        exposure_state: current ? 'submitted' : deriveExposureState(s),
        last_scan_id: s.id,
        last_scan_status: s.status,
        last_scanned_at: s.started_at,
        current_scan_id: current?.scanId
      };
    });
    const unscanned: AppSummary[] = [
      {
        id: 'app_hr_portal',
        name: 'HR Portal',
        url: 'https://hr.intranet.contoso.com',
        owner_ad_group: 'lwagner',
        exposure_state: 'never_scanned'
      },
      {
        id: 'app_billing_api',
        name: 'Billing API',
        url: 'https://billing.intranet.contoso.com',
        owner_ad_group: 'svaldez',
        exposure_state: 'never_scanned'
      }
    ];
    await delay(80);
    return json([...scanned, ...unscanned, ...memo.createdApps]);
  }),

  http.post('/api/apps', async ({ request }) => {
    ensureLoaded();
    const body = (await request.json()) as CreateAppRequest;
    const name = body.name?.trim();
    const ownerAdGroup = body.owner_ad_group?.trim();
    if (!name || !ownerAdGroup) {
      return json({ error: 'name and owner_ad_group are required' }, { status: 400 });
    }
    const app: AppSummary = {
      id: 'app_' + Math.random().toString(36).slice(2, 10),
      name,
      url: body.url?.trim() || undefined,
      owner_ad_group: ownerAdGroup,
      exposure_state: 'never_scanned'
    };
    memo.createdApps.push(app);
    await delay(120);
    return json(app, { status: 201 });
  }),

  http.get('/api/apps/:appId/scans', async ({ params }) => {
    ensureLoaded();
    const appId = String(params['appId']);
    const list = (memo.list ?? []).filter((s) => s.app_id === appId);
    if (list.length === 0) {
      // Synthesize variants so the screen has data even for unknown ids.
      const seed = memo.list![0]!;
      const synth = Array.from({ length: 4 }).map((_, i) => ({
        ...seed,
        id: `${appId}_scn_${i}`,
        app_id: appId,
        started_at: new Date(Date.now() - i * 1000 * 60 * 60 * 24).toISOString(),
        blocker_count: i === 0 ? 0 : i,
        finding_count: 12 - i
      }));
      await delay(80);
      return json(synth.map(withSubmittedAt));
    }
    await delay(80);
    return json(list.map(withSubmittedAt));
  }),

  http.get('/api/apps/:appId/diff', async ({ request }) => {
    ensureLoaded();
    const url = new URL(request.url);
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    const fromFindings = memo.findings.get(from) ?? [];
    const toFindings = memo.findings.get(to) ?? [];
    const byHost = (xs: Finding[]) => new Map(xs.map((f) => [f.host, f]));
    const A = byHost(fromFindings);
    const B = byHost(toFindings);
    const added = [...B.values()].filter((f) => !A.has(f.host));
    const removed = [...A.values()].filter((f) => !B.has(f.host));
    const exclusion_changes: { id: string; host: string; before: boolean; after: boolean }[] = [];
    const auth_method_changes: { id: string; host: string; before: Finding['auth_method']; after: Finding['auth_method'] }[] = [];
    for (const [host, b] of B) {
      const a = A.get(host);
      if (!a) continue;
      if (a.excluded !== b.excluded)
        exclusion_changes.push({ id: b.id, host, before: a.excluded, after: b.excluded });
      if (a.auth_method !== b.auth_method)
        auth_method_changes.push({ id: b.id, host, before: a.auth_method, after: b.auth_method });
    }
    await delay(120);
    return json({
      from_scan_id: from,
      to_scan_id: to,
      added,
      removed,
      exclusion_changes,
      auth_method_changes
    });
  }),

  // SSE: replay the full event log honoring Last-Event-ID.
  http.get('/api/scans/:id/events', ({ params, request }) => {
    ensureLoaded();
    const id = String(params['id']);
    const events = memo.events.get(id) ?? [];
    const lastId = request.headers.get('Last-Event-ID');
    const startSeq = lastId ? parseInt(lastId, 10) + 1 : 0;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder();
        // Replay history.
        for (const e of events.filter((ev) => parseInt(ev.seq, 10) >= startSeq)) {
          controller.enqueue(enc.encode(formatSse(e)));
          await delay(0);
        }

        // For a *running* fixture, schedule additional scripted events over ~60s.
        const detail = memo.details.get(id);
        if (detail?.status === 'running') {
          await streamRunning(controller, enc, id);
        }

        controller.close();
      }
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    });
  }),

  // Notifications channel (always open).
  http.get('/api/notifications', () => {
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Heartbeat-only stream for the demo.
        const enc = new TextEncoder();
        controller.enqueue(enc.encode(': hello\n\n'));
      }
    });
    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });
  })
];

function deriveExposureState(s: ScanSummary): ExposureState {
  switch (s.status) {
    case 'queued':
    case 'running':
      return 'never_scanned';
    case 'failed':
    case 'cancelled':
      return 'failed';
    case 'completed':
      return s.blocker_count > 0 ? 'blocked' : 'ready_for_submission';
  }
}

function isScanSubmitted(scanId: string): boolean {
  for (const v of memo.currentScanByApp.values()) {
    if (v.scanId === scanId) return true;
  }
  return false;
}

function latestScanIdForApp(appId: string): string | undefined {
  // Match backend: latest *completed* scan. Failed/cancelled/running/queued
  // scans are ignored — they shouldn't shadow an earlier valid completed scan.
  const scans = (memo.list ?? []).filter(
    (s) => s.app_id === appId && s.status === 'completed'
  );
  if (scans.length === 0) return undefined;
  return scans.reduce((a, b) =>
    new Date(a.started_at) >= new Date(b.started_at) ? a : b
  ).id;
}

function withSubmittedAt<T extends ScanSummary>(s: T): T {
  const current = memo.currentScanByApp.get(s.app_id);
  if (current && current.scanId === s.id) {
    return { ...s, submitted_at: current.submittedAt, submitted_by: current.submittedBy };
  }
  return s;
}

function formatSse(event: ScanEvent): string {
  return `id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`;
}

async function streamRunning(
  controller: ReadableStreamDefaultController<Uint8Array>,
  enc: TextEncoder,
  scanId: string
) {
  const detail = memo.details.get(scanId)!;
  const findings = memo.findings.get(scanId) ?? [];
  let seq = (memo.events.get(scanId) ?? []).length;

  const emit = (e: ScanEvent) => {
    memo.events.get(scanId)!.push(e);
    controller.enqueue(enc.encode(formatSse(e)));
  };

  // ~200 events over 60s, ~3 events / sec.
  const total = 200;
  const interval = 60_000 / total;
  let pages = 8;
  let hosts = 6;
  const blockers = 1;

  for (let i = 0; i < total; i++) {
    await delay(interval);
    const f = findings[i % findings.length]!;
    const t = Date.now();
    const r = i % 5;
    if (r === 0) {
      pages++;
      emit(makeEvent(scanId, String(seq++), 'page_visited', { path: f.first_seen_on_page, depth: 1 + (i % 4) }, t));
    } else if (r === 1) {
      hosts++;
      emit(makeEvent(scanId, String(seq++), 'external_host_seen', { host: f.host }, t));
    } else if (r === 2) {
      emit(makeEvent(scanId, String(seq++), 'request_observed', { host: f.host, method: 'GET', status: 200 }, t));
    } else if (r === 3) {
      emit(makeEvent(scanId, String(seq++), 'auth_detected', { host: f.host, method: f.auth_method, confidence: 'high' }, t));
    } else {
      emit(makeEvent(scanId, String(seq++), 'scan_progress', { pages, hosts, blockers }, t));
    }
  }
  detail.status = 'completed';
  detail.completed_at = new Date().toISOString();
  detail.duration_ms = Date.now() - new Date(detail.started_at).getTime();
  emit(
    makeEvent(scanId, String(seq), 'scan_completed', {
      duration_ms: detail.duration_ms,
      findings: findings.length,
      blockers
    })
  );
}
