import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncStorage } from '../tests/setup';
import { DEFAULT_AUTH_WORKER_URL, STORAGE_KEYS } from './authConfig';
import {
  disconnectVeeqo,
  fetchAuthStatus,
  getGoogleAuthToken,
  openConnectVeeqoTab,
  saveWorkerUrl,
  signOutGoogle,
  syncVeeqoAccessToken,
} from './workerAuth';

const WORKER = 'https://auth.example.workers.dev';

beforeEach(async () => {
  syncStorage._reset();
  await chrome.storage.sync.set({ [STORAGE_KEYS.workerUrl]: WORKER });
});

describe('getGoogleAuthToken', () => {
  it('resolves token string from chrome.identity', async () => {
    await expect(getGoogleAuthToken(true)).resolves.toBe('google-access-token');
    expect(chrome.identity.getAuthToken).toHaveBeenCalledWith(
      { interactive: true },
      expect.any(Function)
    );
  });

  it('rejects when chrome.runtime.lastError is set', async () => {
    (chrome.identity.getAuthToken as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_d: unknown, cb: (t?: string) => void) => {
        chrome.runtime.lastError = { message: 'User cancelled' };
        cb(undefined);
      }
    );
    await expect(getGoogleAuthToken(true)).rejects.toThrow('User cancelled');
    chrome.runtime.lastError = undefined;
  });
});

describe('saveWorkerUrl', () => {
  it('trims and strips trailing slash; falls back to default', async () => {
    await saveWorkerUrl(' https://x.workers.dev/ ');
    expect(await chrome.storage.sync.get([STORAGE_KEYS.workerUrl])).toEqual({
      [STORAGE_KEYS.workerUrl]: 'https://x.workers.dev',
    });

    await saveWorkerUrl('   ');
    expect(await chrome.storage.sync.get([STORAGE_KEYS.workerUrl])).toEqual({
      [STORAGE_KEYS.workerUrl]: DEFAULT_AUTH_WORKER_URL,
    });
  });
});

describe('fetchAuthStatus', () => {
  it('returns signed-in allowlisted status and stores email', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        expect(String(url)).toBe(`${WORKER}/api/me`);
        return Response.json({
          email: 'user@example.com',
          allowed: true,
          veeqoConnected: true,
          connectedAt: 1000,
        });
      })
    );

    const status = await fetchAuthStatus(false);
    expect(status).toMatchObject({
      googleSignedIn: true,
      email: 'user@example.com',
      allowed: true,
      veeqoConnected: true,
      connectedAt: 1000,
      workerUrl: WORKER,
    });
    expect(await chrome.storage.sync.get([STORAGE_KEYS.googleEmail])).toEqual({
      [STORAGE_KEYS.googleEmail]: 'user@example.com',
    });
  });

  it('maps Worker error responses to AuthStatus.error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'Email is not allowlisted' }, { status: 403 }))
    );
    const status = await fetchAuthStatus(false);
    expect(status.googleSignedIn).toBe(true);
    expect(status.allowed).toBe(false);
    expect(status.error).toMatch(/not allowlisted/i);
  });

  it('returns googleSignedIn false when getAuthToken fails', async () => {
    (chrome.identity.getAuthToken as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_d: unknown, cb: (t?: string) => void) => {
        chrome.runtime.lastError = { message: 'not signed in' };
        cb(undefined);
      }
    );
    const status = await fetchAuthStatus(false);
    expect(status.googleSignedIn).toBe(false);
    expect(status.error).toMatch(/not signed in/i);
    chrome.runtime.lastError = undefined;
  });
});

describe('syncVeeqoAccessToken', () => {
  it('stores token from Worker', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ accessToken: 'veeqo-bearer', connectedAt: 55, tokenType: 'bearer' })
      )
    );
    await expect(syncVeeqoAccessToken(false)).resolves.toBe('veeqo-bearer');
    expect(await chrome.storage.sync.get([STORAGE_KEYS.veeqoAccessToken])).toEqual({
      [STORAGE_KEYS.veeqoAccessToken]: 'veeqo-bearer',
    });
  });

  it('clears storage and returns null on 404', async () => {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.veeqoAccessToken]: 'old',
      [STORAGE_KEYS.veeqoConnectedAt]: 1,
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    await expect(syncVeeqoAccessToken(false)).resolves.toBeNull();
    const stored = await chrome.storage.sync.get([
      STORAGE_KEYS.veeqoAccessToken,
      STORAGE_KEYS.veeqoConnectedAt,
    ]);
    expect(stored[STORAGE_KEYS.veeqoAccessToken]).toBeUndefined();
  });

  it('throws on other Worker errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'boom' }, { status: 500 }))
    );
    await expect(syncVeeqoAccessToken(false)).rejects.toThrow(/boom|Failed to sync/i);
  });
});

describe('openConnectVeeqoTab', () => {
  it('opens auth start URL with Google token', async () => {
    await openConnectVeeqoTab();
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: `${WORKER}/auth/veeqo/start?token=google-access-token`,
      active: true,
    });
  });

  it('rejects placeholder Worker URL', async () => {
    await chrome.storage.sync.set({ [STORAGE_KEYS.workerUrl]: DEFAULT_AUTH_WORKER_URL });
    await expect(openConnectVeeqoTab()).rejects.toThrow(/Set your Cloudflare Worker URL/i);
  });
});

describe('disconnectVeeqo', () => {
  it('POSTs disconnect and clears local token', async () => {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.veeqoAccessToken]: 'tok',
      [STORAGE_KEYS.veeqoConnectedAt]: 9,
    });
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe(`${WORKER}/api/veeqo/disconnect`);
      expect(init?.method).toBe('POST');
      return Response.json({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    await disconnectVeeqo();
    const stored = await chrome.storage.sync.get([STORAGE_KEYS.veeqoAccessToken]);
    expect(stored[STORAGE_KEYS.veeqoAccessToken]).toBeUndefined();
  });
});

describe('signOutGoogle', () => {
  it('revokes token and clears auth storage keys', async () => {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.googleEmail]: 'a@b.com',
      [STORAGE_KEYS.veeqoAccessToken]: 'tok',
      [STORAGE_KEYS.veeqoConnectedAt]: 1,
    });
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await signOutGoogle();
    expect(chrome.identity.removeCachedAuthToken).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain('accounts.google.com/o/oauth2/revoke');
    const stored = await chrome.storage.sync.get([
      STORAGE_KEYS.googleEmail,
      STORAGE_KEYS.veeqoAccessToken,
    ]);
    expect(stored[STORAGE_KEYS.googleEmail]).toBeUndefined();
    expect(stored[STORAGE_KEYS.veeqoAccessToken]).toBeUndefined();
  });
});
