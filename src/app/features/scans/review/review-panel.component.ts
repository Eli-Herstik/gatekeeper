import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { VerdictBannerComponent } from './verdict-banner.component';
import { FindingsSectionComponent } from './findings-section.component';
import { FindingDetailPanelComponent } from './finding-detail-panel.component';
import { ButtonComponent } from '@shared/ui/button.component';
import { useToggleExclusionMutation } from '../data/scans.queries';
import { ToastService } from '@shared/ui/toast.service';
import type { Finding } from '@core/models';

@Component({
  selector: 'app-review-panel',
  standalone: true,
  imports: [
    VerdictBannerComponent,
    FindingsSectionComponent,
    FindingDetailPanelComponent,
    ButtonComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { tabindex: '-1' },
  template: `
    <div class="space-y-6">
      <app-verdict-banner
        class="block mb-8"
        [blockerCount]="unexcludedBlockers().length"
        [exposeCount]="exposeCount()">
      </app-verdict-banner>

      <app-findings-section
        title="Blockers"
        severity="blocker"
        [findings]="blockers()"
        [defaultOpen]="blockers().length > 0"
        [highlightedId]="cursorId()"
        [readonly]="isFrozen()"
        (toggleExclude)="onToggle($event)"
        (selectFinding)="select($event)">
      </app-findings-section>

      <app-findings-section
        title="Review"
        severity="review"
        [findings]="reviews()"
        [defaultOpen]="reviews().length > 0"
        [highlightedId]="cursorId()"
        [readonly]="isFrozen()"
        (toggleExclude)="onToggle($event)"
        (selectFinding)="select($event)">
      </app-findings-section>

      <app-findings-section
        title="Cleared"
        severity="cleared"
        [findings]="cleared()"
        [defaultOpen]="false"
        [highlightedId]="cursorId()"
        [readonly]="isFrozen()"
        (toggleExclude)="onToggle($event)"
        (selectFinding)="select($event)">
      </app-findings-section>

      <div class="flex items-center justify-between pt-4 border-t border-border">
        <p class="text-xs text-fg-muted">
          @if (isFrozen()) {
            This scan is locked — only the latest completed scan can be edited. Run a new scan to make changes.
          } @else {
            Default behaviour: every discovered service is included for exposure unless excluded.
          }
        </p>
        <div class="flex items-center gap-2">
          @if (submitDisabled()) {
            <span
              class="text-xs text-fg-muted"
              [attr.title]="submitTooltip()">
              {{ submitTooltip() }}
            </span>
          }
          <app-button
            variant="primary"
            size="lg"
            [disabled]="submitDisabled()"
            (click)="goToSubmit()">
            Submit for approval
          </app-button>
        </div>
      </div>
    </div>

    <app-finding-detail-panel
      [finding]="selected()"
      [readonly]="isFrozen()"
      (closePanel)="selected.set(null)"
      (toggleExclude)="onToggle($event)">
    </app-finding-detail-panel>
  `
})
export class ReviewPanelComponent {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly scanId = input.required<string>();
  readonly findings = input.required<Finding[]>();
  readonly isLatestScan = input<boolean>(true);
  readonly isFrozen = input<boolean>(false);
  // Mirrors the backend rule: only `completed` scans are submittable. Default
  // true so existing call sites that don't supply this don't regress.
  readonly isCompleted = input<boolean>(true);

  readonly selected = signal<Finding | null>(null);
  readonly cursorIndex = signal<number>(0);

  readonly blockers = computed(() => this.findings().filter((f) => f.severity === 'blocker'));
  readonly reviews = computed(() => this.findings().filter((f) => f.severity === 'review'));
  readonly cleared = computed(() => this.findings().filter((f) => f.severity === 'cleared'));

  readonly orderedAll = computed(() => [
    ...this.blockers(),
    ...this.reviews(),
    ...this.cleared()
  ]);

  readonly cursorId = computed<string | null>(() => {
    const list = this.orderedAll();
    const i = this.cursorIndex();
    return list[i]?.id ?? null;
  });

  readonly unexcludedBlockers = computed(() =>
    this.blockers().filter((f) => !f.excluded)
  );

  readonly exposeCount = computed(() =>
    this.findings().filter((f) => !f.excluded).length
  );

  readonly submitDisabled = computed(
    () =>
      this.unexcludedBlockers().length > 0 ||
      !this.isLatestScan() ||
      this.isFrozen() ||
      !this.isCompleted()
  );

  readonly submitTooltip = computed(() => {
    // Order matters: most specific reason first. "submitted" implies frozen
    // for an audit-trail reason; "not latest" / "not completed" implies the
    // scan can't be the canonical version. We don't pile multiple reasons in
    // one tooltip — pick the one the user can act on.
    if (!this.isCompleted()) {
      return 'Only completed scans can be submitted.';
    }
    if (!this.isLatestScan()) {
      return 'Only the latest completed scan can be submitted. Run a new scan to update.';
    }
    if (this.isFrozen()) {
      return 'This scan is locked.';
    }
    const n = this.unexcludedBlockers().length;
    return n > 0
      ? `${n} ${n === 1 ? 'blocker must be excluded' : 'blockers must be excluded'} or remediated before submitting.`
      : '';
  });

  private readonly toggleMutation = useToggleExclusionMutation({
    onRollback: (args) => {
      this.toast.error(
        'Reverted',
        `Could not ${args.excluded ? 'exclude' : 're-include'} finding — change rolled back.`
      );
    }
  });

  select(f: Finding) {
    this.selected.set(f);
  }

  onToggle(f: Finding) {
    // Frozen scans don't emit toggles from the UI; this is a belt-and-suspenders
    // guard against keyboard shortcuts or programmatic triggers.
    if (this.isFrozen()) return;
    this.toggleMutation.mutate({
      scanId: this.scanId(),
      findingId: f.id,
      excluded: !f.excluded
    });
  }

  goToSubmit() {
    if (this.submitDisabled()) return;
    this.router.navigate(['/scans', this.scanId(), 'submit']);
  }

  // j/k/x shortcuts for review screen.
  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const max = this.orderedAll().length;
    if (max === 0) return;
    if (e.key === 'j') {
      e.preventDefault();
      this.cursorIndex.update((i) => Math.min(max - 1, i + 1));
    } else if (e.key === 'k') {
      e.preventDefault();
      this.cursorIndex.update((i) => Math.max(0, i - 1));
    } else if (e.key === 'x') {
      e.preventDefault();
      if (this.isFrozen()) return;
      const f = this.orderedAll()[this.cursorIndex()];
      if (f) this.onToggle(f);
    } else if (e.key === '?') {
      e.preventDefault();
      this.toast.info(
        'Shortcuts',
        'j/k: navigate · x: toggle exclusion · /: search log · End: jump to latest'
      );
    } else if (e.key === 'Enter') {
      const f = this.orderedAll()[this.cursorIndex()];
      if (f) this.select(f);
    } else if (e.key === 'Escape') {
      this.selected.set(null);
    }
  }
}
