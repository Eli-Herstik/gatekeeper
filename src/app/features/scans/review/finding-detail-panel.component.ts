import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { AuthPillComponent } from '@shared/components/auth-pill.component';
import { ButtonComponent } from '@shared/ui/button.component';
import { redact } from '@lib/redact';
import type { Finding } from '@core/models';

@Component({
  selector: 'app-finding-detail-panel',
  standalone: true,
  imports: [LucideAngularModule, AuthPillComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (finding(); as f) {
      <aside
        class="fixed top-0 right-0 bottom-0 w-[480px] bg-surface border-l border-border shadow-2xl z-40 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finding-detail-title">
        <header class="h-12 px-4 border-b border-border flex items-center justify-between">
          <h2 id="finding-detail-title" class="text-sm font-medium font-mono">{{ f.host }}</h2>
          <button
            type="button"
            class="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-surface-2"
            (click)="closePanel.emit()"
            aria-label="Close">
            <lucide-icon [name]="icons.X" [size]="14"></lucide-icon>
          </button>
        </header>
        <div class="flex-1 overflow-y-auto thin-scroll p-4 space-y-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-fg-muted mb-1">Auth method</p>
            <div class="flex items-center gap-2">
              <app-auth-pill [method]="f.auth_method"></app-auth-pill>
            </div>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-fg-muted mb-1">First seen on page</p>
            <p class="text-sm font-mono text-fg">{{ f.first_seen_on_page }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-fg-muted mb-1">Request count</p>
            <p class="text-sm tabular-nums">{{ f.request_count }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-fg-muted mb-1">Status code</p>
            <p class="text-sm font-mono">{{ f.evidence.status_code }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-fg-muted mb-1">Headers snippet</p>
            <pre class="bg-bg border border-border rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all">{{ redactedHeaders(f) }}</pre>
          </div>
        </div>
        <footer class="h-14 px-4 border-t border-border flex items-center justify-end gap-2">
          @if (readonly()) {
            <span class="text-xs text-fg-subtle italic">
              {{ f.excluded ? 'excluded' : 'included' }} — this scan is locked
            </span>
          } @else if (f.excluded) {
            <app-button variant="ghost" size="md" (click)="toggleExclude.emit(f)">
              Re-include
            </app-button>
          } @else {
            <app-button
              variant="secondary"
              size="md"
              (click)="toggleExclude.emit(f)">
              Exclude
            </app-button>
          }
        </footer>
      </aside>
    }
  `
})
export class FindingDetailPanelComponent {
  readonly icons = { X };
  readonly finding = input<Finding | null>(null);
  readonly readonly = input<boolean>(false);
  readonly closePanel = output<void>();
  readonly toggleExclude = output<Finding>();

  redactedHeaders(f: Finding): string {
    return redact(f.evidence.headers_snippet);
  }
}
