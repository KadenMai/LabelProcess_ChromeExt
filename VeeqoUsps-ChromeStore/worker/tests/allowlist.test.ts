import { describe, expect, it } from 'vitest';
import { isEmailAllowed, parseAllowlist } from '../src/allowlist';
import { createTestEnv } from './helpers/env';

describe('parseAllowlist', () => {
  it('returns empty set for undefined/blank', () => {
    expect(parseAllowlist(undefined).size).toBe(0);
    expect(parseAllowlist('').size).toBe(0);
    expect(parseAllowlist('   ').size).toBe(0);
  });

  it('splits, trims, and lowercases emails', () => {
    const set = parseAllowlist(' Alice@Example.com , bob@test.com,, ');
    expect(set.has('alice@example.com')).toBe(true);
    expect(set.has('bob@test.com')).toBe(true);
    expect(set.size).toBe(2);
  });
});

describe('isEmailAllowed', () => {
  it('fails closed when allowlist is empty', () => {
    const env = createTestEnv({ ALLOWED_EMAILS: '' });
    expect(isEmailAllowed(env, 'anyone@example.com')).toBe(false);
  });

  it('matches case-insensitively against configured emails', () => {
    const env = createTestEnv({ ALLOWED_EMAILS: 'Allowed@Example.com' });
    expect(isEmailAllowed(env, 'allowed@example.com')).toBe(true);
    expect(isEmailAllowed(env, 'ALLOWED@EXAMPLE.COM')).toBe(true);
    expect(isEmailAllowed(env, ' other@example.com ')).toBe(false);
  });

  it('supports comma-separated lists', () => {
    const env = createTestEnv({ ALLOWED_EMAILS: 'a@x.com,b@y.com' });
    expect(isEmailAllowed(env, 'b@y.com')).toBe(true);
    expect(isEmailAllowed(env, 'c@z.com')).toBe(false);
  });
});
