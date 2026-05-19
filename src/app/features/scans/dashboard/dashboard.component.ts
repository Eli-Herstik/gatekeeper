import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { useScansListQuery } from '../data/scans.queries';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { SkeletonComponent } from '@shared/components/skeleton.component';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import { ButtonComponent } from '@shared/ui/button.component';
import type { ScanStatus } from '@core/models';

const STATUSES: { key: ScanStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'queued', label: 'Queued' }
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    PageHeaderComponent,
    StatusPillComponent,
    EmptyStateComponent,
    SkeletonComponent,
    RelativeTimePipe,
    ButtonComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Recent scans" subtitle="Findings from on-prem app pre-exposure scans.">
      <a routerLink="/scans/new">
        <app-button variant="primary" size="md">New Scan</app-button>
      </a>
    </app-page-header>

    <div class="flex items-center gap-1 mb-4">
      @for (s of statuses; track s.key) {
        <button
          type="button"
          class="px-2.5 h-7 rounded-sm text-xs border transition-colors"
          [class.bg-surface-2]="filter() === s.key"
          [class.text-fg]="filter() === s.key"
          [class.border-border-strong]="filter() === s.key"
          [class.bg-surface]="filter() !== s.key"
          [class.text-fg-muted]="filter() !== s.key"
          [class.border-border]="filter() !== s.key"
          (click)="filter.set(s.key)">
          {{ s.label }}
        </button>
      }
    </div>

    @if (query.isLoading()) {
      <div class="space-y-2">
        @for (_ of skel; track $index) {
          <app-skeleton height="40px"></app-skeleton>
        }
      </div>
    } @else if (query.isError()) {
      <p class="text-sm text-danger">Failed to load scans.</p>
    } @else if (filtered().length === 0) {
      <app-empty-state
        message="No scans match this filter yet."
        cta="Run your first scan"
        (ctaClick)="goNew()">
      </app-empty-state>
    } @else {
      <div class="border border-border rounded-md bg-surface overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-surface-2 border-b border-border">
            <tr>
              <th class="text-left px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Name</th>
              <th class="text-left px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Target URL</th>
              <th class="text-left px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Status</th>
              <th class="text-right px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Blockers</th>
              <th class="text-left px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Started by</th>
              <th class="text-left px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Started</th>
            </tr>
          </thead>
          <tbody>
            @for (s of filtered(); track s.id) {
              <tr
                class="border-t border-border hover:bg-surface-2 cursor-pointer"
                (click)="open(s.id)"
                tabindex="0"
                (keydown.enter)="open(s.id)">
                <td class="px-4 h-10 text-fg">{{ s.name }}</td>
                <td class="px-4 h-10 font-mono text-xs text-fg-muted truncate max-w-md">{{ s.url }}</td>
                <td class="px-4 h-10">
                  <app-status-pill [kind]="s.status" [label]="s.status"></app-status-pill>
                </td>
                <td class="px-4 h-10 text-right tabular-nums text-fg"
                    [class.text-fg-muted]="s.blocker_count === 0">
                  {{ s.blocker_count }}
                </td>
                <td class="px-4 h-10 text-fg-muted">{{ s.started_by }}</td>
                <td class="px-4 h-10 text-fg-muted"
                    [attr.title]="(s.started_at | date:'medium')">
                  {{ s.started_at | relativeTime }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `
})
export class DashboardComponent {
  private readonly router = inject(Router);
  readonly query = useScansListQuery();
  readonly filter = signal<ScanStatus | 'all'>('all');
  readonly statuses = STATUSES;
  readonly skel = Array(5).fill(0);

  readonly filtered = computed(() => {
    const data = this.query.data() ?? [];
    const f = this.filter();
    return f === 'all' ? data : data.filter((s) => s.status === f);
  });

  open(id: string) {
    this.router.navigate(['/scans', id]);
  }

  goNew() {
    this.router.navigate(['/scans/new']);
  }
}
