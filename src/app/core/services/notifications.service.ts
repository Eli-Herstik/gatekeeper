import { Injectable, computed, inject, signal } from '@angular/core';
import { SseService } from '@lib/sse.service';
import type { ScanEvent } from '@core/models';

export interface NotificationItem {
  id: string;
  scan_id?: string;
  title: string;
  body: string;
  created_at: number;
  read: boolean;
}

/**
 * Root-level notifications service. Lives for the lifetime of the app, not
 * the route, so notifications persist across navigations.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly sse = inject(SseService);

  private readonly _items = signal<NotificationItem[]>([]);
  readonly items = this._items.asReadonly();
  readonly unreadCount = computed(() => this._items().filter((n) => !n.read).length);

  private connection: ReturnType<SseService['open']> | null = null;

  start(apiBase: string) {
    if (this.connection) return;
    this.connection = this.sse.open(`${apiBase}/notifications`);
    this.connection.events$.subscribe({
      next: (evt) => this.onEvent(evt),
      error: () => {/* SSE auto-reconnects; no-op */}
    });
  }

  stop() {
    this.connection?.close();
    this.connection = null;
  }

  markAllRead() {
    this._items.update((list) => list.map((n) => ({ ...n, read: true })));
  }

  push(item: Omit<NotificationItem, 'id' | 'created_at' | 'read'>) {
    this._items.update((list) => [
      { id: crypto.randomUUID(), created_at: Date.now(), read: false, ...item },
      ...list
    ]);
  }

  private onEvent(evt: ScanEvent) {
    if (evt.type === 'scan_completed') {
      this.push({
        scan_id: evt.scan_id,
        title: 'Scan completed',
        body: `Scan ${evt.scan_id} finished`
      });
    } else if (evt.type === 'scan_failed') {
      this.push({
        scan_id: evt.scan_id,
        title: 'Scan failed',
        body: `Scan ${evt.scan_id} failed`
      });
    }
  }
}
