/** Default Cloudflare Worker base URL (no trailing slash). Override in popup Settings. */
export const DEFAULT_AUTH_WORKER_URL = 'https://veeqo-usps-auth.YOUR_SUBDOMAIN.workers.dev';

export const STORAGE_KEYS = {
  workerUrl: 'authWorkerUrl',
  googleEmail: 'googleEmail',
  veeqoAccessToken: 'veeqoAccessToken',
  veeqoConnectedAt: 'veeqoConnectedAt',
} as const;

export function veeqoAuthHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function getStoredAccessToken(): Promise<string | null> {
  const result = await chrome.storage.sync.get([STORAGE_KEYS.veeqoAccessToken]);
  const t = result[STORAGE_KEYS.veeqoAccessToken];
  return typeof t === 'string' && t.length > 0 ? t : null;
}

export async function getWorkerBaseUrl(): Promise<string> {
  const result = await chrome.storage.sync.get([STORAGE_KEYS.workerUrl]);
  const u = result[STORAGE_KEYS.workerUrl];
  if (typeof u === 'string' && u.trim()) return u.replace(/\/$/, '');
  return DEFAULT_AUTH_WORKER_URL;
}
