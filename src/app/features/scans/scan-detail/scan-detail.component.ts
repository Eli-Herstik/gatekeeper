import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { LucideAngularModule, Check } from 'lucide-angular';
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
  useAppScansQuery,
  useCancelScanMutation,
  useFindingsQuery,
  useScanDetailQuery
} from '../data/scans.queries';
import { SseService, type ConnectionState, type SseStream } from '@lib/sse.service';
import { ConfigurationService } from '@core/services/configuration.service';
import { ToastService } from '@shared/ui/toast.service';
import type { AppSummary, ScanEvent } from '@core/models';

// Grace period before force-closing the SSE stream of an already-terminal scan.
// A freshly-opened terminal scan delivers its scan_failed/scan_completed event
// through the SSE *replay*, which lands slightly after the GET-backed scanQuery
// that reports the terminal status. We wait this long for that replay before
// treating the stream as a genuine dangling connection worth closing.
const TERMINAL_STREAM_GRACE_MS = 4000;

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
          @if (scan()!.submitted_at) {
            <div class="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs bg-success/10 text-success border border-success/30">
              <lucide-icon [name]="icons.Check" [size]="12"></lucide-icon>
              <span>
                Submitted
                @if (scan()!.submitted_by) {
                  by <span class="font-medium">{{ scan()!.submitted_by }}</span>
                }
                <span
                  class="text-success/80"
                  [attr.title]="scan()!.submitted_at | date:'medium'">
                  on {{ scan()!.submitted_at | date:'mediumDate' }}
                </span>
              </span>
            </div>
          }
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
              [findings]="findingsQuery.data() ?? []"
              [isLatestScan]="isLatestScan()"
              [isFrozen]="isFrozen()"
              [isCompleted]="isCompleted()">
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
  readonly icons = { Check };
  // Bound from route via withComponentInputBinding().
  readonly id = input.required<string>();

  private readonly sse = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly config = inject(ConfigurationService);
  private readonly qc = injectQueryClient();

  readonly scanQuery = useScanDetailQuery(() => this.id());
  readonly findingsQuery = useFindingsQuery(() => this.id());
  readonly appScansQuery = useAppScansQuery(() => this.scan()?.app_id ?? '');
  readonly cancelMutation = useCancelScanMutation();

  readonly scan = computed(() => this.scanQuery.data());
  // "Latest" = newest completed scan — same definition the backend uses when
  // deciding submit eligibility. Failed/cancelled/running/queued scans are
  // skipped so they don't block submission of an earlier valid completed scan.
  // Permissive while the sibling-scans query is still loading: without this
  // gate, every scan would briefly render as read-only on initial paint.
  readonly isLatestScan = computed(() => {
    if (!this.appScansQuery.isSuccess()) return true;
    const completed = this.appScansQuery
      .data()!
      .filter((s) => s.status === 'completed');
    return completed.length > 0 && completed[0].id === this.id();
  });
  // Frozen iff this scan can't be edited: either already submitted (forever
  // locked for audit trail) OR no longer the latest completed scan. Mirrors
  // the backend rule in routes_scans.patch_finding.
  readonly isFrozen = computed(
    () => !!this.scan()?.submitted_at || !this.isLatestScan()
  );
  // Mirrors backend submit rule: only `completed` scans are submittable. A
  // `failed`/`cancelled` scan with findings would otherwise show an enabled
  // button that 409s on click.
  readonly isCompleted = computed(() => this.scan()?.status === 'completed');
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
  readonly dock = viewChild(TerminalDockComponent);

  private activeStream: SseStream | null = null;
  // Set once the stream delivers a terminal event (scan_failed/scan_completed),
  // including via replay. Lets the fallback effect distinguish "the stream did
  // its job" from "the stream is dangling and should be force-closed".
  private terminalEventSeen = false;

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
      this.terminalEventSeen = false;
      const stream = this.sse.open(`${this.config.apiBase}/scans/${sid}/events`);
      this.activeStream = stream;
      const sub = stream.events$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (evt) => {
            this.events.update((es) => [...es, evt]);
            if (evt.type === 'scan_completed' || evt.type === 'scan_failed') {
              this.terminalEventSeen = true;
              this.scanQuery.refetch();
              this.findingsQuery.refetch();
              // Without this, isLatestScan() keeps reading the pre-completion
              // sibling list (this scan still running) and falls back to the
              // prior completed scan, freezing the review screen we just landed on.
              this.appScansQuery.refetch();
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

    // Fallback close for a scan that is terminal but whose terminal event never
    // arrives over SSE (e.g. a cancel that disrupts the stream server-side).
    // We must NOT close eagerly the moment isTerminal() is true: that signal is
    // driven by the GET-backed scanQuery, which — for a scan that failed early
    // (e.g. at login) — resolves before the EventSource has delivered its
    // replay. Closing here first would tear the stream down and drop the
    // replayed scan_failed event, leaving the live feed empty (the original
    // bug: no error line ever shown). So we wait a grace period and only
    // force-close if the stream still hasn't surfaced a terminal event by then;
    // when it does, the SSE handler above closes it and sets the flag, and this
    // timer no-ops.
    effect((onCleanup) => {
      if (!this.isTerminal() || this.terminalEventSeen) return;
      const timer = window.setTimeout(() => {
        if (!this.terminalEventSeen) this.activeStream?.close();
      }, TERMINAL_STREAM_GRACE_MS);
      onCleanup(() => window.clearTimeout(timer));
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

    // Auto-collapse the dock on the running → terminal transition. Tracked via
    // a "was running" flag so we only fire on the in-session transition;
    // opening a freshly-loaded completed scan is already handled by
    // [defaultCollapsed]="isTerminal()". Failed/cancelled also count: status
    // is terminal, the review panel takes over, dock content is no longer live.
    let wasRunning = false;
    effect(() => {
      const running = this.isRunning();
      if (wasRunning && !running && this.isTerminal()) {
        this.dock()?.collapse();
      }
      wasRunning = running;
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
