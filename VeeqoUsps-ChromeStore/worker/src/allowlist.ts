import type { Env } from './types';

export function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isEmailAllowed(env: Env, email: string): boolean {
  const allow = parseAllowlist(env.ALLOWED_EMAILS);
  if (allow.size === 0) {
    // Fail closed when no allowlist is configured
    return false;
  }
  return allow.has(email.trim().toLowerCase());
}
