import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked
} from '@angular/core';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { LucideAngularModule, Filter, Copy, Download, Search } from 'lucide-angular';
import type { ConnectionState } from '@lib/sse.service';
import { ToastService } from '@shared/ui/toast.service';
import { redactObject } from '@lib/redact';
import { formatEvent, type FormattedLine, type LineType } from './event-format';
import type { ScanEvent } from '@core/models';

const LINE_TYPES: LineType[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [ScrollingModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    tabindex: '0'
  },
  styles: [`
    :host {
      display: block;
      height: 100%;
      outline: none;
    }
    .term-container {
      background: #09090b;
      color: #d4d4d8;
    }
    .term-line {
      display: grid;
      grid-template-columns: 7rem 6rem 16rem 1fr;
      column-gap: 0.75rem;
      padding: 0 1rem;
      line-height: 1.6;
      font-feature-settings: "tnum";
      font-size: 12.5px;
      cursor: pointer;
      align-items: start;
    }
    .term-line .ts { color: #71717a; white-space: nowrap; }
    .term-line .tag { font-weight: 500; white-space: nowrap; }
    .term-line .host {
      color: #f4f4f5;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .term-line .msg {
      color: #d4d4d8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .term-line.tag-DEBUG .tag { color: var(--color-fg-subtle); }
    .term-line.tag-INFO .tag { color: var(--color-info); }
    .term-line.tag-WARN .tag { color: var(--color-warn); }
    .term-line.tag-ERROR .tag { color: var(--color-danger); }
    .term-line.tag-CRITICAL .tag { color: var(--color-danger); font-weight: 700; }
    .term-line.is-blocker {
      border-left: 2px solid var(--color-danger);
      padding-left: calc(1rem - 2px);
      background: rgba(239, 68, 68, 0.06);
    }
    .term-line.expanded {
      grid-template-columns: 1fr;
      cursor: text;
    }
    .term-payload {
      background: #18181b;
      border-radius: 4px;
      padding: 8px 12px;
      margin: 4px 0;
      white-space: pre;
      overflow-x: auto;
    }
    .terminal-final {
      border-top: 1px solid var(--color-border);
      padding: 8px 16px;
      color: var(--color-fg-muted);
      font-size: 12.5px;
    }
    .terminal-final.failed { color: var(--color-danger); }
    .blink-caret::after {
      content: '▌';
      margin-left: 4px;
      animation: blink 1s step-end infinite;
      color: var(--color-fg-muted);
    }
    @keyframes blink { 50% { opacity: 0; } }
  `],
  template: `
    <div class="term-container h-full flex flex-col">
      @if (showChrome()) {
        <!-- chrome bar (only used when standalone — TerminalDockComponent passes showChrome=false) -->
        <div class="h-9 flex items-center justify-between px-3 bg-zinc-900 border-b border-border shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <span class="sev-dot" [style.background]="dotColor()" [attr.aria-label]="state()"></span>
            <span class="text-xs text-fg-muted font-mono">{{ stateLabel() }}</span>
          </div>
          <div class="flex-1 text-center text-xs font-mono text-fg-subtle truncate px-3">
            {{ scanId() }}
          </div>
          <div class="flex items-center gap-1 relative">
            @if (searchOpen()) {
              <div class="flex items-center gap-1 mr-1">
                <lucide-icon [name]="icons.Search" [size]="12" class="text-fg-subtle"></lucide-icon>
                <input
                  #searchInput
                  type="text"
                  class="h-6 w-44 px-2 text-xs bg-surface border border-border-strong rounded-sm font-mono outline-none"
                  [value]="searchText()"
                  (input)="onSearch($any($event.target).value)"
                  (keydown.escape)="closeSearch()"
                  placeholder="filter…" />
              </div>
            }
            <button
              type="button"
              class="relative w-7 h-7 inline-flex items-center justify-center rounded hover:bg-surface-2"
              (click)="filterOpen.set(!filterOpen())"
              aria-label="Filter">
              <lucide-icon [name]="icons.Filter" [size]="14" class="text-fg-muted"></lucide-icon>
              @if (activeFilterCount() > 0) {
                <span
                  class="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-accent text-white text-[10px] flex items-center justify-center tabular-nums">
                  {{ activeFilterCount() }}
                </span>
              }
            </button>
            <button type="button"
                    class="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-surface-2"
                    (click)="copyAll()"
                    aria-label="Copy visible log">
              <lucide-icon [name]="icons.Copy" [size]="14" class="text-fg-muted"></lucide-icon>
            </button>
            <button type="button"
                    class="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-surface-2"
                    (click)="downloadJsonl()"
                    aria-label="Download .jsonl">
              <lucide-icon [name]="icons.Download" [size]="14" class="text-fg-muted"></lucide-icon>
            </button>

            @if (filterOpen()) {
              <div class="absolute top-9 right-0 w-44 bg-surface border border-border rounded-md shadow-lg z-10 p-2">
                <p class="text-xs uppercase tracking-wide text-fg-muted px-2 pb-2">Line types</p>
                @for (t of allLineTypes; track t) {
                  <label class="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-surface-2 rounded-sm">
                    <input type="checkbox"
                           [checked]="!hiddenTypes().has(t)"
                           (change)="toggleType(t)" />
                    <span class="font-mono">[{{ t }}]</span>
                  </label>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- inline search field shown when chrome is hidden but search is opened from the dock -->
      @if (!showChrome() && searchOpen()) {
        <div class="h-8 flex items-center gap-2 px-3 bg-zinc-900 border-b border-border shrink-0">
          <lucide-icon [name]="icons.Search" [size]="12" class="text-fg-subtle"></lucide-icon>
          <input
            #searchInput
            type="text"
            class="h-6 flex-1 max-w-md px-2 text-xs bg-surface border border-border-strong rounded-sm font-mono outline-none"
            [value]="searchText()"
            (input)="onSearch($any($event.target).value)"
            (keydown.escape)="closeSearch()"
            placeholder="filter…" />
          <button type="button"
                  class="text-xs text-fg-subtle hover:text-fg"
                  (click)="closeSearch()"
                  aria-label="Close search">esc</button>
        </div>
      }

      <!-- inline filter popover shown when chrome is hidden but filter is opened from the dock -->
      @if (!showChrome() && filterOpen()) {
        <div class="absolute top-8 right-3 w-44 bg-surface border border-border rounded-md shadow-lg z-10 p-2">
          <p class="text-xs uppercase tracking-wide text-fg-muted px-2 pb-2">Line types</p>
          @for (t of allLineTypes; track t) {
            <label class="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-surface-2 rounded-sm">
              <input type="checkbox"
                     [checked]="!hiddenTypes().has(t)"
                     (change)="toggleType(t)" />
              <span class="font-mono">{{ t }}</span>
            </label>
          }
        </div>
      }

      <!-- body -->
      <div class="relative flex-1 min-h-0">
        @if (events().length === 0) {
          <div class="flex items-center px-4 py-3 text-fg-muted text-xs font-mono blink-caret">
            waiting for first event…
          </div>
        } @else {
          <cdk-virtual-scroll-viewport
            #viewport
            itemSize="20"
            class="thin-scroll h-full"
            (scrolledIndexChange)="onScrolled($event)">
            <div *cdkVirtualFor="let l of visibleLines(); trackBy: trackBySeq"
                 class="term-line"
                 [class.is-blocker]="l.raw.type === 'blocker_found'"
                 [class.expanded]="expanded().has(l.seq)"
                 [class.tag-DEBUG]="l.type === 'DEBUG'"
                 [class.tag-INFO]="l.type === 'INFO'"
                 [class.tag-WARN]="l.type === 'WARN'"
                 [class.tag-ERROR]="l.type === 'ERROR'"
                 [class.tag-CRITICAL]="l.type === 'CRITICAL'"
                 (click)="toggleExpand(l.seq)">
              @if (!expanded().has(l.seq)) {
                <span class="ts">{{ l.tsLabel }}</span>
                <span class="tag">[{{ l.type }}]</span>
                <span class="host" [attr.title]="l.host">{{ l.host || '—' }}</span>
                <span class="msg" [attr.title]="l.message">{{ l.message }}</span>
              } @else {
                <div>
                  <div class="grid"
                       style="grid-template-columns: 7rem 6rem 16rem 1fr; column-gap: 0.75rem;">
                    <span class="ts">{{ l.tsLabel }}</span>
                    <span class="tag">[{{ l.type }}]</span>
                    <span class="host">{{ l.host || '—' }}</span>
                    <span class="msg">{{ l.message }}</span>
                  </div>
                  <pre class="term-payload font-mono text-[12px]">{{ formatPayload(l) }}</pre>
                </div>
              }
            </div>
          </cdk-virtual-scroll-viewport>

          @if (autoScrollPaused() && newSinceScroll() > 0) {
            <button
              type="button"
              class="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 h-7 rounded-full bg-zinc-900 border border-border-strong text-xs text-fg flex items-center gap-2 shadow-lg"
              (click)="jumpToLatest()">
              ↓ {{ newSinceScroll() }} new lines · jump to latest
            </button>
          }
        }
      </div>

      @if (terminalLine()) {
        <div class="terminal-final" [class.failed]="finalState() === 'failed'">
          ── {{ terminalLine() }} ──
        </div>
      }
    </div>
  `
})
export class TerminalComponent {
  readonly icons = { Filter, Copy, Download, Search };
  readonly allLineTypes = LINE_TYPES;

  readonly events = input.required<ScanEvent[]>();
  readonly state = input<ConnectionState>('idle');
  readonly scanId = input<string>('');
  /** Ignored when used inside TerminalDockComponent — the dock controls sizing. */
  readonly height = input<string>('600px');
  readonly finalState = input<'completed' | 'failed' | null>(null);
  readonly finalSummary = input<string>('');
  /** When false, the dock owns the chrome; only the search/filter strip + body render. */
  readonly showChrome = input<boolean>(true);

  readonly hiddenTypes = signal<Set<LineType>>(new Set());
  readonly searchText = signal('');
  readonly searchOpen = signal(false);
  readonly filterOpen = signal(false);
  readonly expanded = signal<Set<string>>(new Set());

  readonly autoScrollPaused = signal(false);
  readonly newSinceScroll = signal(0);
  private lastIndex = 0;

  @ViewChild('viewport') viewport?: CdkVirtualScrollViewport;
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  private readonly toast = inject(ToastService);

  // Per-event memoization so the 8000-event fixture does not re-format each
  // existing event when a single new one arrives. Keeps the recompute O(n).
  private readonly formatCache = new WeakMap<ScanEvent, FormattedLine>();
  private formatCached(e: ScanEvent): FormattedLine {
    let r = this.formatCache.get(e);
    if (!r) {
      r = formatEvent(e);
      this.formatCache.set(e, r);
    }
    return r;
  }

  readonly formattedLines = computed<FormattedLine[]>(() =>
    this.events().map((e) => this.formatCached(e))
  );

  readonly visibleLines = computed<FormattedLine[]>(() => {
    const hidden = this.hiddenTypes();
    const q = this.searchText().trim().toLowerCase();
    return this.formattedLines().filter((l) => {
      if (hidden.has(l.type)) return false;
      if (q) {
        const hay = (l.host + ' ' + l.message).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  readonly activeFilterCount = computed(() => this.hiddenTypes().size);

  readonly stateLabel = computed(() => {
    switch (this.state()) {
      case 'live': return 'live';
      case 'reconnecting': return 'reconnecting…';
      case 'closed': return 'disconnected';
      default: return 'idle';
    }
  });

  readonly dotColor = computed(() => {
    switch (this.state()) {
      case 'live': return 'var(--color-info)';
      case 'reconnecting': return 'var(--color-warn)';
      case 'closed': return 'var(--color-fg-subtle)';
      default: return 'var(--color-fg-subtle)';
    }
  });

  readonly terminalLine = computed(() => {
    const f = this.finalState();
    if (!f) return '';
    return this.finalSummary() || (f === 'completed' ? 'scan completed' : 'scan failed');
  });

  constructor() {
    // Auto-scroll to bottom whenever new events arrive (unless paused).
    // The paused flag is read via untracked() so the effect only re-runs when
    // visibleLines changes — otherwise onScrolled flipping the flag during a
    // user scroll would re-fire this effect and yank the viewport back down.
    effect(() => {
      const lines = this.visibleLines();
      const paused = untracked(() => this.autoScrollPaused());
      if (paused) {
        // Track how many new lines since pause for the floating pill.
        this.newSinceScroll.update((n) => n + Math.max(0, lines.length - this.lastIndex));
      } else {
        // Defer to next frame so virtual scroll has measured.
        queueMicrotask(() => this.scrollToBottom());
      }
      this.lastIndex = lines.length;
    });
  }

  trackBySeq = (_i: number, l: FormattedLine) => l.seq;

  formatPayload(l: FormattedLine): string {
    return JSON.stringify(redactObject(l.raw), null, 2);
  }

  toggleExpand(seq: string) {
    this.expanded.update((s) => {
      const next = new Set(s);
      if (next.has(seq)) next.delete(seq);
      else next.add(seq);
      return next;
    });
  }

  toggleType(t: LineType) {
    this.hiddenTypes.update((s) => {
      const next = new Set(s);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  onSearch(value: string) {
    this.searchText.set(value);
  }

  closeSearch() {
    this.searchText.set('');
    this.searchOpen.set(false);
  }

  /** Public hook for TerminalDockComponent's title-bar Search button. */
  openSearch() {
    this.searchOpen.set(true);
    queueMicrotask(() => this.searchInputRef?.nativeElement.focus());
  }

  /** Public hook for TerminalDockComponent's title-bar Filter button. */
  toggleFilter() {
    this.filterOpen.update((v) => !v);
  }

  /** Force the CDK virtual scroll viewport to re-measure. Needed because the
   *  viewport mounts inside the dock's [hidden] body and reads size 0 there;
   *  uncollapsing the dock would otherwise leave it stuck at zero rows. */
  refreshViewportSize() {
    queueMicrotask(() => this.viewport?.checkViewportSize());
  }

  copyAll() {
    const text = this.visibleLines()
      .map((l) => `${l.tsLabel}  ${`[${l.type}]`.padEnd(10, ' ')}  ${l.host.padEnd(30, ' ')}  ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(
      () => this.toast.success('Copied', `${this.visibleLines().length} lines copied`),
      () => this.toast.error('Copy failed')
    );
  }

  downloadJsonl() {
    const blob = new Blob(
      [this.events().map((e) => JSON.stringify(redactObject(e))).join('\n')],
      { type: 'application/x-ndjson' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.scanId() || 'scan'}-events.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  onScrolled(_index: number) {
    if (!this.viewport) return;
    // Pixel distance is more reliable than the rendered-range end, which
    // includes a buffer past the visible area and can flicker around the
    // total-1 threshold mid-scroll.
    const distFromBottom = this.viewport.measureScrollOffset('bottom');
    const atBottom = distFromBottom < 4;
    if (atBottom) {
      this.autoScrollPaused.set(false);
      this.newSinceScroll.set(0);
    } else {
      this.autoScrollPaused.set(true);
    }
  }

  jumpToLatest() {
    this.autoScrollPaused.set(false);
    this.newSinceScroll.set(0);
    this.scrollToBottom();
  }

  private scrollToBottom() {
    if (!this.viewport) return;
    const len = this.visibleLines().length;
    if (len > 0) this.viewport.scrollToIndex(len - 1, 'auto');
  }

  // Keyboard shortcuts on the terminal pane (when focused).
  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === '/') {
      e.preventDefault();
      this.searchOpen.set(true);
      queueMicrotask(() => this.searchInputRef?.nativeElement.focus());
    } else if (e.key === 'End') {
      e.preventDefault();
      this.jumpToLatest();
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (this.viewport) this.viewport.scrollToIndex(0, 'auto');
      this.autoScrollPaused.set(true);
    } else if (e.key === 'Escape') {
      this.closeSearch();
    }
  }
}
