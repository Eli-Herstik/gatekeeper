import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-counter-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-surface border border-border rounded-md px-4 py-3 min-w-[120px]"
      role="status"
      [attr.aria-live]="live() ? 'polite' : null">
      <div class="text-2xl font-semibold tabular-nums" [class.text-danger]="emphasis() === 'danger'">
        {{ value() }}
      </div>
      <div class="text-xs uppercase tracking-wide text-fg-muted mt-1">
        {{ label() }}
      </div>
    </div>
  `
})
export class CounterCardComponent {
  readonly value = input.required<number | string>();
  readonly label = input.required<string>();
  readonly emphasis = input<'normal' | 'danger'>('normal');
  readonly live = input(false);
}
