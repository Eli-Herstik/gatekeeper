import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal
} from '@angular/core';
import { LucideAngularModule, ChevronDown, ChevronRight } from 'lucide-angular';
import { AuthPillComponent } from '@shared/components/auth-pill.component';
import { SeverityDotComponent } from '@shared/components/severity-dot.component';
import { ButtonComponent } from '@shared/ui/button.component';
import type { Finding, Severity } from '@core/models';

@Component({
  selector: 'app-findings-section',
  standalone: true,
  imports: [LucideAngularModule, AuthPillComponent, SeverityDotComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="border border-border rounded-md bg-surface mb-3">
      <button
        type="button"
        class="w-full flex items-center justify-between px-4 h-10 hover:bg-surface-2"
        (click)="open.set(!open())"
        [attr.aria-expanded]="open()">
        <div class="flex items-center gap-2">
          <lucide-icon [name]="open() ? icons.ChevronDown : icons.ChevronRight" [size]="14"></lucide-icon>
          <app-severity-dot [severity]="severity()"></app-severity-dot>
          <span class="text-sm font-medium text-fg">{{ title() }}</span>
          <span class="text-xs text-fg-muted tabular-nums">({{ findings().length }})</span>
        </div>
      </button>

      @if (open() && findings().length > 0) {
        <div class="border-t border-border">
          <table class="w-full text-sm">
            <thead class="bg-surface-2">
              <tr>
                <th class="text-left px-4 h-8 text-xs uppercase tracking-wide font-medium text-fg-muted">Host</th>
                <th class="text-left px-4 h-8 text-xs uppercase tracking-wide font-medium text-fg-muted">Auth</th>
                <th class="text-left px-4 h-8 text-xs uppercase tracking-wide font-medium text-fg-muted">First seen on</th>
                <th class="text-right px-4 h-8 text-xs uppercase tracking-wide font-medium text-fg-muted">Requests</th>
                <th class="text-right px-4 h-8 text-xs uppercase tracking-wide font-medium text-fg-muted w-48">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (f of findings(); track f.id) {
                <tr
                  class="border-t border-border hover:bg-surface-2"
                  [class.cursor-pointer]="true"
                  [class.bg-surface-2]="f.id === highlightedId()"
                  [style.border-left]="f.id === highlightedId() ? '2px solid var(--color-accent)' : '2px solid transparent'"
                  (click)="select.emit(f)">
                  <td class="px-4 h-10 font-mono text-xs"
                      [class.text-fg-muted]="f.excluded"
                      [class.line-through]="f.excluded"
                      [class.text-fg]="!f.excluded">
                    {{ f.host }}
                  </td>
                  <td class="px-4 h-10">
                    <app-auth-pill [method]="f.auth_method"></app-auth-pill>
                  </td>
                  <td class="px-4 h-10 text-xs text-fg-muted font-mono truncate max-w-[260px]">
                    {{ f.first_seen_on_page }}
                  </td>
                  <td class="px-4 h-10 text-right tabular-nums text-fg-muted">{{ f.request_count }}</td>
                  <td class="px-4 h-10">
                    <div class="flex justify-end gap-2" (click)="$event.stopPropagation()">
                      @if (f.excluded) {
                        <app-button variant="ghost" size="sm" (click)="toggle.emit(f)">
                          Re-include
                        </app-button>
                      } @else {
                        <app-button
                          [variant]="f.severity === 'blocker' ? 'danger' : 'secondary'"
                          size="sm"
                          (click)="toggle.emit(f)">
                          Exclude
                        </app-button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (open() && findings().length === 0) {
        <div class="px-4 py-3 text-xs text-fg-muted">No findings in this group.</div>
      }
    </section>
  `
})
export class FindingsSectionComponent {
  readonly icons = { ChevronDown, ChevronRight };

  readonly title = input.required<string>();
  readonly severity = input.required<Severity>();
  readonly findings = input.required<Finding[]>();
  readonly defaultOpen = input<boolean>(true);
  readonly highlightedId = input<string | null>(null);

  readonly toggle = output<Finding>();
  readonly select = output<Finding>();

  readonly open = signal<boolean>(false);

  constructor() {
    // Default open if non-empty (for blocker/review) or closed (cleared).
    // After this initial set, user toggles are preserved.
    queueMicrotask(() => this.open.set(this.defaultOpen()));
  }
}
