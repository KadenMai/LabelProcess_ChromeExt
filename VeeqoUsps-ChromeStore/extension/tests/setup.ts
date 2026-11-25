import { afterEach, beforeEach, vi } from 'vitest';

type Store = Record<string, unknown>;

function createStorageArea(initial: Store = {}) {
  let data: Store = { ...initial };
  return {
    get: vi.fn(async (keys?: string | string[] | null) => {
      if (keys == null) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Store = {};
      for (const k of list) {
        if (k in data) out[k] = data[k];
      }
      return out;
    }),
    set: vi.fn(async (items: Store) => {
      data = { ...data, ...items };
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) delete data[k];
    }),
    _dump: () => ({ ...data }),
    _reset: () => {
      data = { ...initial };
    },
  };
}

export const syncStorage = createStorageArea();
export const localStorageMock = createStorageArea();

beforeEach(() => {
  syncStorage._reset();
  localStorageMock._reset();

  const identity = {
    getAuthToken: vi.fn(
      (
        _details: chrome.identity.TokenDetails,
        cb?: (token?: string | chrome.identity.GetAuthTokenResult) => void
      ) => {
        cb?.('google-access-token');
      }
    ),
    removeCachedAuthToken: vi.fn((_details: { token: string }, cb?: () => void) => {
      cb?.();
    }),
  };

  // @ts-expect-error test stub
  globalThis.chrome = {
    storage: {
      sync: syncStorage,
      local: localStorageMock,
    },
    identity,
    runtime: {
      lastError: undefined as chrome.runtime.LastError | undefined,
    },
    tabs: {
      create: vi.fn(async () => ({ id: 1 })),
    },
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
