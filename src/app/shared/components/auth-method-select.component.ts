import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  output,
  signal
} from '@angular/core';
import { Check, ChevronDown, LucideAngularModule } from 'lucide-angular';
import type { AuthMethod } from '@core/models';

interface AuthOption {
  value: AuthMethod;
  label: string;
  color: string;
}

/**
 * Styled dropdown for manually classifying a finding whose auth method the
 * scraper left as "unknown". Lists only the concrete, backend-valid methods
 * (never "unknown") and mirrors the colour coding of <app-auth-pill>.
 */
@Component({
  selector: 'app-auth-method-select',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-block text-left">
      <button
        type="button"
        class="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm text-xs font-mono border border-border bg-surface hover:bg-surface-2 transition-colors"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        (click)="toggle()">
        <span>Set auth method…</span>
        <lucide-icon
          [name]="icons.ChevronDown"
          [size]="14"
          class="text-fg-muted transition-transform"
          [class.rotate-180]="open()"></lucide-icon>
      </button>

      @if (open()) {
        <ul
          class="absolute left-0 z-50 mt-1 min-w-[180px] max-h-72 overflow-y-auto thin-scroll rounded-md border border-border bg-surface shadow-2xl py-1"
          role="listbox">
          @for (opt of options; track opt.value) {
            <li>
              <button
                type="button"
                role="option"
                [attr.aria-selected]="false"
                class="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-fg hover:bg-surface-2 transition-colors text-left"
                (click)="choose(opt.value)">
                <span class="sev-dot" [style.background]="opt.color"></span>
                <span>{{ opt.label }}</span>
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `
})
export class AuthMethodSelectComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly icons = { ChevronDown, Check };

  readonly methodSelected = output<AuthMethod>();
  readonly open = signal(false);

  // Concrete methods only — "unknown" is the state we're correcting, so it is
  // never an option. Kept in sync with the backend AuthMethod enum.
  readonly options: AuthOption[] = [
    { value: 'ntlm', label: 'NTLM', color: 'var(--color-danger)' },
    { value: 'kerberos', label: 'KERBEROS', color: 'var(--color-success)' },
    { value: 'oauth2', label: 'OAUTH2', color: 'var(--color-success)' },
    { value: 'bearer', label: 'BEARER', color: 'var(--color-success)' },
    { value: 'mtls', label: 'MTLS', color: 'var(--color-success)' },
    { value: 'basic', label: 'BASIC', color: 'var(--color-warn)' },
    { value: 'unauthenticated', label: 'UNAUTHENTICATED', color: 'var(--color-warn)' }
  ];

  toggle() {
    this.open.update((v) => !v);
  }

  choose(method: AuthMethod) {
    this.open.set(false);
    this.methodSelected.emit(method);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.open()) this.open.set(false);
  }
}
