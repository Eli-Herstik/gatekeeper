import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'duration', standalone: true, pure: true })
export class DurationPipe implements PipeTransform {
  transform(ms: number | null | undefined): string {
    if (ms == null) return '—';
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    if (m < 60) return rs === 0 ? `${m}m` : `${m}m ${rs}s`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm === 0 ? `${h}h` : `${h}h ${rm}m`;
  }
}
