export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type AuthMethod =
  | 'ntlm'
  | 'negotiate'
  | 'kerberos'
  | 'oauth2'
  | 'basic'
  | 'bearer'
  | 'mtls'
  | 'unauthenticated'
  | 'unknown';

export type Severity = 'blocker' | 'review' | 'cleared';

export interface FindingEvidence {
  headers_snippet: string;
  status_code: number;
}

export interface Finding {
  id: string;
  host: string;
  auth_method: AuthMethod;
  severity: Severity;
  request_count: number;
  first_seen_on_page: string;
  evidence: FindingEvidence;
  excluded: boolean;
}

export interface ScanSummary {
  id: string;
  app_id: string;
  url: string;
  status: ScanStatus;
  started_at: string;
  completed_at?: string;
  started_by: string;
  blocker_count: number;
  finding_count: number;
  submitted_at?: string;
  submitted_by?: string;
}

export interface ScanDetail extends ScanSummary {
  duration_ms?: number;
  pages_crawled?: number;
  external_hosts?: number;
  auth_methods_identified?: number;
}

export type ScanEventType =
  | 'scan_started'
  | 'page_visited'
  | 'request_observed'
  | 'external_host_seen'
  | 'auth_detected'
  | 'blocker_found'
  | 'scan_progress'
  | 'scan_completed'
  | 'scan_failed';

export interface ScanEvent {
  scan_id: string;
  seq: string;
  ts: number;
  type: ScanEventType;
  payload: Record<string, unknown>;
}

export interface ScanDiff {
  from_scan_id: string;
  to_scan_id: string;
  added: Finding[];
  removed: Finding[];
  exclusion_changes: { id: string; host: string; before: boolean; after: boolean }[];
  auth_method_changes: { id: string; host: string; before: AuthMethod; after: AuthMethod }[];
}

export interface CreateScanRequest {
  app_id: string;
  max_depth?: number;
  password: string;
}
