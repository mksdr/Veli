const fallback = new Map();

function getStoredValue(key) {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key) ?? fallback.get(key) ?? null; }
  catch { return fallback.get(key) ?? null; }
}

function setStoredValue(key, value) {
  fallback.set(key, String(value));
  try { window.localStorage.setItem(key, String(value)); }
  catch { /* Preferences still work for this page when storage is blocked. */ }
}

module.exports = { getStoredValue, setStoredValue };
