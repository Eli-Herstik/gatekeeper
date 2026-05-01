import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  kind: 'info' | 'success' | 'error';
  title: string;
  body?: string;
  ttl_ms: number;
}

/**
 * Lightweight toast bridge — spartan-ng / ngx-sonner can be wired in front of
 * this in the shell. Keeping our own signal lets components emit without a
 * direct dependency on sonner.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly stack = signal<Toast[]>([]);

  show(t: Omit<Toast, 'id'>) {
    const id = crypto.randomUUID();
    const item: Toast = { id, ...t };
    this.stack.update((s) => [item, ...s].slice(0, 8));
    setTimeout(() => this.dismiss(id), item.ttl_ms);
  }

  dismiss(id: string) {
    this.stack.update((s) => s.filter((t) => t.id !== id));
  }

  info(title: string, body?: string) {
    this.show({ kind: 'info', title, body, ttl_ms: 4000 });
  }
  success(title: string, body?: string) {
    this.show({ kind: 'success', title, body, ttl_ms: 4000 });
  }
  error(title: string, body?: string) {
    this.show({ kind: 'error', title, body, ttl_ms: 6000 });
  }
}
