import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'relativeTime', standalone: true, pure: true })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined): string {
    if (value == null) return '—';
    const t = typeof value === 'string' ? Date.parse(value) : value instanceof Date ? value.getTime() : value;
    const diff = Date.now() - t;
    const abs = Math.abs(diff);
    if (abs < 60_000) return diff >= 0 ? 'just now' : 'in a moment';
    const past = diff >= 0;
    const m = Math.floor(abs / 60_000);
    if (m < 60) return past ? `${m}m ago` : `in ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return past ? `${h}h ago` : `in ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 30) return past ? `${d}d ago` : `in ${d}d`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return past ? `${mo}mo ago` : `in ${mo}mo`;
    return new Date(t).toISOString().slice(0, 10);
  }
}
