import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { useAppsListQuery, useCreateAppMutation } from '../data/scans.queries';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { SkeletonComponent } from '@shared/components/skeleton.component';
import { ButtonComponent } from '@shared/ui/button.component';
import { ToastService } from '@shared/ui/toast.service';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import type { ExposureState } from '@core/models';

const EXPOSURE_FILTERS: { key: ExposureState | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'ready_for_submission', label: 'Ready for submission' },
  { key: 'failed', label: 'Failed' },
  { key: 'never_scanned', label: 'Never scanned' }
];

const EXPOSURE_LABELS: Record<ExposureState, string> = {
  submitted: 'Submitted',
  blocked: 'Blocked',
  ready_for_submission: 'Ready for submission',
  failed: 'Failed',
  never_scanned: 'Never scanned'
};

const EXPOSURE_DOT: Record<ExposureState, string> = {
  submitted: 'var(--color-success)',
  blocked: 'var(--color-danger)',
  ready_for_submission: 'var(--color-info)',
  failed: 'var(--color-danger)',
  never_scanned: 'var(--color-fg-muted)'
};

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

interface NewAppForm {
  name: FormControl<string>;
  url: FormControl<string>;
  owner_ad_group: FormControl<string>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    SkeletonComponent,
    ButtonComponent,
    RelativeTimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Apps awaiting exposure"
      subtitle="On-prem apps that are candidates for F5 exposure.">
      <app-button variant="primary" size="md" (click)="openCreate()">
        + Add new app
      </app-button>
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
                <td class="px-4 h-10 font-mono text-xs text-fg-muted truncate max-w-md">
                  @if (a.url) {
                    {{ a.url }}
                  } @else {
                    <span class="text-fg-subtle">—</span>
                  }
                </td>
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
                <td class="px-4 h-10 text-fg-muted">{{ a.owner_ad_group }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (createOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        role="button"
        tabindex="0"
        aria-label="Close dialog"
        (click)="closeCreate()"
        (keydown.escape)="closeCreate()"
        (keydown.enter)="closeCreate()"
        (keydown.space)="$event.preventDefault(); closeCreate()">
        <div
          class="w-full max-w-md mx-4 rounded-md bg-surface border border-border shadow-lg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-app-title"
          (click)="$event.stopPropagation()"
          (keydown.enter)="$event.stopPropagation()"
          (keydown.space)="$event.stopPropagation()">
          <header class="flex items-center justify-between px-4 h-11 border-b border-border">
            <h2 id="add-app-title" class="text-sm font-semibold text-fg">Add new app</h2>
            <button
              type="button"
              class="text-fg-muted hover:text-fg text-lg leading-none"
              aria-label="Close"
              (click)="closeCreate()">×</button>
          </header>
          <form [formGroup]="createForm" (ngSubmit)="submitCreate()" class="p-4 space-y-3">
            <div class="space-y-1">
              <label for="app-name" class="block text-xs font-medium text-fg-muted">App name</label>
              <input
                id="app-name"
                type="text"
                formControlName="name"
                placeholder="e.g. HR Portal"
                class="w-full h-9 px-3 text-sm rounded-md bg-surface border border-border focus:border-border-strong outline-none placeholder:text-fg-subtle"
                autocomplete="off" />
              <p class="text-xs text-fg-subtle">required</p>
              @if (nameError()) {
                <p class="text-xs text-danger">{{ nameError() }}</p>
              }
            </div>

            <div class="space-y-1">
              <label for="app-url" class="block text-xs font-medium text-fg-muted">URL</label>
              <input
                id="app-url"
                type="text"
                formControlName="url"
                placeholder="https://app.intranet.contoso.com"
                class="w-full h-9 px-3 text-sm font-mono rounded-md bg-surface border border-border focus:border-border-strong outline-none placeholder:text-fg-subtle"
                autocomplete="off"
                spellcheck="false" />
              <p class="text-xs text-fg-subtle">required</p>
              @if (urlError()) {
                <p class="text-xs text-danger">{{ urlError() }}</p>
              }
            </div>

            <div class="space-y-1">
              <label for="app-owner" class="block text-xs font-medium text-fg-muted">Owning team — AD group</label>
              <input
                id="app-owner"
                type="text"
                formControlName="owner_ad_group"
                placeholder="CONTOSO\\App-Owners-HR"
                class="w-full h-9 px-3 text-sm font-mono rounded-md bg-surface border border-border focus:border-border-strong outline-none placeholder:text-fg-subtle"
                autocomplete="off"
                spellcheck="false" />
              <p class="text-xs text-fg-subtle">required</p>
              @if (groupError()) {
                <p class="text-xs text-danger">{{ groupError() }}</p>
              }
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <app-button variant="ghost" size="md" (click)="closeCreate()">Cancel</app-button>
              <app-button type="submit" variant="primary" size="md" [disabled]="createMutation.isPending()">
                {{ createMutation.isPending() ? 'Creating…' : 'Create app' }}
              </app-button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class DashboardComponent {
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly toast = inject(ToastService);

  readonly query = useAppsListQuery();
  readonly createMutation = useCreateAppMutation();
  readonly filter = signal<ExposureState | 'all'>('all');
  readonly filters = EXPOSURE_FILTERS;
  readonly skel = Array(5).fill(0);

  readonly createOpen = signal(false);
  readonly nameError = signal('');
  readonly urlError = signal('');
  readonly groupError = signal('');

  readonly createForm: FormGroup<NewAppForm> = this.fb.group<NewAppForm>({
    name: this.fb.control('', [Validators.required]),
    url: this.fb.control('', [Validators.required, Validators.pattern(URL_PATTERN)]),
    owner_ad_group: this.fb.control('', [Validators.required])
  });

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

  openCreate() {
    this.createForm.reset({ name: '', url: '', owner_ad_group: '' });
    this.nameError.set('');
    this.urlError.set('');
    this.groupError.set('');
    this.createOpen.set(true);
  }

  closeCreate() {
    if (this.createMutation.isPending()) return;
    this.createOpen.set(false);
  }

  submitCreate() {
    this.nameError.set('');
    this.urlError.set('');
    this.groupError.set('');

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      const c = this.createForm.controls;
      if (c.name.errors?.['required']) this.nameError.set('App name is required.');
      if (c.url.errors?.['required']) this.urlError.set('URL is required.');
      else if (c.url.errors?.['pattern']) this.urlError.set('Must be a valid http(s) URL.');
      if (c.owner_ad_group.errors?.['required']) this.groupError.set('AD group is required.');
      return;
    }

    const v = this.createForm.getRawValue();
    this.createMutation.mutate(
      {
        name: v.name.trim(),
        url: v.url.trim(),
        owner_ad_group: v.owner_ad_group.trim()
      },
      {
        onSuccess: (app) => {
          this.toast.success('App created', app.name);
          this.createOpen.set(false);
        },
        onError: () => {
          this.toast.error('Failed to create app', 'Please try again.');
        }
      }
    );
  }
}
