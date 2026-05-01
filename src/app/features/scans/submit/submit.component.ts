import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Check, Copy } from 'lucide-angular';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { AuthPillComponent } from '@shared/components/auth-pill.component';
import { ButtonComponent } from '@shared/ui/button.component';
import { CopyToClipboardDirective } from '@shared/directives/copy-to-clipboard.directive';
import {
  useFindingsQuery,
  useScanDetailQuery,
  useSubmitScanMutation
} from '../data/scans.queries';
import { ToastService } from '@shared/ui/toast.service';

@Component({
  selector: 'app-submit',
  standalone: true,
  imports: [
    LucideAngularModule,
    RouterLink,
    PageHeaderComponent,
    AuthPillComponent,
    ButtonComponent,
    CopyToClipboardDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      [title]="scan()?.name ?? 'Scan'"
      [subtitle]="scan()?.url ?? ''">
      <a [routerLink]="['/scans', id()]"><app-button variant="ghost" size="sm">Back to review</app-button></a>
    </app-page-header>

    @if (approvalId()) {
      <section class="border border-border rounded-md bg-surface p-6 max-w-2xl">
        <div class="flex items-center gap-2 mb-3 text-success">
          <lucide-icon [name]="icons.Check" [size]="20"></lucide-icon>
          <h2 class="text-lg font-semibold">Approval recorded</h2>
        </div>
        <p class="text-sm text-fg-muted mb-4">
          The scan results have been saved. Share this approval ID with the F5 reviewer.
        </p>
        <div class="flex items-center gap-2">
          <code
            class="flex-1 px-3 h-9 rounded-md bg-bg border border-border font-mono text-sm flex items-center"
            >{{ approvalId() }}</code>
          <button
            type="button"
            [appCopyToClipboard]="approvalId()!"
            (copied)="onCopied()"
            class="inline-flex items-center gap-1.5 px-3 h-9 text-xs rounded-md bg-surface border border-border hover:bg-surface-2">
            <lucide-icon [name]="icons.Copy" [size]="14"></lucide-icon>
            Copy
          </button>
        </div>
        <p class="text-xs text-fg-subtle mt-4">
          Shareable link:
          <code class="font-mono text-fg-muted">{{ shareLink() }}</code>
        </p>
      </section>
    } @else {
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section class="border border-border rounded-md bg-surface">
          <header class="flex items-center justify-between px-4 h-10 border-b border-border">
            <span class="text-sm font-medium">Will be exposed</span>
            <span class="text-xs text-fg-muted tabular-nums">{{ exposed().length }}</span>
          </header>
          @if (exposed().length === 0) {
            <p class="px-4 py-3 text-xs text-fg-muted">No services to expose.</p>
          } @else {
            <ul class="divide-y divide-border">
              @for (f of exposed(); track f.id) {
                <li class="px-4 py-2 flex items-center justify-between gap-3">
                  <span class="font-mono text-xs text-fg truncate">{{ f.host }}</span>
                  <app-auth-pill [method]="f.auth_method"></app-auth-pill>
                </li>
              }
            </ul>
          }
        </section>

        <section class="border border-border rounded-md bg-surface">
          <header class="flex items-center justify-between px-4 h-10 border-b border-border">
            <span class="text-sm font-medium">Will not be exposed</span>
            <span class="text-xs text-fg-muted tabular-nums">{{ excluded().length }}</span>
          </header>
          @if (excluded().length === 0) {
            <p class="px-4 py-3 text-xs text-fg-muted">No services excluded.</p>
          } @else {
            <ul class="divide-y divide-border">
              @for (f of excluded(); track f.id) {
                <li class="px-4 py-2">
                  <div class="flex items-center justify-between gap-3">
                    <span class="font-mono text-xs text-fg-muted line-through truncate">{{ f.host }}</span>
                    <app-auth-pill [method]="f.auth_method"></app-auth-pill>
                  </div>
                </li>
              }
            </ul>
          }
        </section>
      </div>

      <div class="mt-6 flex justify-end">
        <app-button
          variant="primary"
          size="lg"
          [disabled]="submitMutation.isPending() || hasUnexcludedBlockers()"
          (click)="confirm()">
          {{ submitMutation.isPending() ? 'Saving…' : 'Confirm and save' }}
        </app-button>
      </div>
    }
  `
})
export class SubmitComponent {
  readonly icons = { Check, Copy };
  readonly id = input.required<string>();

  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly scanQuery = useScanDetailQuery(() => this.id());
  readonly findingsQuery = useFindingsQuery(() => this.id());
  readonly submitMutation = useSubmitScanMutation();

  readonly approvalId = signal<string | null>(null);

  readonly scan = computed(() => this.scanQuery.data());
  readonly findings = computed(() => this.findingsQuery.data() ?? []);

  readonly exposed = computed(() => this.findings().filter((f) => !f.excluded));
  readonly excluded = computed(() => this.findings().filter((f) => f.excluded));
  readonly hasUnexcludedBlockers = computed(() =>
    this.findings().some((f) => f.severity === 'blocker' && !f.excluded)
  );

  readonly shareLink = computed(() => {
    const a = this.approvalId();
    if (!a) return '';
    return `${window.location.origin}/approvals/${a}`;
  });

  confirm() {
    if (this.hasUnexcludedBlockers()) {
      this.toast.error('Cannot submit', 'Blockers must be excluded first.');
      return;
    }
    this.submitMutation.mutate(this.id(), {
      onSuccess: ({ approval_id }) => {
        this.approvalId.set(approval_id);
        this.toast.success('Approval recorded');
      },
      onError: () => this.toast.error('Submit failed')
    });
  }

  onCopied() {
    this.toast.info('Copied to clipboard');
  }
}
