import type { ScanEvent, ScanEventType } from '@core/models';

export type LineType = 'VERBOSE' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface FormattedLine {
  seq: string;
  ts: number;
  tsLabel: string;
  type: LineType;
  host: string;
  message: string;
  raw: ScanEvent;
}

const TYPE_MAP: Record<ScanEventType, LineType> = {
  scan_started: 'INFO',
  scan_progress: 'INFO',
  scan_completed: 'INFO',
  scan_failed: 'CRITICAL',
  page_visited: 'VERBOSE',
  request_observed: 'VERBOSE',
  external_host_seen: 'INFO',
  auth_detected: 'INFO',
  blocker_found: 'ERROR'
};

export function formatEvent(evt: ScanEvent): FormattedLine {
  const tsLabel = formatTime(evt.ts);
  const type = TYPE_MAP[evt.type];
  const p = evt.payload as Record<string, unknown>;
  let host = '';
  let message = '';

  switch (evt.type) {
    case 'scan_started':
      message = `scan started · ${(p['url'] as string) ?? ''}`;
      break;
    case 'scan_progress':
      message = `scan progress · pages=${p['pages']} hosts=${p['hosts']} blockers=${p['blockers']}`;
      break;
    case 'scan_completed':
      message = `scan completed · ${p['findings']} findings · ${p['blockers']} blockers`;
      break;
    case 'scan_failed':
      message = `scan failed · ${(p['error'] as string) ?? 'unknown error'}`;
      break;
    case 'page_visited':
      host = (p['path'] as string) ?? '';
      message = `visited (depth ${p['depth'] ?? '?'})`;
      break;
    case 'request_observed':
      host = (p['host'] as string) ?? '';
      message = `${p['method'] ?? 'GET'} ${p['path'] ?? ''} ${p['status'] ?? ''}`.trim();
      break;
    case 'external_host_seen':
      host = (p['host'] as string) ?? '';
      message = 'first seen';
      break;
    case 'auth_detected':
      host = (p['host'] as string) ?? '';
      message = `${p['method']} detected${p['confidence'] ? ` (${p['confidence']} confidence)` : ''}`;
      break;
    case 'blocker_found':
      host = (p['host'] as string) ?? '';
      message = (p['reason'] as string) ?? 'disallowed auth method';
      break;
  }

  return { seq: evt.seq, ts: evt.ts, tsLabel, type, host, message, raw: evt };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}
