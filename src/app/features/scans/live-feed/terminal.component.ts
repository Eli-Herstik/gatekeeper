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
import { LucideAngularModule, Search } from 'lucide-angular';
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
      <!-- inline search field shown when search is opened from the dock -->
      @if (searchOpen()) {
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

      <!-- inline filter popover shown when filter is opened from the dock -->
      @if (filterOpen()) {
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
                 [class.tag-DEBUG]="l.type === 'DEBUG'"
                 [class.tag-INFO]="l.type === 'INFO'"
                 [class.tag-WARN]="l.type === 'WARN'"
                 [class.tag-ERROR]="l.type === 'ERROR'"
                 [class.tag-CRITICAL]="l.type === 'CRITICAL'">
              <span class="ts">{{ l.tsLabel }}</span>
              <span class="tag">[{{ l.type }}]</span>
              <span class="host" [attr.title]="l.host">{{ l.host || '—' }}</span>
              <span class="msg" [attr.title]="l.message">{{ l.message }}</span>
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

    </div>
  `
})
export class TerminalComponent {
  readonly icons = { Search };
  readonly allLineTypes = LINE_TYPES;

  readonly events = input.required<ScanEvent[]>();
  readonly scanId = input<string>('');

  readonly hiddenTypes = signal<Set<LineType>>(new Set());
  readonly searchText = signal('');
  readonly searchOpen = signal(false);
  readonly filterOpen = signal(false);

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
