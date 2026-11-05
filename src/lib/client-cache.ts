/**
 * Page state that survives client-side navigation and is gone on a full
 * reload — the browser's own idea of "this visit". Pages snapshot what they
 * loaded here so going Gists → Explore → Clubs → Gists picks up exactly where
 * the reader left off instead of fetching (and re-ranking) everything again.
 *
 * Sign-in and sign-out both do a full page load, so nothing in here can leak
 * from one account to the next.
 */
const store = new Map<string, unknown>();

export function readCache<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function writeCache<T>(key: string, value: T) {
  store.set(key, value);
}
