import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled()"
      [class]="classes()"
      [attr.aria-disabled]="disabled() ? 'true' : null">
      <ng-content></ng-content>
    </button>
  `
})
export class ButtonComponent {
  readonly variant = input<Variant>('secondary');
  readonly size = input<Size>('sm');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input<boolean>(false);

  classes = computed(() => {
    const v = this.variant();
    const s = this.size();
    const base =
      'inline-flex items-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none';
    const sizeMap: Record<Size, string> = {
      sm: 'h-7 px-3 text-xs',
      md: 'h-8 px-3.5 text-sm',
      lg: 'h-10 px-5 text-sm'
    };
    const variantMap: Record<Variant, string> = {
      primary: 'bg-accent text-accent-fg hover:opacity-90',
      secondary:
        'bg-surface text-fg border border-border hover:bg-surface-2 hover:border-border-strong',
      danger: 'bg-danger text-white hover:opacity-90',
      ghost:
        'bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg border border-transparent'
    };
    return `${base} ${sizeMap[s]} ${variantMap[v]}`;
  });
}
