import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-surface-2 rounded-sm"
      [style.width]="width()"
      [style.height]="height()"
      aria-hidden="true">
    </div>
  `
})
export class SkeletonComponent {
  readonly width = input<string>('100%');
  readonly height = input<string>('14px');
}
