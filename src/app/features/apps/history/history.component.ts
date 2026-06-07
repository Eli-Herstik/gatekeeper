import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { injectQueryClient } from '@tanstack/angular-query-experimental';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill.component';
import { AuthPillComponent } from '@shared/components/auth-pill.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { SkeletonComponent } from '@shared/components/skeleton.component';
import { ButtonComponent } from '@shared/ui/button.component';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import {
  appKeys,
  useAppDiffQuery,
  useAppScansQuery
} from '../../scans/data/scans.queries';
import type { AppSummary, ScanStatus } from '@core/models';

const STATUSES: { key: ScanStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'queued', label: 'Queued' }
];

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    PageHeaderComponent,
    StatusPillComponent,
    AuthPillComponent,
    EmptyStateComponent,
    SkeletonComponent,
    ButtonComponent,
    RelativeTimePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="appName()" subtitle="Recent scans for this app.">
      <a [routerLink]="['/apps', appId(), 'scans', 'new']">
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

    @if (scansQuery.isLoading()) {
      <div class="space-y-2">
        @for (_ of skel; track $index) {
          <app-skeleton height="40px"></app-skeleton>
        }
      </div>
    } @else if (scansQuery.isError()) {
      <p class="text-sm text-danger">Failed to load scans.</p>
    } @else if (filtered().length === 0) {
      <app-empty-state
        message="No scans match this filter yet."
        cta="Run a scan for this app"
        (ctaClick)="goNew()">
      </app-empty-state>
    } @else {
      <div class="border border-border rounded-md bg-surface overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-surface-2 border-b border-border">
            <tr>
              <th class="text-left px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Scan ID</th>
              <th class="text-left px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Status</th>
              <th class="text-right px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Blockers</th>
              <th class="text-left px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Started by</th>
              <th class="text-left px-4 h-9 text-xs uppercase tracking-wide font-medium text-fg-muted">Started</th>
            </tr>
          </thead>
          <tbody>
            @for (s of filtered(); track s.id; let i = $index) {
              <tr
                class="border-t border-border hover:bg-surface-2 cursor-pointer"
                (click)="openScan(s.id)"
                tabindex="0"
                (keydown.enter)="openScan(s.id)">
                <td class="px-4 h-10 font-mono text-xs text-fg">
                  <div class="flex items-center gap-2">
                    <span>{{ s.id }}</span>
                    @if (s.id === currentScanId()) {
                      <span class="inline-flex items-center px-1.5 h-5 rounded-sm text-[10px] font-medium uppercase tracking-wide bg-success/15 text-success border border-success/30">
                        Current
                      </span>
                    } @else if (s.id === latestScanId() && latestScanId() !== currentScanId()) {
                      <span class="inline-flex items-center px-1.5 h-5 rounded-sm text-[10px] font-medium uppercase tracking-wide bg-info/15 text-info border border-info/30">
                        Latest
                      </span>
                    }
                  </div>
                </td>
                <td class="px-4 h-10">
                  <app-status-pill [kind]="s.status" [label]="s.status"></app-status-pill>
                </td>
                <td class="px-4 h-10 text-right tabular-nums text-fg"
                    [class.text-fg-muted]="s.blocker_count === 0">
                  {{ s.blocker_count }}
                </td>
                <td class="px-4 h-10 text-fg-muted">{{ s.started_by }}</td>
                <td class="px-4 h-10 text-fg-muted whitespace-nowrap"
                    [attr.title]="(s.started_at | relativeTime)">
                  {{ s.started_at | date:'MMM d, y, h:mm a' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <section class="mt-8 border border-border rounded-md bg-surface">
      <header class="px-4 h-10 border-b border-border flex items-center">
        <span class="text-sm font-medium">Compare scans</span>
      </header>

      <div class="flex items-center gap-3 px-4 h-12 border-b border-border flex-wrap">
        <label for="diff-from" class="text-xs text-fg-muted">From</label>
        <select
          id="diff-from"
          class="bg-surface border border-border rounded-sm text-sm px-2 h-7"
          [value]="from() ?? ''"
          (change)="setFrom($any($event.target).value)">
          <option value="">— pick a scan —</option>
          @for (s of scansQuery.data() ?? []; track s.id) {
            <option [value]="s.id">{{ s.id }} · {{ s.started_at | date:'short' }}</option>
          }
        </select>

        <label for="diff-to" class="text-xs text-fg-muted ml-2">To</label>
        <select
          id="diff-to"
          class="bg-surface border border-border rounded-sm text-sm px-2 h-7"
          [value]="to() ?? ''"
          (change)="setTo($any($event.target).value)">
          <option value="">— pick a scan —</option>
          @for (s of scansQuery.data() ?? []; track s.id) {
            <option [value]="s.id">{{ s.id }} · {{ s.started_at | date:'short' }}</option>
          }
        </select>

        <app-button
          variant="primary"
          size="sm"
          [disabled]="!from() || !to() || from() === to()"
          (click)="loadDiff()">
          Compare
        </app-button>
      </div>

      <div class="min-h-[180px]">
        @if (!diffArgs()) {
          <p class="px-4 py-6 text-sm text-fg-muted">
            Pick two scans above to see what changed between them.
          </p>
        } @else if (diffQuery.isLoading()) {
          <p class="px-4 py-6 text-sm text-fg-muted">Computing diff…</p>
        } @else if (diffQuery.isError()) {
          <p class="px-4 py-6 text-sm text-danger">Failed to compute diff.</p>
        } @else if (diff()) {
          <header class="px-4 h-10 border-b border-border flex items-center text-sm">
            <span class="font-medium">Diff</span>
            <span class="ml-3 text-xs text-fg-muted">
              {{ diff()!.added.length }} added · {{ diff()!.removed.length }} removed ·
              {{ diff()!.exclusion_changes.length }} exclusion changes ·
              {{ diff()!.auth_method_changes.length }} auth changes
            </span>
          </header>
          <div class="divide-y divide-border">
            @for (f of diff()!.added; track 'a-' + f.id) {
              <div class="flex items-center gap-3 px-4 h-9">
                <span class="font-mono text-success w-3">+</span>
                <span class="font-mono text-xs text-fg flex-1 truncate">{{ f.host }}</span>
                <app-auth-pill [method]="f.auth_method"></app-auth-pill>
              </div>
            }
            @for (f of diff()!.removed; track 'r-' + f.id) {
              <div class="flex items-center gap-3 px-4 h-9">
                <span class="font-mono text-fg-muted w-3">−</span>
                <span class="font-mono text-xs text-fg-muted line-through flex-1 truncate">{{ f.host }}</span>
                <app-auth-pill [method]="f.auth_method"></app-auth-pill>
              </div>
            }
            @for (c of diff()!.exclusion_changes; track 'e-' + c.id) {
              <div class="flex items-center gap-3 px-4 h-9 text-xs">
                <span class="font-mono w-3">~</span>
                <span class="font-mono text-fg flex-1 truncate">{{ c.host }}</span>
                <span class="text-fg-muted">
                  {{ c.before ? 'excluded' : 'included' }} → {{ c.after ? 'excluded' : 'included' }}
                </span>
              </div>
            }
            @for (c of diff()!.auth_method_changes; track 'm-' + c.id) {
              <div class="flex items-center gap-3 px-4 h-9 text-xs">
                <span class="font-mono w-3">~</span>
                <span class="font-mono text-fg flex-1 truncate">{{ c.host }}</span>
                <span class="text-fg-muted font-mono uppercase">{{ c.before }} → {{ c.after }}</span>
              </div>
            }
          </div>
        }
      </div>
    </section>
  `
})
export class HistoryComponent {
  readonly appId = input.required<string>();

  private readonly router = inject(Router);
  private readonly qc = injectQueryClient();

  readonly filter = signal<ScanStatus | 'all'>('all');
  readonly statuses = STATUSES;
  readonly skel = Array(5).fill(0);

  readonly from = signal<string | null>(null);
  readonly to = signal<string | null>(null);
  // Tracks whether we've already auto-populated the diff pickers so we don't
  // overwrite the user's manual selection on later cache updates.
  private primedFor: string | null = null;

  readonly scansQuery = useAppScansQuery(() => this.appId());

  readonly diffArgs = signal<{ appId: string; from: string; to: string } | null>(null);
  readonly diffQuery = useAppDiffQuery(() => this.diffArgs());
  readonly diff = computed(() => this.diffQuery.data() ?? null);

  readonly appName = computed(() => {
    const apps = this.qc.getQueryData<AppSummary[]>(appKeys.list()) ?? [];
    return apps.find((a) => a.id === this.appId())?.name ?? this.appId();
  });

  // Canonical "current version" — pulled from the apps-list cache so we share
  // the same source of truth as the dashboard's Submitted filter.
  readonly currentScanId = computed<string | null>(() => {
    const apps = this.qc.getQueryData<AppSummary[]>(appKeys.list()) ?? [];
    return apps.find((a) => a.id === this.appId())?.current_scan_id ?? null;
  });

  // Latest *completed* scan — matches the backend's submit-eligibility rule.
  // A later failed/running scan doesn't earn the "Latest" badge since it can't
  // be submitted and shouldn't lock out earlier completed ones.
  readonly latestScanId = computed<string | null>(() => {
    const completed = (this.scansQuery.data() ?? []).filter(
      (s) => s.status === 'completed'
    );
    return completed[0]?.id ?? null;
  });

  readonly filtered = computed(() => {
    const data = this.scansQuery.data() ?? [];
    const f = this.filter();
    return f === 'all' ? data : data.filter((s) => s.status === f);
  });

  constructor() {
    // Prime the diff pickers with "what changed since I last submitted?" —
    // from = the canonical current version, to = the latest completed scan.
    // Only runs once per app load; user selections after that are preserved.
    effect(() => {
      const appId = this.appId();
      if (this.primedFor === appId) return;
      const current = this.currentScanId();
      const latest = this.latestScanId();
      if (current && latest && current !== latest) {
        this.from.set(current);
        this.to.set(latest);
        this.diffArgs.set({ appId, from: current, to: latest });
        this.primedFor = appId;
      }
    });
  }

  setFrom(id: string) {
    this.from.set(id || null);
  }

  setTo(id: string) {
    this.to.set(id || null);
  }

  loadDiff() {
    const f = this.from();
    const t = this.to();
    if (f && t) this.diffArgs.set({ appId: this.appId(), from: f, to: t });
  }

  openScan(id: string) {
    this.router.navigate(['/scans', id]);
  }

  goNew() {
    this.router.navigate(['/apps', this.appId(), 'scans', 'new']);
  }
}
