import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigurationService } from '../../../core/services/configuration.service';
import type {
  CreateScanRequest,
  Finding,
  ScanDetail,
  ScanDiff,
  ScanSummary
} from '@core/models';

@Injectable({ providedIn: 'root' })
export class ScansApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(ConfigurationService).apiBase;

  listScans = (): Promise<ScanSummary[]> =>
    firstValueFrom(this.http.get<ScanSummary[]>(`${this.base}/scans`));

  getScan = (id: string): Promise<ScanDetail> =>
    firstValueFrom(this.http.get<ScanDetail>(`${this.base}/scans/${id}`));

  getFindings = (id: string): Promise<Finding[]> =>
    firstValueFrom(this.http.get<Finding[]>(`${this.base}/scans/${id}/findings`));

  createScan = (body: CreateScanRequest): Promise<{ scan_id: string }> =>
    firstValueFrom(this.http.post<{ scan_id: string }>(`${this.base}/scans`, body));

  patchFinding = (
    scanId: string,
    findingId: string,
    body: { excluded: boolean }
  ): Promise<Finding> =>
    firstValueFrom(
      this.http.patch<Finding>(`${this.base}/scans/${scanId}/findings/${findingId}`, body)
    );

  submitScan = (id: string): Promise<{ approval_id: string }> =>
    firstValueFrom(this.http.post<{ approval_id: string }>(`${this.base}/scans/${id}/submit`, {}));

  cancelScan = (id: string): Promise<void> =>
    firstValueFrom(this.http.post<void>(`${this.base}/scans/${id}/cancel`, {}));

  getAppScans = (appId: string): Promise<ScanSummary[]> =>
    firstValueFrom(this.http.get<ScanSummary[]>(`${this.base}/apps/${appId}/scans`));

  getAppDiff = (appId: string, from: string, to: string): Promise<ScanDiff> =>
    firstValueFrom(
      this.http.get<ScanDiff>(`${this.base}/apps/${appId}/diff?from=${from}&to=${to}`)
    );
}
