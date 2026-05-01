import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Severity } from '@core/models';

@Component({
  selector: 'app-severity-dot',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="sev-dot" [style.background]="color()" [attr.aria-label]="severity()"></span>`
})
export class SeverityDotComponent {
  readonly severity = input.required<Severity>();
  color = computed(() => {
    switch (this.severity()) {
      case 'blocker':
        return 'var(--color-danger)';
      case 'review':
        return 'var(--color-warn)';
      case 'cleared':
        return 'var(--color-success)';
    }
  });
}
