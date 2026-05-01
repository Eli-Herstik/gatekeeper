import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule, LayoutDashboard, Plus, History, Settings } from 'lucide-angular';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="flex flex-col gap-0.5 p-3" aria-label="Primary">
      <a
        routerLink="/"
        routerLinkActive="bg-surface-2 text-fg"
        [routerLinkActiveOptions]="{ exact: true }"
        class="flex items-center gap-2 px-3 h-8 rounded-md text-sm text-fg-muted hover:text-fg hover:bg-surface-2">
        <lucide-icon [name]="icons.LayoutDashboard" [size]="14"></lucide-icon>
        <span>Dashboard</span>
      </a>
      <a
        routerLink="/scans/new"
        routerLinkActive="bg-surface-2 text-fg"
        class="flex items-center gap-2 px-3 h-8 rounded-md text-sm text-fg-muted hover:text-fg hover:bg-surface-2">
        <lucide-icon [name]="icons.Plus" [size]="14"></lucide-icon>
        <span>New Scan</span>
      </a>
      <a
        href="#"
        class="flex items-center gap-2 px-3 h-8 rounded-md text-sm text-fg-muted hover:text-fg hover:bg-surface-2"
        aria-disabled="true">
        <lucide-icon [name]="icons.History" [size]="14"></lucide-icon>
        <span>History</span>
      </a>
      <a
        href="#"
        class="flex items-center gap-2 px-3 h-8 rounded-md text-sm text-fg-muted hover:text-fg hover:bg-surface-2"
        aria-disabled="true">
        <lucide-icon [name]="icons.Settings" [size]="14"></lucide-icon>
        <span>Settings</span>
      </a>
    </nav>
  `
})
export class NavComponent {
  readonly icons = { LayoutDashboard, Plus, History, Settings };
}
