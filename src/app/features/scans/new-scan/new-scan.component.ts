import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
import { ScansApi } from '../data/scans.api';
import { useCreateScanMutation } from '../data/scans.queries';
import { ToastService } from '@shared/ui/toast.service';
import type { ScanSummary } from '@core/models';

interface NewScanForm {
  url: FormControl<string>;
  name: FormControl<string>;
  max_depth: FormControl<number>;
}

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

@Component({
  selector: 'app-new-scan',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="New scan" subtitle="Submit a target URL to scan for external service auth methods.">
    </app-page-header>

    <form
      [formGroup]="form"
      (ngSubmit)="submit()"
      class="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 max-w-5xl">
      <div class="space-y-3">
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

        <div class="space-y-1">
          <label for="name" class="block text-xs font-medium text-fg-muted">App name</label>
          <input
            id="name"
            type="text"
            formControlName="name"
            placeholder="Pre-exposure check"
            class="w-full h-9 px-3 text-sm rounded-md bg-surface border border-border focus:border-border-strong outline-none" />
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
          <app-button type="submit" variant="primary" size="md" [disabled]="form.invalid || mutation.isPending()">
            {{ mutation.isPending() ? 'Submitting…' : 'Start scan' }}
          </app-button>
          <a href="/" class="text-xs text-fg-muted hover:text-fg ml-2">Cancel</a>
        </div>
      </div>
    </form>
  `
})
export class NewScanComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly router = inject(Router);
  private readonly api = inject(ScansApi);
  private readonly toast = inject(ToastService);

  readonly mutation = useCreateScanMutation();

  readonly form: FormGroup<NewScanForm> = this.fb.group<NewScanForm>({
    url: this.fb.control('', [Validators.required, Validators.pattern(URL_PATTERN)]),
    name: this.fb.control(''),
    max_depth: this.fb.control(3, [Validators.min(1), Validators.max(10)])
  });

  readonly urlError = signal<string>('');

  submit() {
    this.urlError.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const url = this.form.controls.url;
      if (url.errors?.['required']) this.urlError.set('Target URL is required.');
      else if (url.errors?.['pattern']) this.urlError.set('Must be a valid http(s) URL.');
      return;
    }

    const v = this.form.getRawValue();

    this.mutation.mutate(
      {
        url: v.url,
        name: v.name || undefined,
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
