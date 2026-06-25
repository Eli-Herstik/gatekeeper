import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AuthMethod } from '@core/models';

@Component({
  selector: 'app-auth-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-mono border border-border bg-surface"
      [class.text-danger]="isBlocker()">
      <span class="sev-dot" [style.background]="color()"></span>
      <span>{{ label() }}</span>
    </span>
  `
})
export class AuthPillComponent {
  readonly method = input.required<AuthMethod>();

  isBlocker = computed(() => this.method() === 'ntlm');

  label = computed(() => this.method().toUpperCase());

  color = computed(() => {
    switch (this.method()) {
      case 'ntlm':
        return 'var(--color-danger)';
      case 'basic':
      case 'negotiate':
        return 'var(--color-warn)';
      case 'unauthenticated':
        return 'var(--color-info)';
      case 'oauth':
      case 'kerberos':
      case 'mtls':
      case 'bearer':
        return 'var(--color-success)';
      default:
        return 'var(--color-fg-muted)';
    }
  });
}
