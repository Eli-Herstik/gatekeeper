import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { ButtonComponent } from '@shared/ui/button.component';
import { useAppsListQuery, useCreateScanMutation } from '../data/scans.queries';
import { ToastService } from '@shared/ui/toast.service';

interface NewScanForm {
  url: FormControl<string>;
  max_depth: FormControl<number>;
}

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

@Component({
  selector: 'app-new-scan',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="headerTitle()" subtitle="Submit a target URL to scan for external service auth methods.">
    </app-page-header>

    <form
      [formGroup]="form"
      (ngSubmit)="submit()"
      class="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 max-w-5xl">
      <div class="space-y-3">
        @if (!appId()) {
          <div class="space-y-1">
            <label for="app" class="block text-xs font-medium text-fg-muted">App</label>
            <select
              id="app"
              [value]="selectedAppId()"
              (change)="onAppPicked($any($event.target).value)"
              class="w-full h-9 px-2 text-sm rounded-md bg-surface border border-border focus:border-border-strong outline-none">
              <option value="">— pick an app —</option>
              @for (a of apps(); track a.id) {
                <option [value]="a.id">{{ a.name }}</option>
              }
            </select>
            @if (appError()) {
              <p class="text-xs text-danger">{{ appError() }}</p>
            }
          </div>
        }

        <div class="space-y-1">
          <label for="url" class="block text-xs font-medium text-fg-muted">Target URL</label>
          <input
            id="url"
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

        <div class="space-y-1 max-w-[200px]">
          <label for="max_depth" class="block text-xs font-medium text-fg-muted">Max depth</label>
          <input
            id="max_depth"
            type="number"
            min="1"
            max="10"
            formControlName="max_depth"
            class="w-full h-9 px-3 text-sm rounded-md bg-surface border border-border focus:border-border-strong outline-none tabular-nums" />
        </div>

        <div class="flex items-center gap-2 pt-4">
          <app-button type="submit" variant="primary" size="md" [disabled]="mutation.isPending()">
            {{ mutation.isPending() ? 'Submitting…' : 'Start scan' }}
          </app-button>
          <a href="/" class="text-xs text-fg-muted hover:text-fg ml-2">Cancel</a>
        </div>
      </div>
    </form>
  `
})
export class NewScanComponent {
  readonly appId = input<string>('');

  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly mutation = useCreateScanMutation();
  readonly appsQuery = useAppsListQuery();
  readonly apps = computed(() => this.appsQuery.data() ?? []);

  readonly selectedAppId = signal<string>('');

  readonly headerTitle = computed(() => {
    const id = this.selectedAppId() || this.appId();
    const app = this.apps().find((a) => a.id === id);
    return app ? `New scan — ${app.name}` : 'New scan';
  });

  readonly form: FormGroup<NewScanForm> = this.fb.group<NewScanForm>({
    url: this.fb.control('', [Validators.required, Validators.pattern(URL_PATTERN)]),
    max_depth: this.fb.control(3, [Validators.min(1), Validators.max(10)])
  });

  readonly urlError = signal<string>('');
  readonly appError = signal<string>('');

  constructor() {
    // Hydrate from route + apps cache: when entering via /apps/:appId/scans/new,
    // pre-select the app and seed the URL from it (unless user has edited).
    effect(() => {
      const routeAppId = this.appId();
      const apps = this.apps();
      if (!routeAppId) return;
      if (this.selectedAppId() !== routeAppId) {
        this.selectedAppId.set(routeAppId);
      }
      const app = apps.find((a) => a.id === routeAppId);
      if (app && !this.form.controls.url.dirty) {
        this.form.controls.url.setValue(app.url);
      }
    });
  }

  onAppPicked(id: string) {
    this.selectedAppId.set(id);
    this.appError.set('');
    const app = this.apps().find((a) => a.id === id);
    if (app) {
      this.form.controls.url.setValue(app.url);
      this.form.controls.url.markAsPristine();
    }
  }

  submit() {
    this.urlError.set('');
    this.appError.set('');

    const appId = this.selectedAppId() || this.appId();
    const formInvalid = this.form.invalid;

    if (!appId) {
      this.appError.set('Pick an app first.');
    }
    if (formInvalid) {
      this.form.markAllAsTouched();
      const url = this.form.controls.url;
      if (url.errors?.['required']) this.urlError.set('Target URL is required.');
      else if (url.errors?.['pattern']) this.urlError.set('Must be a valid http(s) URL.');
    }
    if (!appId || formInvalid) return;

    const v = this.form.getRawValue();

    this.mutation.mutate(
      {
        app_id: appId,
        url: v.url,
        max_depth: v.max_depth
      },
      {
        onSuccess: ({ scan_id }) => {
          this.toast.success('Scan submitted', `Tracking ${scan_id}`);
          this.router.navigate(['/scans', scan_id]);
        },
        onError: () => {
          this.toast.error('Failed to submit scan', 'Please try again.');
        }
      }
    );
  }
}
