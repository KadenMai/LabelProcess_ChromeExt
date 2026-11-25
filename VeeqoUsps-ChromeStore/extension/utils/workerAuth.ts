import {
  DEFAULT_AUTH_WORKER_URL,
  getWorkerBaseUrl,
  STORAGE_KEYS,
} from './authConfig';

export type AuthStatus = {
  googleSignedIn: boolean;
  email: string | null;
  allowed: boolean;
  veeqoConnected: boolean;
  connectedAt: number | null;
  workerUrl: string;
  error?: string;
};

export function getGoogleAuthToken(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (result) => {
      const token = typeof result === 'string' ? result : result?.token;
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || 'Google sign-in failed'));
        return;
      }
      resolve(token);
    });
  });
}

export function removeGoogleCachedToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

async function workerFetch(
  path: string,
  googleToken: string,
  init?: RequestInit
): Promise<Response> {
  const base = await getWorkerBaseUrl();
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${googleToken}`,
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  });
}

export async function fetchAuthStatus(interactive = false): Promise<AuthStatus> {
  const workerUrl = await getWorkerBaseUrl();
  try {
    const googleToken = await getGoogleAuthToken(interactive);
    const res = await workerFetch('/api/me', googleToken);
    const data = (await res.json()) as {
      email?: string;
      allowed?: boolean;
      veeqoConnected?: boolean;
      connectedAt?: number | null;
      error?: string;
    };
    if (!res.ok) {
      return {
        googleSignedIn: true,
        email: null,
        allowed: false,
        veeqoConnected: false,
        connectedAt: null,
        workerUrl,
        error: data.error || `Worker error (${res.status})`,
      };
    }
    if (data.email) {
      await chrome.storage.sync.set({ [STORAGE_KEYS.googleEmail]: data.email });
    }
    return {
      googleSignedIn: true,
      email: data.email ?? null,
      allowed: !!data.allowed,
      veeqoConnected: !!data.veeqoConnected,
      connectedAt: data.connectedAt ?? null,
      workerUrl,
    };
  } catch (e) {
    return {
      googleSignedIn: false,
      email: null,
      allowed: false,
      veeqoConnected: false,
      connectedAt: null,
      workerUrl,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Pull Veeqo Bearer token from Worker into chrome.storage.sync */
export async function syncVeeqoAccessToken(interactive = false): Promise<string | null> {
  const googleToken = await getGoogleAuthToken(interactive);
  const res = await workerFetch('/api/veeqo/token', googleToken);
  if (res.status === 404) {
    await chrome.storage.sync.remove([
      STORAGE_KEYS.veeqoAccessToken,
      STORAGE_KEYS.veeqoConnectedAt,
    ]);
    return null;
  }
  const data = (await res.json()) as {
    accessToken?: string;
    connectedAt?: number;
    error?: string;
  };
  if (!res.ok || !data.accessToken) {
    throw new Error(data.error || `Failed to sync Veeqo token (${res.status})`);
  }
  await chrome.storage.sync.set({
    [STORAGE_KEYS.veeqoAccessToken]: data.accessToken,
    [STORAGE_KEYS.veeqoConnectedAt]: data.connectedAt ?? Date.now(),
  });
  return data.accessToken;
}

export async function openConnectVeeqoTab(): Promise<void> {
  const googleToken = await getGoogleAuthToken(true);
  const base = await getWorkerBaseUrl();
  if (!base || base.includes('YOUR_SUBDOMAIN')) {
    throw new Error('Set your Cloudflare Worker URL in Settings first');
  }
  const url = `${base}/auth/veeqo/start?token=${encodeURIComponent(googleToken)}`;
  await chrome.tabs.create({ url, active: true });
}

export async function disconnectVeeqo(): Promise<void> {
  const googleToken = await getGoogleAuthToken(false);
  await workerFetch('/api/veeqo/disconnect', googleToken, { method: 'POST' });
  await chrome.storage.sync.remove([
    STORAGE_KEYS.veeqoAccessToken,
    STORAGE_KEYS.veeqoConnectedAt,
  ]);
}

export async function signOutGoogle(): Promise<void> {
  try {
    const token = await getGoogleAuthToken(false);
    await removeGoogleCachedToken(token);
    // Revoke so next interactive login prompts again
    await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${encodeURIComponent(token)}`);
  } catch {
    // ignore
  }
  await chrome.storage.sync.remove([
    STORAGE_KEYS.googleEmail,
    STORAGE_KEYS.veeqoAccessToken,
    STORAGE_KEYS.veeqoConnectedAt,
  ]);
}

export async function saveWorkerUrl(url: string): Promise<void> {
  const cleaned = (url.trim() || DEFAULT_AUTH_WORKER_URL).replace(/\/$/, '');
  await chrome.storage.sync.set({ [STORAGE_KEYS.workerUrl]: cleaned });
}
