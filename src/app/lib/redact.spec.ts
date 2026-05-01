import { describe, it, expect } from 'vitest';
import { redact, redactObject } from './redact';

describe('redact', () => {
  it('redacts Authorization Bearer tokens', () => {
    expect(redact('Authorization: Bearer eyJabc.def.ghi')).toMatch(/redacted/);
  });
  it('redacts Cookie values', () => {
    expect(redact('Cookie: sid=abcdef')).toMatch(/redacted/);
  });
  it('walks objects recursively', () => {
    const out = redactObject({ a: { b: 'Authorization: Bearer eyJ.x.y' } });
    expect(JSON.stringify(out)).toMatch(/redacted/);
  });
});
