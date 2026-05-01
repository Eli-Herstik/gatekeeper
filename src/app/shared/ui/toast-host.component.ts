import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[360px]" aria-live="polite">
      @for (t of toasts.stack(); track t.id) {
        <div
          class="border rounded-md bg-surface p-3 shadow-lg flex items-start gap-3"
          [class.border-success]="t.kind === 'success'"
          [class.border-danger]="t.kind === 'error'"
          [class.border-border]="t.kind === 'info'">
          <span
            class="sev-dot mt-1.5"
            [style.background]="
              t.kind === 'success' ? 'var(--color-success)' :
              t.kind === 'error' ? 'var(--color-danger)' : 'var(--color-info)'
            "></span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-fg">{{ t.title }}</div>
            @if (t.body) {
              <div class="text-xs text-fg-muted mt-0.5">{{ t.body }}</div>
            }
          </div>
          <button
            class="text-fg-subtle hover:text-fg text-xs"
            type="button"
            (click)="toasts.dismiss(t.id)"
            aria-label="Dismiss">
            ✕
          </button>
        </div>
      }
    </div>
  `
})
export class ToastHostComponent {
  readonly toasts = inject(ToastService);
}
