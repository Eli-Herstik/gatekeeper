import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavComponent } from '../nav/nav.component';
import { TopBarComponent } from '../top-bar/top-bar.component';
import { ErrorSignalService } from '@core/errors/error.signal';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, NavComponent, TopBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex bg-bg text-fg">
      <aside class="w-56 shrink-0 border-r border-border bg-surface">
        <div class="h-12 border-b border-border px-4 flex items-center">
          <span class="text-xs uppercase tracking-wider text-fg-muted">Navigation</span>
        </div>
        <app-nav></app-nav>
      </aside>
      <div class="flex-1 min-w-0 flex flex-col relative">
        <app-top-bar></app-top-bar>
        @if (forbidden()) {
          <div
            class="px-6 py-2 bg-danger/15 border-b border-danger/40 text-sm text-danger flex items-center justify-between"
            role="alert">
            <span>You don't have permission to perform that action.</span>
            <button
              type="button"
              class="text-xs underline"
              (click)="dismissForbidden()">
              Dismiss
            </button>
          </div>
        }
        <main class="flex-1 min-w-0 max-w-screen-2xl w-full px-6 py-6">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `
})
export class ShellComponent {
  private readonly errors = inject(ErrorSignalService);
  readonly forbidden = computed(() => this.errors.forbidden() != null);

  dismissForbidden() {
    this.errors.clearForbidden();
  }
}
