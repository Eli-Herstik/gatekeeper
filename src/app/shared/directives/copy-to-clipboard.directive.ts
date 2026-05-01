import { Directive, HostListener, input, output } from '@angular/core';

@Directive({
  selector: '[appCopyToClipboard]',
  standalone: true
})
export class CopyToClipboardDirective {
  readonly value = input.required<string>({ alias: 'appCopyToClipboard' });
  readonly copied = output<string>();
  readonly failed = output<unknown>();

  @HostListener('click')
  async onClick() {
    try {
      await navigator.clipboard.writeText(this.value());
      this.copied.emit(this.value());
    } catch (err) {
      this.failed.emit(err);
    }
  }
}
