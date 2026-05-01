import { Injectable, signal } from '@angular/core';

export interface AppError {
  status: number;
  message: string;
  url?: string;
  at: number;
}

@Injectable({ providedIn: 'root' })
export class ErrorSignalService {
  readonly forbidden = signal<AppError | null>(null);
  readonly latest = signal<AppError | null>(null);

  publish(err: AppError) {
    this.latest.set(err);
    if (err.status === 403) this.forbidden.set(err);
  }

  clearForbidden() {
    this.forbidden.set(null);
  }
}
