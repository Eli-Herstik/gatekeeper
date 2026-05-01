import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideAngularModule, CircleCheck, CircleAlert, Circle, Activity, Clock, OctagonX } from 'lucide-angular';
import type { ScanStatus, Severity } from '@core/models';

type PillKind = ScanStatus | Severity | 'auth';

@Component({
  selector: 'app-status-pill',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-medium border"
      [class]="classes()">
      <span class="sev-dot" [style.background]="dotColor()"></span>
      <lucide-icon [name]="icon()" [size]="12" aria-hidden="true"></lucide-icon>
      <span>{{ label() }}</span>
    </span>
  `
})
export class StatusPillComponent {
  readonly kind = input.required<PillKind>();
  readonly label = input<string>();

  readonly icons = { CircleCheck, CircleAlert, Circle, Activity, Clock, OctagonX };

  icon = computed(() => {
    const k = this.kind();
    switch (k) {
      case 'completed':
      case 'cleared':
        return CircleCheck;
      case 'running':
        return Activity;
      case 'queued':
        return Clock;
      case 'cancelled':
        return Circle;
      case 'failed':
      case 'blocker':
        return OctagonX;
      case 'review':
        return CircleAlert;
      default:
        return Circle;
    }
  });

  dotColor = computed(() => {
    switch (this.kind()) {
      case 'completed':
      case 'cleared':
        return 'var(--color-success)';
      case 'running':
        return 'var(--color-info)';
      case 'queued':
        return 'var(--color-fg-muted)';
      case 'cancelled':
        return 'var(--color-fg-subtle)';
      case 'failed':
      case 'blocker':
        return 'var(--color-danger)';
      case 'review':
        return 'var(--color-warn)';
      default:
        return 'var(--color-fg-muted)';
    }
  });

  classes = computed(() => {
    return 'border-border bg-surface text-fg';
  });
}
