import { describe, it, expect } from 'vitest';
import { RelativeTimePipe } from './relative-time.pipe';

describe('RelativeTimePipe', () => {
  const pipe = new RelativeTimePipe();
  it('returns "just now" for very recent times', () => {
    expect(pipe.transform(Date.now() - 1000)).toBe('just now');
  });
  it('returns minutes ago for the recent past', () => {
    expect(pipe.transform(Date.now() - 1000 * 60 * 5)).toBe('5m ago');
  });
  it('returns hours ago for hours ago', () => {
    expect(pipe.transform(Date.now() - 1000 * 60 * 60 * 3)).toBe('3h ago');
  });
});
