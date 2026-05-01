import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-start gap-3 py-10">
      <p class="text-sm text-fg-muted">{{ message() }}</p>
      @if (cta()) {
        <button
          type="button"
          class="inline-flex items-center px-3 py-1.5 text-sm rounded-md bg-accent text-accent-fg hover:opacity-90"
          (click)="ctaClick.emit()">
          {{ cta() }}
        </button>
      }
    </div>
  `
})
export class EmptyStateComponent {
  readonly message = input.required<string>();
  readonly cta = input<string>();
  readonly ctaClick = output<void>();
}
