import type { Env } from '../../src/types';
import { createMemoryKv } from './memoryKv';

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    SESSIONS: createMemoryKv(),
    ALLOWED_EMAILS: 'allowed@example.com, Other@Example.com',
    VEEQO_CLIENT_ID: 'veeqo-client-id',
    VEEQO_CLIENT_SECRET: 'veeqo-client-secret',
    GOOGLE_CLIENT_ID: 'chrome-ext-client.apps.googleusercontent.com',
    STATE_SECRET: 'test-state-secret-please-change',
    PUBLIC_BASE_URL: 'https://auth.test.workers.dev',
    ...overrides,
  };
}

export const ALLOWED_EMAIL = 'allowed@example.com';
export const GOOGLE_CLIENT_ID = 'chrome-ext-client.apps.googleusercontent.com';

/** Mock Google tokeninfo to succeed for a given email. */
export function mockGoogleTokenInfoOk(email = ALLOWED_EMAIL, azp = GOOGLE_CLIENT_ID) {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com/tokeninfo')) {
      return Response.json({
        email,
        sub: 'google-sub-1',
        azp,
        aud: azp,
        email_verified: 'true',
      });
    }
    return new Response('unexpected fetch', { status: 500 });
  };
}
