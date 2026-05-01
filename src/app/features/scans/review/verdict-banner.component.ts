import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideAngularModule, OctagonX, CircleCheck } from 'lucide-angular';

@Component({
  selector: 'app-verdict-banner',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="border-l-4 py-4 px-6 flex items-start gap-4 rounded-r-md"
      [class.border-danger]="isBlocked()"
      [class.bg-danger]="isBlocked()"
      [class.bg-opacity-10]="isBlocked()"
      [class.border-success]="!isBlocked()"
      [class.bg-success]="!isBlocked()"
      [class.bg-opacity-10]="!isBlocked()"
      role="status">
      <lucide-icon
        [name]="isBlocked() ? icons.OctagonX : icons.CircleCheck"
        [size]="20"
        [class.text-danger]="isBlocked()"
        [class.text-success]="!isBlocked()"
        aria-hidden="true">
      </lucide-icon>
      <div class="flex-1">
        <p class="text-base font-semibold text-fg">{{ title() }}</p>
        @if (detail()) {
          <p class="text-sm text-fg-muted mt-0.5">{{ detail() }}</p>
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
