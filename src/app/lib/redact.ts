/**
 * Defensive client-side redaction for evidence snippets and event payloads.
 * Server is authoritative on redaction, but we *also* redact in the UI so a
 * misconfigured backend can't leak credentials to the browser console / DOM.
 *
 * Patterns chosen to be conservative — false positives are preferable to
 * leaking a secret.
 */
const PATTERNS: Array<[RegExp, string]> = [
  // Authorization: Bearer <token>
  [/\b(authorization\s*:\s*bearer\s+)([A-Za-z0-9._\-]+)/gi, '$1***redacted***'],
  // Basic auth base64
  [/\b(authorization\s*:\s*basic\s+)([A-Za-z0-9+/=]+)/gi, '$1***redacted***'],
  // NTLM challenge token
  [/\b(authorization\s*:\s*ntlm\s+)([A-Za-z0-9+/=]+)/gi, '$1***redacted***'],
  // Cookie: name=value
  [/\b(cookie\s*:\s*[\w-]+=)([^;\s]+)/gi, '$1***redacted***'],
  // Set-Cookie: name=value
  [/\b(set-cookie\s*:\s*[\w-]+=)([^;\s]+)/gi, '$1***redacted***'],
  // Long bearer-like tokens in any context (eyJ... JWT)
  [/\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b/g, '***redacted-jwt***'],
  // Generic api_key= / token=
  [/\b((?:api[_-]?key|token|secret)\s*[:=]\s*)([A-Za-z0-9._\-]{8,})/gi, '$1***redacted***']
];

export function redact(input: string): string {
  if (!input) return input;
  let out = input;
  for (const [re, repl] of PATTERNS) out = out.replace(re, repl);
  return out;
}

export function redactObject<T>(obj: T): T {
  if (typeof obj === 'string') return redact(obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map(redactObject) as unknown as T;
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = redactObject(v);
    }
    return result as T;
  }
  return obj;
}
