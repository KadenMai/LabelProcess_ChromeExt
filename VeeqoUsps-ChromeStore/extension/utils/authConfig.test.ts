import { beforeEach, describe, expect, it } from 'vitest';
import { syncStorage } from '../tests/setup';
import {
  DEFAULT_AUTH_WORKER_URL,
  getStoredAccessToken,
  getWorkerBaseUrl,
  STORAGE_KEYS,
  veeqoAuthHeaders,
} from './authConfig';

describe('veeqoAuthHeaders', () => {
  it('builds Bearer Authorization headers', () => {
    expect(veeqoAuthHeaders('tok-123')).toEqual({
      Authorization: 'Bearer tok-123',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  });
});

describe('getStoredAccessToken', () => {
  beforeEach(() => {
    syncStorage._reset();
  });

  it('returns null when missing or empty', async () => {
    expect(await getStoredAccessToken()).toBeNull();
    await chrome.storage.sync.set({ [STORAGE_KEYS.veeqoAccessToken]: '' });
    expect(await getStoredAccessToken()).toBeNull();
  });

  it('returns stored token string', async () => {
    await chrome.storage.sync.set({ [STORAGE_KEYS.veeqoAccessToken]: 'veeqo-bearer' });
    expect(await getStoredAccessToken()).toBe('veeqo-bearer');
  });
});

describe('getWorkerBaseUrl', () => {
  it('returns default when unset', async () => {
    expect(await getWorkerBaseUrl()).toBe(DEFAULT_AUTH_WORKER_URL);
  });

  it('returns stored URL without trailing slash', async () => {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.workerUrl]: 'https://auth.example.workers.dev/',
    });
    expect(await getWorkerBaseUrl()).toBe('https://auth.example.workers.dev');
  });
});
