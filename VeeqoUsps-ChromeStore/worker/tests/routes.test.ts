import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { createOAuthState, saveVeeqoToken } from '../src/veeqo';
import {
  ALLOWED_EMAIL,
  createTestEnv,
  GOOGLE_CLIENT_ID,
  mockGoogleTokenInfoOk,
} from './helpers/env';

const BASE = 'https://auth.test.workers.dev';

function authReq(path: string, token = 'google-token', init: RequestInit = {}) {
  return new Request(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Worker routes — health / home / CORS / 404', () => {
  it('GET /health returns ok', async () => {
    const res = await worker.fetch(new Request(`${BASE}/health`), createTestEnv(), {} as ExecutionContext);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('GET / returns HTML landing page', async () => {
    const res = await worker.fetch(new Request(`${BASE}/`), createTestEnv(), {} as ExecutionContext);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(await res.text()).toContain('Veeqo USPS Auth Worker');
  });

  it('OPTIONS returns CORS preflight', async () => {
    const res = await worker.fetch(
      new Request(`${BASE}/api/me`, {
        method: 'OPTIONS',
        headers: { Origin: 'chrome-extension://abc' },
      }),
      createTestEnv(),
      {} as ExecutionContext
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('chrome-extension://abc');
  });

  it('unknown path returns 404 JSON', async () => {
    const res = await worker.fetch(new Request(`${BASE}/nope`), createTestEnv(), {} as ExecutionContext);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});

describe('Process: Google sign-in + allowlist (/api/me)', () => {
  it('returns 401 without Authorization', async () => {
    const res = await worker.fetch(
      new Request(`${BASE}/api/me`),
      createTestEnv(),
      {} as ExecutionContext
    );
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toMatch(/Missing Google access token/i);
  });

  it('returns 403 when email is not allowlisted', async () => {
    vi.stubGlobal('fetch', mockGoogleTokenInfoOk('stranger@example.com'));
    const res = await worker.fetch(authReq('/api/me'), createTestEnv(), {} as ExecutionContext);
    expect(res.status).toBe(403);
    expect((await res.json() as { error: string }).error).toMatch(/not allowlisted/i);
  });

  it('returns session when allowlisted and Veeqo not connected', async () => {
    vi.stubGlobal('fetch', mockGoogleTokenInfoOk());
    const res = await worker.fetch(authReq('/api/me'), createTestEnv(), {} as ExecutionContext);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      email: ALLOWED_EMAIL,
      allowed: true,
      veeqoConnected: false,
      connectedAt: null,
    });
  });

  it('returns veeqoConnected true when token exists in KV', async () => {
    const env = createTestEnv();
    await saveVeeqoToken(env, ALLOWED_EMAIL, {
      access_token: 'veeqo-tok',
      token_type: 'bearer',
      created_at: 1,
    });
    vi.stubGlobal('fetch', mockGoogleTokenInfoOk());
    const res = await worker.fetch(authReq('/api/me'), env, {} as ExecutionContext);
    const body = (await res.json()) as {
      veeqoConnected: boolean;
      connectedAt: number | null;
    };
    expect(body.veeqoConnected).toBe(true);
    expect(typeof body.connectedAt).toBe('number');
  });
});

describe('Process: sync Veeqo token (/api/veeqo/token)', () => {
  it('404 when Veeqo not connected', async () => {
    vi.stubGlobal('fetch', mockGoogleTokenInfoOk());
    const res = await worker.fetch(authReq('/api/veeqo/token'), createTestEnv(), {} as ExecutionContext);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Veeqo not connected' });
  });

  it('returns access token when connected', async () => {
    const env = createTestEnv();
    await saveVeeqoToken(env, ALLOWED_EMAIL, {
      access_token: 'veeqo-secret',
      token_type: 'bearer',
      created_at: 99,
    });
    vi.stubGlobal('fetch', mockGoogleTokenInfoOk());
    const res = await worker.fetch(authReq('/api/veeqo/token'), env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string; tokenType: string };
    expect(body.accessToken).toBe('veeqo-secret');
    expect(body.tokenType).toBe('bearer');
  });
});

describe('Process: disconnect Veeqo (/api/veeqo/disconnect)', () => {
  it('removes stored token', async () => {
    const env = createTestEnv();
    await saveVeeqoToken(env, ALLOWED_EMAIL, {
      access_token: 'veeqo-secret',
      token_type: 'bearer',
    });
    vi.stubGlobal('fetch', mockGoogleTokenInfoOk());

    const disconnect = await worker.fetch(
      authReq('/api/veeqo/disconnect', 'google-token', { method: 'POST' }),
      env,
      {} as ExecutionContext
    );
    expect(disconnect.status).toBe(200);
    expect(await disconnect.json()).toEqual({ ok: true });

    const tokenRes = await worker.fetch(authReq('/api/veeqo/token'), env, {} as ExecutionContext);
    expect(tokenRes.status).toBe(404);
  });
});

describe('Process: Connect Veeqo OAuth start → callback', () => {
  it('start without token returns HTML 400', async () => {
    const res = await worker.fetch(
      new Request(`${BASE}/auth/veeqo/start`),
      createTestEnv(),
      {} as ExecutionContext
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Missing Google token');
  });

  it('start redirects to Veeqo authorize URL for allowlisted user', async () => {
    vi.stubGlobal('fetch', mockGoogleTokenInfoOk());
    const env = createTestEnv();
    const res = await worker.fetch(
      new Request(`${BASE}/auth/veeqo/start?token=google-token`),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(302);
    const location = res.headers.get('Location')!;
    expect(location.startsWith('https://app.veeqo.com/oauth/authorize?')).toBe(true);
    const u = new URL(location);
    expect(u.searchParams.get('client_id')).toBe(env.VEEQO_CLIENT_ID);
    expect(u.searchParams.get('redirect_uri')).toBe(`${BASE}/auth/veeqo/callback`);
    expect(u.searchParams.get('state')).toBeTruthy();
  });

  it('start returns 500 HTML when Worker secrets missing', async () => {
    vi.stubGlobal('fetch', mockGoogleTokenInfoOk());
    const env = createTestEnv({ VEEQO_CLIENT_ID: '', VEEQO_CLIENT_SECRET: '' });
    const res = await worker.fetch(
      new Request(`${BASE}/auth/veeqo/start?token=google-token`),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('Worker is not configured');
  });

  it('callback with error param shows denial page', async () => {
    const res = await worker.fetch(
      new Request(`${BASE}/auth/veeqo/callback?error=access_denied`),
      createTestEnv(),
      {} as ExecutionContext
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('authorization denied');
  });

  it('callback without code/state returns 400', async () => {
    const res = await worker.fetch(
      new Request(`${BASE}/auth/veeqo/callback`),
      createTestEnv(),
      {} as ExecutionContext
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Missing code or state');
  });

  it('full OAuth callback exchanges code, stores token, shows success', async () => {
    const env = createTestEnv();
    const state = await createOAuthState(env, ALLOWED_EMAIL);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('api.veeqo.com/oauth/token')) {
          return Response.json({
            access_token: 'veeqo-from-oauth',
            token_type: 'bearer',
            created_at: 42,
          });
        }
        return new Response('unexpected', { status: 500 });
      })
    );

    const res = await worker.fetch(
      new Request(`${BASE}/auth/veeqo/callback?code=abc&state=${encodeURIComponent(state)}`),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Veeqo connected');
    expect(html).toContain(ALLOWED_EMAIL);

    // Token available via API after callback
    vi.stubGlobal('fetch', mockGoogleTokenInfoOk());
    const tokenRes = await worker.fetch(authReq('/api/veeqo/token'), env, {} as ExecutionContext);
    expect(tokenRes.status).toBe(200);
    expect((await tokenRes.json() as { accessToken: string }).accessToken).toBe('veeqo-from-oauth');
  });

  it('callback rejects when state email is not allowlisted', async () => {
    const env = createTestEnv({ ALLOWED_EMAILS: 'only@allowed.com' });
    // Craft state for a non-allowlisted email (simulate stolen/old state)
    const state = await createOAuthState(env, 'intruder@example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ access_token: 'x', token_type: 'bearer' })
      )
    );
    const res = await worker.fetch(
      new Request(`${BASE}/auth/veeqo/callback?code=abc&state=${encodeURIComponent(state)}`),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(403);
    expect(await res.text()).toContain('not allowlisted');
  });
});

describe('Audience wiring', () => {
  it('rejects Google tokens with wrong client audience on /api/me', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          email: ALLOWED_EMAIL,
          sub: '1',
          azp: 'wrong.apps.googleusercontent.com',
          aud: 'wrong.apps.googleusercontent.com',
          email_verified: 'true',
        })
      )
    );
    const res = await worker.fetch(authReq('/api/me'), createTestEnv(), {} as ExecutionContext);
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toMatch(/audience mismatch/i);
  });

  it('accepts matching GOOGLE_CLIENT_ID via azp', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          email: ALLOWED_EMAIL,
          sub: '1',
          azp: GOOGLE_CLIENT_ID,
          email_verified: 'true',
        })
      )
    );
    const res = await worker.fetch(authReq('/api/me'), createTestEnv(), {} as ExecutionContext);
    expect(res.status).toBe(200);
  });
});
