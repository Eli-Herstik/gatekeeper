import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill.component';
import { AuthPillComponent } from '@shared/components/auth-pill.component';
import { ButtonComponent } from '@shared/ui/button.component';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import {
  useAppDiffQuery,
  useAppScansQuery
} from '../../scans/data/scans.queries';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    PageHeaderComponent,
    StatusPillComponent,
    AuthPillComponent,
    ButtonComponent,
    RelativeTimePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'App ' + appId()" subtitle="Scan history and diff."></app-page-header>

    @if (scansQuery.isLoading()) {
      <p class="text-sm text-fg-muted">Loading scans…</p>
    } @else if (scansQuery.isError()) {
      <p class="text-sm text-danger">Failed to load app history.</p>
    } @else {
      <div class="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        <section class="border border-border rounded-md bg-surface overflow-hidden">
          <header class="flex items-center justify-between px-4 h-10 border-b border-border">
            <span class="text-sm font-medium">Scans</span>
            <span class="text-xs text-fg-muted tabular-nums">
              {{ (scansQuery.data() ?? []).length }}
            </span>
          </header>
          <ul class="divide-y divide-border max-h-[700px] overflow-y-auto thin-scroll">
            @for (s of scansQuery.data() ?? []; track s.id) {
              <li class="px-3 py-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  [checked]="from() === s.id || to() === s.id"
                  (change)="togglePick(s.id)"
                  [attr.aria-label]="'Select ' + s.name" />
                <a
                  [routerLink]="['/scans', s.id]"
                  class="flex-1 min-w-0 hover:underline">
                  <div class="text-sm truncate">{{ s.name }}</div>
                  <div class="text-xs text-fg-muted flex items-center gap-2 mt-0.5">
                    <app-status-pill [kind]="s.status" [label]="s.status"></app-status-pill>
                    <span class="tabular-nums" [class.text-danger]="s.blocker_count > 0">
                      {{ s.blocker_count }} blockers
                    </span>
                    <span [attr.title]="(s.started_at | date:'medium')">
                      {{ s.started_at | relativeTime }}
                    </span>
                  </div>
                </a>
              </li>
            }
          </ul>
          <footer class="px-3 h-12 border-t border-border flex items-center justify-between">
            <span class="text-xs text-fg-muted">
              {{ from() ? 'from ' + shortId(from()!) : 'pick "from"' }} ·
              {{ to() ? 'to ' + shortId(to()!) : 'pick "to"' }}
            </span>
            <app-button
              variant="primary"
              size="sm"
              [disabled]="!from() || !to() || from() === to()"
              (click)="loadDiff()">
              Compare
            </app-button>
          </footer>
        </section>

        <section class="border border-border rounded-md bg-surface min-h-[300px]">
          @if (!diffArgs()) {
            <p class="px-4 py-6 text-sm text-fg-muted">
              Pick two scans on the left to see what changed between them.
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
        </section>
      </div>
    }
  `
})
export class HistoryComponent {
  readonly appId = input.required<string>();

  readonly from = signal<string | null>(null);
  readonly to = signal<string | null>(null);

  readonly scansQuery = useAppScansQuery(() => this.appId());

  readonly diffArgs = signal<{ appId: string; from: string; to: string } | null>(null);
  readonly diffQuery = useAppDiffQuery(() => this.diffArgs());
  readonly diff = computed(() => this.diffQuery.data() ?? null);

  togglePick(id: string) {
    if (this.from() === id) {
      this.from.set(null);
      return;
    }
    if (this.to() === id) {
      this.to.set(null);
      return;
    }
    if (!this.from()) this.from.set(id);
    else if (!this.to()) this.to.set(id);
  }

  loadDiff() {
    const f = this.from();
    const t = this.to();
    if (f && t) this.diffArgs.set({ appId: this.appId(), from: f, to: t });
  }

  shortId(id: string) {
    return id.length > 12 ? id.slice(0, 8) + '…' : id;
  }
}
