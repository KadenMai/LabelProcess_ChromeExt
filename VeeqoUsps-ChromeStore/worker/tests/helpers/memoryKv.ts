/** Minimal in-memory KVNamespace for unit/integration tests. */
export function createMemoryKv(): KVNamespace {
  const store = new Map<string, string>();

  return {
    get: async (key: string, type?: string) => {
      const value = store.get(key) ?? null;
      if (value == null) return null;
      if (type === 'json') return JSON.parse(value);
      if (type === 'arrayBuffer') {
        return new TextEncoder().encode(value).buffer;
      }
      return value;
    },
    put: async (key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream) => {
      if (typeof value === 'string') {
        store.set(key, value);
        return;
      }
      throw new Error('memoryKv put only supports string values in tests');
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [...store.keys()].map((name) => ({ name })), list_complete: true, cacheStatus: null }),
    getWithMetadata: async (key: string) => ({
      value: store.get(key) ?? null,
      metadata: null,
      cacheStatus: null,
    }),
  } as unknown as KVNamespace;
}
