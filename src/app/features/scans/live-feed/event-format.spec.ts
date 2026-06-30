import { describe, expect, it } from 'vitest';
import { formatEvent } from './event-format';
import type { ScanEvent } from '@core/models';

describe('formatEvent', () => {
  it('produces an ERROR line for blocker_found', () => {
    const evt: ScanEvent = {
      scan_id: 's',
      seq: '1',
      ts: Date.UTC(2024, 0, 1, 14, 32, 8, 44),
      type: 'blocker_found',
      payload: { host: 'auth.contoso.com', reason: 'ntlm — disallowed auth method' }
    };
    const line = formatEvent(evt);
    expect(line.type).toBe('ERROR');
    expect(line.host).toBe('auth.contoso.com');
    expect(line.message).toContain('disallowed');
  });
  it('produces an INFO line for auth_detected', () => {
    const evt: ScanEvent = {
      scan_id: 's',
      seq: '2',
      ts: Date.now(),
      type: 'auth_detected',
      payload: { host: 'api.contoso.com', method: 'ntlm' }
    };
    expect(formatEvent(evt).type).toBe('INFO');
    expect(formatEvent(evt).message).toContain('detected');
    expect(formatEvent(evt).message).toContain('ntlm detected');
  });
});
