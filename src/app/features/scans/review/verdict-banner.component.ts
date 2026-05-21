import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideAngularModule, OctagonX, CircleCheck } from 'lucide-angular';

@Component({
  selector: 'app-verdict-banner',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative overflow-hidden border rounded-md p-5 flex items-start gap-5 transition-colors"
      [class.border-danger/30]="isBlocked()"
      [class.bg-danger/5]="isBlocked()"
      [class.border-success/30]="!isBlocked()"
      [class.bg-success/5]="!isBlocked()"
      role="status">

      <!-- Left accent stripe -->
      <div
        class="absolute left-0 top-0 bottom-0 w-1.5"
        [class.bg-danger]="isBlocked()"
        [class.bg-success]="!isBlocked()">
      </div>

      <div
        class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
        [class.bg-danger/10]="isBlocked()"
        [class.text-danger]="isBlocked()"
        [class.bg-success/10]="!isBlocked()"
        [class.text-success]="!isBlocked()">
        <lucide-icon
          [name]="isBlocked() ? icons.OctagonX : icons.CircleCheck"
          [size]="24"
          aria-hidden="true">
        </lucide-icon>
      </div>

      <div class="flex-1 pt-0.5">
        <h3 class="text-lg font-bold text-fg leading-tight">{{ title() }}</h3>
        @if (detail()) {
          <p class="text-sm text-fg-muted mt-1.5 leading-relaxed">{{ detail() }}</p>
        }
      </div>
    </div>
  `
})
export class VerdictBannerComponent {
  readonly blockerCount = input.required<number>();
  readonly exposeCount = input.required<number>();

  readonly icons = { OctagonX, CircleCheck };

  readonly isBlocked = computed(() => this.blockerCount() > 0);

  readonly title = computed(() => {
    const n = this.blockerCount();
    if (n === 0) return 'No blocking issues';
    return `${n} blocking ${n === 1 ? 'issue' : 'issues'}`;
  });

  readonly detail = computed(() => {
    if (this.blockerCount() > 0) {
      return `NTLM detected on ${this.blockerCount()} ${this.blockerCount() === 1 ? 'service' : 'services'}. Exclude or change auth method, then re-scan.`;
    }
    return `${this.exposeCount()} external services will be exposed.`;
  });
}
