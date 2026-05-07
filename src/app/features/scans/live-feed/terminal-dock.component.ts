import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal
} from '@angular/core';
import {
  LucideAngularModule,
  Filter,
  Copy,
  Download,
  Search,
  ChevronUp,
  ChevronDown
} from 'lucide-angular';
import { TerminalComponent } from './terminal.component';
import type { ConnectionState } from '@lib/sse.service';
import type { ScanEvent } from '@core/models';

interface DockPersisted {
  collapsed: boolean;
  height: number;
}

const MIN_HEIGHT = 120;
const HEADER_HEIGHT = 32;

/**
 * VS Code-style bottom-docked terminal panel.
 *
 * Sticky to the bottom of <main>, full-bleed across its horizontal padding.
 * Owns the title bar (TERMINAL label, status, scan id, controls), the resize
 * handle, the collapse toggle, and persistence to sessionStorage. Embeds the
 * existing TerminalComponent as its body with showChrome=false so the dock is
 * the only visible frame.
 */
@Component({
  selector: 'app-terminal-dock',
  standalone: true,
  imports: [LucideAngularModule, TerminalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: contents; }
    .dock {
      position: sticky;
      bottom: 0;
      z-index: 30;
      background: #09090b;
      border-top: 1px solid var(--color-border);
      margin-left: -1.5rem;
      margin-right: -1.5rem;
      display: flex;
      flex-direction: column;
    }
    .resize-handle {
      position: absolute;
      top: -3px;
      left: 0;
      right: 0;
      height: 6px;
      cursor: ns-resize;
      outline: none;
    }
    .resize-handle:hover,
    .resize-handle:focus-visible,
    .resize-handle.dragging {
      background: rgba(59, 130, 246, 0.45);
    }
    @keyframes term-live-pulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.35; }
    }
    .live-dot {
      animation: term-live-pulse 1.6s cubic-bezier(.4, 0, .6, 1) infinite;
    }
    @keyframes term-reconnecting-blink {
      0%   { opacity: 1; }
      50%  { opacity: 0.15; }
      100% { opacity: 1; }
    }
    .reconnecting-dot {
      animation: term-reconnecting-blink 0.8s step-end infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .live-dot,
      .reconnecting-dot { animation: none; }
    }
  `],
  template: `
    <aside
      class="dock"
      [style.height.px]="effectiveHeight()"
      role="region"
      aria-label="Event log terminal">

      @if (!collapsed()) {
        <div
          class="resize-handle"
          [class.dragging]="dragging()"
          tabindex="0"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize terminal panel"
          [attr.aria-valuenow]="height()"
          [attr.aria-valuemin]="MIN_HEIGHT"
          [attr.aria-valuemax]="maxHeight()"
          (mousedown)="onDragStart($event)"
          (touchstart)="onDragStart($event)"
          (keydown)="onHandleKey($event)">
        </div>
      }

      <header class="h-8 flex items-center gap-2 px-3 bg-zinc-900 border-b border-border select-none shrink-0">
        <button
          type="button"
          class="flex items-center gap-2 hover:opacity-80"
          [attr.aria-expanded]="!collapsed()"
          aria-controls="terminal-body"
          (click)="toggleCollapsed()">
          <lucide-icon
            [name]="collapsed() ? icons.ChevronUp : icons.ChevronDown"
            [size]="12"
            class="text-fg-muted">
          </lucide-icon>
          <span class="text-[11px] uppercase tracking-wider font-medium text-fg-muted">TERMINAL</span>
          <span class="text-[11px] text-fg-subtle tabular-nums">({{ events().length }})</span>
          <span class="sev-dot ml-1"
                [class.live-dot]="state() === 'live'"
                [class.reconnecting-dot]="state() === 'reconnecting'"
                [style.background]="dotColor()"
                [attr.aria-label]="state()"></span>
          <span class="text-[11px] text-fg-subtle font-mono">{{ stateLabel() }}</span>
        </button>

        <span class="flex-1 text-center text-xs font-mono text-fg-subtle truncate px-3">
          {{ scanId() }}
        </span>

        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <div class="flex items-center gap-1 relative" (click)="$event.stopPropagation()">
          <button
            type="button"
            class="relative w-7 h-7 inline-flex items-center justify-center rounded hover:bg-surface-2"
            (click)="onSearchClick()"
            aria-label="Search log">
            <lucide-icon [name]="icons.Search" [size]="14" class="text-fg-muted"></lucide-icon>
          </button>
          <button
            type="button"
            class="relative w-7 h-7 inline-flex items-center justify-center rounded hover:bg-surface-2"
            (click)="onFilterClick()"
            aria-label="Filter">
            <lucide-icon [name]="icons.Filter" [size]="14" class="text-fg-muted"></lucide-icon>
            @if (activeFilterCount() > 0) {
              <span
                class="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-accent text-white text-[10px] flex items-center justify-center tabular-nums">
                {{ activeFilterCount() }}
              </span>
            }
          </button>
          <button
            type="button"
            class="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-surface-2"
            (click)="onCopyClick()"
            aria-label="Copy visible log">
            <lucide-icon [name]="icons.Copy" [size]="14" class="text-fg-muted"></lucide-icon>
          </button>
          <button
            type="button"
            class="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-surface-2"
            (click)="onDownloadClick()"
            aria-label="Download .jsonl">
            <lucide-icon [name]="icons.Download" [size]="14" class="text-fg-muted"></lucide-icon>
          </button>
        </div>
      </header>

      <div
        id="terminal-body"
        class="flex-1 min-h-0 relative"
        [hidden]="collapsed()">
        <app-terminal
          #term
          [events]="events()"
          [scanId]="scanId()">
        </app-terminal>
      </div>
    </aside>
  `
})
export class TerminalDockComponent {
  readonly icons = { Filter, Copy, Download, Search, ChevronUp, ChevronDown };
  readonly MIN_HEIGHT = MIN_HEIGHT;

  readonly events = input.required<ScanEvent[]>();
  readonly state = input<ConnectionState>('idle');
  readonly scanId = input<string>('');
  readonly defaultCollapsed = input<boolean>(false);
  readonly defaultHeight = input<number>(360);
  readonly storageKey = input<string>('eg.terminal.dock');

  readonly heightChange = output<number>();
  readonly collapsedChange = output<boolean>();

  readonly collapsed = signal<boolean>(false);
  readonly height = signal<number>(360);
  readonly dragging = signal<boolean>(false);

  readonly maxHeight = signal<number>(this.computeMaxHeight());

  readonly effectiveHeight = computed(() =>
    this.collapsed() ? HEADER_HEIGHT : this.height()
  );

  @ViewChild('term') private termRef?: TerminalComponent;
  @ViewChild('term', { read: ElementRef }) private termEl?: ElementRef<HTMLElement>;

  private hydrated = false;

  constructor() {
    // Seed from sessionStorage if available; otherwise from inputs. Wrapped in
    // an effect so we can read the inputs at field-init time without timing
    // issues (signal inputs aren't bound yet in the constructor body).
    effect(() => {
      if (this.hydrated) return;
      const persisted = this.readPersisted();
      this.collapsed.set(persisted?.collapsed ?? this.defaultCollapsed());
      const h = persisted?.height ?? this.defaultHeight();
      this.height.set(this.clampHeight(h));
      this.hydrated = true;
    });

    // Persist + notify on change.
    effect(() => {
      if (!this.hydrated) return;
      this.writePersisted({ collapsed: this.collapsed(), height: this.height() });
      this.heightChange.emit(this.effectiveHeight());
      this.collapsedChange.emit(this.collapsed());
    });

    // The terminal body is wrapped in [hidden]="collapsed()". CDK virtual
    // scroll measures size 0 while hidden and won't auto-recover. Whenever
    // the dock is open (initial mount or after an uncollapse), nudge the
    // child to re-measure so rows actually render.
    effect(() => {
      if (this.collapsed()) return;
      queueMicrotask(() => this.termRef?.refreshViewportSize());
    });
  }

  toggleCollapsed() {
    this.collapsed.update((v) => !v);
  }

  // --- Drag-resize ---------------------------------------------------------

  onDragStart(ev: MouseEvent | TouchEvent) {
    ev.preventDefault();
    const startY = isTouchEvent(ev) ? ev.touches[0]!.clientY : ev.clientY;
    const startH = this.height();
    this.dragging.set(true);

    const move = (e: MouseEvent | TouchEvent) => {
      const cy = isTouchEvent(e) ? e.touches[0]!.clientY : e.clientY;
      // Dragging up grows the dock (we're attached at the bottom).
      const next = startH + (startY - cy);
      this.height.set(this.clampHeight(next));
    };
    const up = () => {
      this.dragging.set(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
  }

  onHandleKey(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.height.update((h) => this.clampHeight(h + 20));
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.height.update((h) => this.clampHeight(h - 20));
        break;
      case 'Home':
        e.preventDefault();
        this.height.set(MIN_HEIGHT);
        break;
      case 'End':
        e.preventDefault();
        this.height.set(this.maxHeight());
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.toggleCollapsed();
        break;
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.maxHeight.set(this.computeMaxHeight());
    this.height.update((h) => this.clampHeight(h));
  }

  // --- Title-bar control delegates ----------------------------------------

  onSearchClick() {
    if (this.collapsed()) this.collapsed.set(false);
    queueMicrotask(() => this.termRef?.openSearch());
    // The terminal must be focused for / Esc keybindings to work after opening.
    queueMicrotask(() => this.termEl?.nativeElement.focus());
  }

  onFilterClick() {
    if (this.collapsed()) this.collapsed.set(false);
    queueMicrotask(() => this.termRef?.toggleFilter());
  }

  onCopyClick() {
    this.termRef?.copyAll();
  }

  onDownloadClick() {
    this.termRef?.downloadJsonl();
  }

  // --- Status indicators (same logic as TerminalComponent) ----------------

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
      case 'live': return 'var(--color-success)';
      case 'reconnecting': return 'var(--color-warn)';
      case 'closed': return 'var(--color-fg-subtle)';
      default: return 'var(--color-fg-subtle)';
    }
  });

  readonly activeFilterCount = computed(() => this.termRef?.activeFilterCount() ?? 0);

  // --- Helpers -------------------------------------------------------------

  private clampHeight(h: number): number {
    return Math.max(MIN_HEIGHT, Math.min(this.maxHeight(), Math.round(h)));
  }

  private computeMaxHeight(): number {
    if (typeof window === 'undefined') return 600;
    return Math.round(window.innerHeight * 0.7);
  }

  private readPersisted(): DockPersisted | null {
    try {
      const raw = sessionStorage.getItem(this.storageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.collapsed === 'boolean' &&
        typeof parsed.height === 'number'
      ) {
        return parsed as DockPersisted;
      }
    } catch {
      /* private mode / corrupt entry — fall through */
    }
    return null;
  }

  private writePersisted(v: DockPersisted) {
    try {
      sessionStorage.setItem(this.storageKey(), JSON.stringify(v));
    } catch {
      /* private mode — silently drop */
    }
  }
}

function isTouchEvent(e: Event): e is TouchEvent {
  return typeof TouchEvent !== 'undefined' && e instanceof TouchEvent;
}
