import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LucideAngularModule, Bell, LogOut, Shield } from 'lucide-angular';
import { AuthService } from '@core/services/auth.service';
import { NotificationsService } from '@core/services/notifications.service';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    <header
      class="h-12 border-b border-border flex items-center justify-between px-4 bg-surface">
      <div class="flex items-center gap-2">
        <lucide-icon [name]="icons.Shield" [size]="16" class="text-fg-muted"></lucide-icon>
        <span class="text-sm font-semibold tracking-wide">Exposure Gatekeeper</span>
      </div>
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="relative inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-surface-2"
          (click)="onBellClick()"
          [attr.aria-label]="'Notifications, ' + notifications.unreadCount() + ' unread'">
          <lucide-icon [name]="icons.Bell" [size]="16" class="text-fg-muted"></lucide-icon>
          @if (notifications.unreadCount() > 0) {
            <span
              class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-2xs font-medium flex items-center justify-center tabular-nums">
              {{ notifications.unreadCount() }}
            </span>
          }
        </button>
        @if (auth.currentUser(); as user) {
          <div class="text-xs text-fg-muted">{{ user.username }}</div>
          <button
            type="button"
            class="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-surface-2"
            (click)="auth.logout()"
            aria-label="Sign out">
            <lucide-icon [name]="icons.LogOut" [size]="16" class="text-fg-muted"></lucide-icon>
          </button>
        }
      </div>
    </header>
    @if (panelOpen()) {
      <div
        class="absolute top-12 right-4 w-80 bg-surface border border-border rounded-md shadow-lg z-30">
        <div class="px-3 h-9 flex items-center justify-between border-b border-border">
          <span class="text-xs uppercase tracking-wide text-fg-muted">Notifications</span>
          <button
            class="text-xs text-fg-muted hover:text-fg"
            type="button"
            (click)="notifications.markAllRead()">
            Mark all read
          </button>
        </div>
        <ul class="max-h-96 overflow-y-auto">
          @for (n of notifications.items(); track n.id) {
            <li class="px-3 py-2 border-b border-border last:border-0">
              <div class="text-sm" [class.font-medium]="!n.read">{{ n.title }}</div>
              <div class="text-xs text-fg-muted mt-0.5">{{ n.body }}</div>
            </li>
          } @empty {
            <li class="px-3 py-6 text-xs text-fg-muted text-center">No notifications.</li>
          }
        </ul>
      </div>
    }
  `
})
export class TopBarComponent {
  readonly icons = { Bell, LogOut, Shield };
  readonly auth = inject(AuthService);
  readonly notifications = inject(NotificationsService);

  readonly panelOpen = signal(false);

  onBellClick() {
    this.panelOpen.update((v) => !v);
    if (this.panelOpen()) this.notifications.markAllRead();
  }
}
