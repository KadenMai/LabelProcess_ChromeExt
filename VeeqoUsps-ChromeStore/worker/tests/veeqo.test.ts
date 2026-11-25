import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizeUrl,
  callbackRedirectUri,
  createOAuthState,
  deleteVeeqoToken,
  exchangeCodeForToken,
  getVeeqoToken,
  parseOAuthState,
  saveVeeqoToken,
} from '../src/veeqo';
import { ALLOWED_EMAIL, createTestEnv } from './helpers/env';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('callbackRedirectUri', () => {
  it('appends callback path and strips trailing slash', () => {
    expect(callbackRedirectUri('https://auth.example.com/')).toBe(
      'https://auth.example.com/auth/veeqo/callback'
    );
  });
});

describe('buildAuthorizeUrl', () => {
  it('builds Veeqo authorize URL with required query params', () => {
    const env = createTestEnv();
    const url = new URL(
      buildAuthorizeUrl(env, 'https://auth.example.com/auth/veeqo/callback', 'state-value')
    );
    expect(url.origin + url.pathname).toBe('https://app.veeqo.com/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('veeqo-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://auth.example.com/auth/veeqo/callback'
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('state-value');
  });
});

describe('OAuth state create/parse', () => {
  it('round-trips a valid state and consumes nonce (one-time use)', async () => {
    const env = createTestEnv();
    const state = await createOAuthState(env, 'Allowed@Example.com');
    const payload = await parseOAuthState(env, state);
    expect(payload.email).toBe(ALLOWED_EMAIL);
    expect(payload.nonce).toBeTruthy();
    await expect(parseOAuthState(env, state)).rejects.toThrow(/not found|already used/i);
  });

  it('rejects malformed state', async () => {
    const env = createTestEnv();
    await expect(parseOAuthState(env, 'not-a-state')).rejects.toThrow('Invalid state');
  });

  it('rejects tampered signature', async () => {
    const env = createTestEnv();
    const state = await createOAuthState(env, ALLOWED_EMAIL);
    const [body] = state.split('.');
    await expect(parseOAuthState(env, `${body}.deadbeef`)).rejects.toThrow(
      'Invalid state signature'
    );
  });

  it('rejects expired state', async () => {
    const env = createTestEnv();
    const state = await createOAuthState(env, ALLOWED_EMAIL);
    const [body, sig] = state.split('.');
    const payload = JSON.parse(atob(body));
    payload.exp = Math.floor(Date.now() / 1000) - 10;
    const expiredBody = btoa(JSON.stringify(payload));
    // Re-sign with the real secret so signature check passes, then expiry fails
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(env.STATE_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(expiredBody));
    const newSig = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    // Keep nonce in KV from original create
    expect(sig).toBeTruthy();
    await expect(parseOAuthState(env, `${expiredBody}.${newSig}`)).rejects.toThrow('State expired');
  });
});

describe('Veeqo token KV store', () => {
  it('saves, reads, and deletes tokens keyed by email', async () => {
    const env = createTestEnv();
    const saved = await saveVeeqoToken(env, 'Allowed@Example.com', {
      access_token: 'veeqo-access',
      token_type: 'bearer',
      created_at: 1700000000,
    });
    expect(saved.email).toBe(ALLOWED_EMAIL);
    expect(saved.accessToken).toBe('veeqo-access');

    const got = await getVeeqoToken(env, ALLOWED_EMAIL);
    expect(got?.accessToken).toBe('veeqo-access');
    expect(got?.tokenType).toBe('bearer');

    await deleteVeeqoToken(env, ALLOWED_EMAIL);
    expect(await getVeeqoToken(env, ALLOWED_EMAIL)).toBeNull();
  });

  it('returns null when no token exists', async () => {
    const env = createTestEnv();
    expect(await getVeeqoToken(env, 'nobody@example.com')).toBeNull();
  });
});

describe('exchangeCodeForToken', () => {
  it('POSTs grant payload and returns access token JSON', async () => {
    const env = createTestEnv();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(_url)).toBe('https://api.veeqo.com/oauth/token');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        grant_type: 'authorization_code',
        code: 'auth-code',
        client_id: env.VEEQO_CLIENT_ID,
        client_secret: env.VEEQO_CLIENT_SECRET,
        redirect_uri: 'https://auth.test.workers.dev/auth/veeqo/callback',
      });
      return Response.json({
        access_token: 'permanent-token',
        token_type: 'bearer',
        created_at: 123,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const token = await exchangeCodeForToken(
      env,
      'auth-code',
      'https://auth.test.workers.dev/auth/veeqo/callback'
    );
    expect(token.access_token).toBe('permanent-token');
  });

  it('throws with status and body snippet on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('invalid_client', { status: 401 })));
    await expect(
      exchangeCodeForToken(createTestEnv(), 'bad', 'https://x/callback')
    ).rejects.toThrow(/Veeqo token exchange failed \(401\).*invalid_client/);
  });
});
