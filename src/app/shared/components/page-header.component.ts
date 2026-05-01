import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex items-end justify-between gap-4 pb-4 mb-6 border-b border-border">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-fg truncate">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="text-sm text-fg-muted mt-1 truncate">{{ subtitle() }}</p>
        }
      </div>
      <div class="shrink-0 flex items-center gap-2">
        <ng-content></ng-content>
      </div>
    </header>
  `
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
