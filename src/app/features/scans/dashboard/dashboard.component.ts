import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { useAppsListQuery } from '../data/scans.queries';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { SkeletonComponent } from '@shared/components/skeleton.component';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import type { ExposureState } from '@core/models';

const EXPOSURE_FILTERS: { key: ExposureState | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'scan_in_progress', label: 'Scan in progress' },
  { key: 'failed', label: 'Failed' },
  { key: 'never_scanned', label: 'Never scanned' }
];

const EXPOSURE_LABELS: Record<ExposureState, string> = {
  ready: 'Ready',
  blocked: 'Blocked',
  scan_in_progress: 'Scan in progress',
  failed: 'Failed',
  never_scanned: 'Never scanned'
};

const EXPOSURE_DOT: Record<ExposureState, string> = {
  ready: 'var(--color-success)',
  blocked: 'var(--color-danger)',
  scan_in_progress: 'var(--color-info)',
  failed: 'var(--color-danger)',
  never_scanned: 'var(--color-fg-muted)'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    PageHeaderComponent,
    EmptyStateComponent,
    SkeletonComponent,
    RelativeTimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Apps awaiting exposure"
      subtitle="On-prem apps that are candidates for F5 exposure.">
    </app-page-header>

    <div class="flex items-center gap-1 mb-4">
      @for (f of filters; track f.key) {
        <button
          type="button"
          class="px-2.5 h-7 rounded-sm text-xs border transition-colors"
          [class.bg-surface-2]="filter() === f.key"
          [class.text-fg]="filter() === f.key"
          [class.border-border-strong]="filter() === f.key"
          [class.bg-surface]="filter() !== f.key"
          [class.text-fg-muted]="filter() !== f.key"
          [class.border-border]="filter() !== f.key"
          (click)="filter.set(f.key)">
          {{ f.label }}
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
      <p class="text-sm text-danger">Failed to load apps.</p>
    } @else if (filtered().length === 0) {
      <app-empty-state
        message="No apps match this filter yet."
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
              <th class="text-left px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Exposure state</th>
              <th class="text-left px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Last scanned</th>
              <th class="text-left px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Owner</th>
            </tr>
          </thead>
          <tbody>
            @for (a of filtered(); track a.id) {
              <tr
                class="border-t border-border hover:bg-surface-2 cursor-pointer"
                (click)="open(a.id)"
                tabindex="0"
                (keydown.enter)="open(a.id)">
                <td class="px-4 h-10 text-fg">{{ a.name }}</td>
                <td class="px-4 h-10 font-mono text-xs text-fg-muted truncate max-w-md">{{ a.url }}</td>
                <td class="px-4 h-10">
                  <span
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-medium border border-border bg-surface text-fg">
                    <span
                      class="inline-block w-1.5 h-1.5 rounded-full"
                      [style.background]="exposureDot(a.exposure_state)"></span>
                    {{ exposureLabel(a.exposure_state) }}
                  </span>
                </td>
                <td class="px-4 h-10 text-fg-muted"
                    [attr.title]="a.last_scanned_at ? (a.last_scanned_at | date:'medium') : null">
                  @if (a.last_scanned_at) {
                    {{ a.last_scanned_at | relativeTime }}
                  } @else {
                    <span class="text-fg-subtle">Never</span>
                  }
                </td>
                <td class="px-4 h-10 text-fg-muted">{{ a.owner }}</td>
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
  readonly query = useAppsListQuery();
  readonly filter = signal<ExposureState | 'all'>('all');
  readonly filters = EXPOSURE_FILTERS;
  readonly skel = Array(5).fill(0);

  readonly filtered = computed(() => {
    const data = this.query.data() ?? [];
    const f = this.filter();
    return f === 'all' ? data : data.filter((a) => a.exposure_state === f);
  });

  exposureLabel(s: ExposureState) {
    return EXPOSURE_LABELS[s];
  }

  exposureDot(s: ExposureState) {
    return EXPOSURE_DOT[s];
  }

  open(appId: string) {
    this.router.navigate(['/apps', appId]);
  }

  goNew() {
    this.router.navigate(['/scans/new']);
  }
}
