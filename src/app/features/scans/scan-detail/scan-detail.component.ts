import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TerminalDockComponent } from '../live-feed/terminal-dock.component';
import { ReviewPanelComponent } from '../review/review-panel.component';
import { CounterCardComponent } from '@shared/components/counter-card.component';
import { StatusPillComponent } from '@shared/components/status-pill.component';
import { ButtonComponent } from '@shared/ui/button.component';
import { DurationPipe } from '@shared/pipes/duration.pipe';
import { SkeletonComponent } from '@shared/components/skeleton.component';
import { injectQueryClient } from '@tanstack/angular-query-experimental';
import {
  appKeys,
  useCancelScanMutation,
  useFindingsQuery,
  useScanDetailQuery
} from '../data/scans.queries';
import { SseService, type ConnectionState, type SseStream } from '@lib/sse.service';
import { ConfigurationService } from '@core/services/configuration.service';
import { ToastService } from '@shared/ui/toast.service';
import type { AppSummary, ScanEvent } from '@core/models';

@Component({
  selector: 'app-scan-detail',
  standalone: true,
  imports: [
    DatePipe,
    LucideAngularModule,
    TerminalDockComponent,
    ReviewPanelComponent,
    CounterCardComponent,
    StatusPillComponent,
    ButtonComponent,
    DurationPipe,
    SkeletonComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (scanQuery.isLoading()) {
      <div class="space-y-3">
        <app-skeleton height="32px" width="400px"></app-skeleton>
        <app-skeleton height="80px"></app-skeleton>
        <app-skeleton height="600px"></app-skeleton>
      </div>
    } @else if (scanQuery.isError() || !scan()) {
      <div class="text-sm text-danger">Failed to load scan.</div>
    } @else {
      <header class="flex items-start justify-between gap-4 mb-4">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold text-fg truncate">{{ appName() }}</h1>
          <div class="flex items-center gap-3 mt-1">
            <a class="text-sm font-mono text-fg-muted truncate" [href]="scan()!.url" target="_blank" rel="noopener">
              {{ scan()!.url }}
            </a>
            <app-status-pill [kind]="scan()!.status" [label]="scan()!.status"></app-status-pill>
            @if (isRunning()) {
              <span class="text-xs text-fg-muted tabular-nums">
                elapsed {{ elapsedMs() | duration }}
              </span>
            } @else if (scan()!.duration_ms) {
              <span class="text-xs text-fg-muted tabular-nums">
                ran {{ scan()!.duration_ms | duration }}
              </span>
            }
            <span class="text-xs text-fg-subtle"
                  [attr.title]="scan()!.started_at | date:'medium'">
              started {{ scan()!.started_at | date:'shortTime' }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          @if (isRunning()) {
            <app-button variant="ghost" size="sm" (click)="cancel()">
              Cancel scan
            </app-button>
          }
        </div>
      </header>

      <!-- Counter strip -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
           role="region"
           aria-live="polite"
           aria-label="Scan counters">
        <app-counter-card [value]="counters().pages" label="Pages crawled"></app-counter-card>
        <app-counter-card [value]="counters().hosts" label="External hosts"></app-counter-card>
        <app-counter-card [value]="counters().auths" label="Auth methods"></app-counter-card>
        <app-counter-card
          [value]="counters().blockers"
          label="Blockers">
        </app-counter-card>
      </div>

      <div
        class="flex flex-col"
        [style.paddingBottom.px]="dockHeight()">
        @if (!isRunning()) {
          @if (findingsQuery.isLoading()) {
            <app-skeleton height="200px"></app-skeleton>
          } @else if (findingsQuery.isError()) {
            <div class="text-sm text-danger">Failed to load findings.</div>
          } @else {
            <app-review-panel
              [scanId]="scan()!.id"
              [findings]="findingsQuery.data() ?? []">
            </app-review-panel>
          }
        }
      </div>

      <app-terminal-dock
        [events]="events()"
        [state]="connectionState()"
        [scanId]="scan()!.id"
        [defaultCollapsed]="isTerminal()"
        [defaultHeight]="defaultDockHeight()"
        (heightChange)="dockHeight.set($event)">
      </app-terminal-dock>
    }
  `
})
export class ScanDetailComponent {
  // Bound from route via withComponentInputBinding().
  readonly id = input.required<string>();

  private readonly sse = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly config = inject(ConfigurationService);
  private readonly qc = injectQueryClient();

  readonly scanQuery = useScanDetailQuery(() => this.id());
  readonly findingsQuery = useFindingsQuery(() => this.id());
  readonly cancelMutation = useCancelScanMutation();

  readonly scan = computed(() => this.scanQuery.data());
  readonly appName = computed(() => {
    const appId = this.scan()?.app_id;
    if (!appId) return '';
    const apps = this.qc.getQueryData<AppSummary[]>(appKeys.list()) ?? [];
    return apps.find((a) => a.id === appId)?.name ?? appId;
  });
  readonly isRunning = computed(() => this.scan()?.status === 'running');
  readonly isTerminal = computed(() => {
    const s = this.scan()?.status;
    return s === 'completed' || s === 'failed' || s === 'cancelled';
  });

  readonly events = signal<ScanEvent[]>([]);
  readonly connectionState = signal<ConnectionState>('idle');
  readonly elapsedMs = signal<number>(0);
  readonly dockHeight = signal<number>(0);

  private activeStream: SseStream | null = null;

  defaultDockHeight(): number {
    if (typeof window === 'undefined') return 360;
    return this.isTerminal() ? 360 : Math.round(window.innerHeight * 0.5);
  }

  readonly counters = computed(() => {
    let pages = this.scan()?.pages_crawled ?? 0;
    let hosts = this.scan()?.external_hosts ?? 0;
    let auths = this.scan()?.auth_methods_identified ?? 0;
    let blockers = this.scan()?.blocker_count ?? 0;
    // Live counters: derive from event stream when running.
    if (this.isRunning()) {
      const seen = new Set<string>();
      const authMethods = new Set<string>();
      let p = 0;
      let b = 0;
      for (const e of this.events()) {
        if (e.type === 'page_visited') p++;
        if (e.type === 'external_host_seen') seen.add(String(e.payload['host'] ?? ''));
        if (e.type === 'auth_detected') authMethods.add(String(e.payload['method'] ?? ''));
        if (e.type === 'blocker_found') b++;
        if (e.type === 'scan_progress') {
          const pp = (e.payload as { pages?: number; hosts?: number; blockers?: number });
          if (typeof pp.pages === 'number') p = Math.max(p, pp.pages);
          if (typeof pp.blockers === 'number') b = Math.max(b, pp.blockers);
        }
      }
      pages = Math.max(pages, p);
      hosts = Math.max(hosts, seen.size);
      auths = Math.max(auths, authMethods.size);
      blockers = Math.max(blockers, b);
    }
    return { pages, hosts, auths, blockers };
  });

  constructor() {
    // Open SSE stream when we know the scan id. EventSource handles reconnect
    // and Last-Event-ID resume automatically.
    effect((onCleanup) => {
      const sid = this.id();
      if (!sid) return;
      const stream = this.sse.open(`${this.config.apiBase}/scans/${sid}/events`);
      this.activeStream = stream;
      const sub = stream.events$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (evt) => {
            this.events.update((es) => [...es, evt]);
            if (evt.type === 'scan_completed' || evt.type === 'scan_failed') {
              this.scanQuery.refetch();
              this.findingsQuery.refetch();
              stream.close();
            }
          }
        });
      const sub2 = stream.state$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((s) => this.connectionState.set(s));
      onCleanup(() => {
        sub.unsubscribe();
        sub2.unsubscribe();
        stream.close();
        this.activeStream = null;
        this.events.set([]);
      });
    });

    // Covers the cancel path: server closes the SSE without emitting a
    // scan_cancelled event, so we close client-side as soon as the scan
    // status becomes terminal. Idempotent w.r.t. the close above.
    effect(() => {
      if (this.isTerminal()) {
        this.activeStream?.close();
      }
    });

    // Tick elapsed time while running.
    effect((onCleanup) => {
      if (!this.isRunning()) return;
      const start = new Date(this.scan()!.started_at).getTime();
      const interval = window.setInterval(() => {
        this.elapsedMs.set(Date.now() - start);
      }, 1000);
      onCleanup(() => window.clearInterval(interval));
    });
  }

  cancel() {
    if (!confirm('Cancel this running scan?')) return;
    this.cancelMutation.mutate(this.id(), {
      onSuccess: () => this.toast.info('Scan cancelled'),
      onError: () => this.toast.error('Failed to cancel scan')
    });
  }
}
