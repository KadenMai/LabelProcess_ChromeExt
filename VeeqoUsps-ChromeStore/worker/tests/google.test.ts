import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractBearer, verifyGoogleAccessToken } from '../src/google';
import { ALLOWED_EMAIL, createTestEnv, GOOGLE_CLIENT_ID } from './helpers/env';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('extractBearer', () => {
  it('returns null when Authorization header is missing', () => {
    expect(extractBearer(new Request('https://example.com'))).toBeNull();
  });

  it('parses Bearer tokens case-insensitively', () => {
    const req = new Request('https://example.com', {
      headers: { Authorization: 'bearer  abc.token  ' },
    });
    expect(extractBearer(req)).toBe('abc.token');
  });

  it('rejects non-Bearer schemes', () => {
    const req = new Request('https://example.com', {
      headers: { Authorization: 'Basic xyz' },
    });
    expect(extractBearer(req)).toBeNull();
  });
});

describe('verifyGoogleAccessToken', () => {
  const env = createTestEnv();

  it('returns identity for a valid allowlisted-style tokeninfo response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          email: 'Allowed@Example.com',
          sub: 'sub-1',
          azp: GOOGLE_CLIENT_ID,
          email_verified: 'true',
        })
      )
    );

    const identity = await verifyGoogleAccessToken(env, 'google-access-token');
    expect(identity).toEqual({ email: ALLOWED_EMAIL, sub: 'sub-1' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('throws when tokeninfo returns non-OK', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 400 })));
    await expect(verifyGoogleAccessToken(env, 'bad')).rejects.toThrow('Invalid Google access token');
  });

  it('throws when email/sub missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'invalid_token' })));
    await expect(verifyGoogleAccessToken(env, 'bad')).rejects.toThrow('Google token missing email');
  });

  it('throws on audience mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          email: ALLOWED_EMAIL,
          sub: 'sub-1',
          azp: 'other-client.apps.googleusercontent.com',
          aud: 'other-client.apps.googleusercontent.com',
          email_verified: 'true',
        })
      )
    );
    await expect(verifyGoogleAccessToken(env, 'tok')).rejects.toThrow('Google token audience mismatch');
  });

  it('throws when email is not verified', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          email: ALLOWED_EMAIL,
          sub: 'sub-1',
          azp: GOOGLE_CLIENT_ID,
          email_verified: 'false',
        })
      )
    );
    await expect(verifyGoogleAccessToken(env, 'tok')).rejects.toThrow('Google email is not verified');
  });

  it('skips audience check when GOOGLE_CLIENT_ID is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          email: 'anyone@example.com',
          sub: 'sub-9',
          azp: 'whatever',
          email_verified: 'true',
        })
      )
    );
    const identity = await verifyGoogleAccessToken(createTestEnv({ GOOGLE_CLIENT_ID: '' }), 'tok');
    expect(identity.email).toBe('anyone@example.com');
  });
});
