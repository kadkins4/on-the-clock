// A localStorage wrapper that never throws. Some environments (sandboxed
// iframes, cookie-blocked or private in-app webviews) raise a SecurityError on
// any localStorage access — even `getItem`. Touching storage during first
// paint would otherwise crash the whole app for those visitors, so every access
// is guarded. Reads degrade to null; writes become no-ops.
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* quota / unavailable / blocked — ignore */
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
