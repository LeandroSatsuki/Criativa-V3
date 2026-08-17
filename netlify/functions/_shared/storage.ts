import { del as deleteBlob, get as getBlob, list as listBlobs, put as putBlob } from '@vercel/blob';
import { getStore, type Store } from '@netlify/blobs';

type JsonStore = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  list(prefix: string): Promise<string[]>;
  remove(key: string): Promise<void>;
};

const isNetlifyRuntime = () => Boolean((globalThis as typeof globalThis & { Netlify?: unknown }).Netlify);
const isVercelRuntime = () => Boolean((globalThis as typeof globalThis & { VERCEL?: string }).VERCEL || process.env.VERCEL || process.env.VERCEL_ENV);

type NetlifyStoreFactory = (name: string) => Store;

const createNetlifyStore: NetlifyStoreFactory = (name) => getStore({ name, consistency: 'strong' });

export const isExpiredNetlifyBlobTokenError = (error: unknown) =>
  error instanceof Error && error.message.includes('Failed to decode token: Token expired');

export const withFreshNetlifyStore = async <T>(
  name: string,
  operation: (store: Store) => Promise<T>,
  createStore: NetlifyStoreFactory = createNetlifyStore,
) => {
  try {
    return await operation(createStore(name));
  } catch (error) {
    if (!isExpiredNetlifyBlobTokenError(error)) throw error;
    return operation(createStore(name));
  }
};

const netlifyStore = (name: string): JsonStore => {
  return {
    get: async <T = unknown>(key: string) =>
      withFreshNetlifyStore(name, (store) => store.get(key, { type: 'json' }) as Promise<T | null>),
    set: async (key: string, value: unknown) => {
      await withFreshNetlifyStore(name, (store) => store.setJSON(key, value));
    },
    list: async (prefix: string) => withFreshNetlifyStore(name, async (store) => {
      const { blobs } = await store.list({ prefix });
      return blobs.map((blob) => blob.key);
    }),
    remove: async (key: string) => {
      await withFreshNetlifyStore(name, (store) => store.delete(key));
    },
  };
};

const vercelPath = (name: string, key: string) => `${name}/${key}`;

const vercelStore = (name: string): JsonStore => ({
  get: async <T = unknown>(key: string) => {
    const blob = await getBlob(vercelPath(name, key), { access: 'private' });
    if (!blob) return null;
    return JSON.parse(await new Response(blob.stream).text()) as T;
  },
  set: async (key: string, value: unknown) => {
    await putBlob(vercelPath(name, key), JSON.stringify(value), {
      access: 'private',
      contentType: 'application/json; charset=utf-8',
    });
  },
  list: async (prefix: string) => {
    const { blobs } = await listBlobs({
      prefix: vercelPath(name, prefix),
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return blobs.map((blob) => blob.pathname.replace(`${name}/`, ''));
  },
  remove: async (key: string) => {
    await deleteBlob(vercelPath(name, key), {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  },
});

export const getJsonStore = (name: string): JsonStore => {
  if (isNetlifyRuntime()) {
    return netlifyStore(name);
  }

  if (isVercelRuntime()) {
    return vercelStore(name);
  }

  return netlifyStore(name);
};
