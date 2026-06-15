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
  max_depth: FormControl<number>;
  password: FormControl<string>;
}

@Component({
  selector: 'app-new-scan',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="headerTitle()" subtitle="Pick an app to scan its URL for external service auth methods.">
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

        @if (targetUrl()) {
          <div class="space-y-1">
            <span class="block text-xs font-medium text-fg-muted">Target URL</span>
            <p
              class="w-full h-9 px-3 text-sm font-mono rounded-md bg-surface-2 border border-border flex items-center text-fg-muted truncate">
              {{ targetUrl() }}
            </p>
            <p class="text-xs text-fg-subtle">scans the app's configured URL</p>
          </div>
        }

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

        <div class="space-y-1 max-w-[320px]">
          <label for="password" class="block text-xs font-medium text-fg-muted">Password</label>
          <input
            id="password"
            type="password"
            autocomplete="off"
            formControlName="password"
            class="w-full h-9 px-3 text-sm rounded-md bg-surface border border-border focus:border-border-strong outline-none" />
          @if (form.controls.password.touched && form.controls.password.invalid) {
            <p class="text-xs text-danger">Password is required.</p>
          } @else {
            <p class="text-xs text-fg-subtle">used to authenticate against the target</p>
          }
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

  // The URL the scan will target, derived from the selected app and shown
  // read-only so the user can confirm what gets scanned. The backend resolves
  // the app's URL itself, so it's never submitted from this form.
  readonly targetUrl = computed(() => {
    const id = this.selectedAppId() || this.appId();
    return this.apps().find((a) => a.id === id)?.url ?? '';
  });

  readonly form: FormGroup<NewScanForm> = this.fb.group<NewScanForm>({
    max_depth: this.fb.control(3, [Validators.min(1), Validators.max(10)]),
    password: this.fb.control('', [Validators.required])
  });

  readonly appError = signal<string>('');

  constructor() {
    // Hydrate from the route: when entering via /apps/:appId/scans/new,
    // pre-select the app so its URL resolves for the read-only preview.
    effect(() => {
      const routeAppId = this.appId();
      if (!routeAppId) return;
      if (this.selectedAppId() !== routeAppId) {
        this.selectedAppId.set(routeAppId);
      }
    });
  }

  onAppPicked(id: string) {
    this.selectedAppId.set(id);
    this.appError.set('');
  }

  submit() {
    this.appError.set('');

    const appId = this.selectedAppId() || this.appId();
    if (!appId) {
      this.appError.set('Pick an app first.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    this.mutation.mutate(
      {
        app_id: appId,
        max_depth: v.max_depth,
        password: v.password
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
