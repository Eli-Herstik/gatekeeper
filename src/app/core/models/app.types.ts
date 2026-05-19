import type { ScanStatus } from './scan.types';

export type ExposureState =
  | 'never_scanned'
  | 'scan_in_progress'
  | 'blocked'
  | 'ready'
  | 'failed';

export interface AppSummary {
  id: string;
  name: string;
  url: string;
  owner: string;
  exposure_state: ExposureState;
  last_scan_id?: string;
  last_scan_status?: ScanStatus;
  last_scanned_at?: string;
}

export interface CreateAppRequest {
  name: string;
  url?: string;
  owner_ad_group: string;
}
