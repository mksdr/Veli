const fallback = new Map<string, string>();

export function getStoredValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key) ?? fallback.get(key) ?? null; }
  catch { return fallback.get(key) ?? null; }
}

export function setStoredValue(key: string, value: unknown): void {
  fallback.set(key, String(value));
  try { window.localStorage.setItem(key, String(value)); }
  catch { /* Preferences still work for this page when storage is blocked. */ }
}
