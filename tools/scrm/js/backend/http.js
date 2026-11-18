// Outbound HTTP from the browser: timeouts, limited retries, JSON parsing and a response
// cache in IndexedDB so repeat assessments don't hammer public APIs.
import { auxGet, auxPut } from './store.js';

export class SourceError extends Error {
  constructor(message, { status, url } = {}) { super(message); this.status = status; this.url = url; }
}
export const DAY = 86400000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function cacheGet(key) {
  const hit = await auxGet('cache', key);
  if (!hit) return undefined;
  return hit.expires > Date.now() ? hit.value : undefined;
}
export const cacheSet = (key, value, ttlMs) => auxPut('cache', key, { value, expires: Date.now() + ttlMs });

export async function fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = 25000,
  retries = 1, cacheTtlMs = 0, cacheKey, allow404 = false, text = false } = {}) {
  const key = cacheKey || `${method} ${url} ${body ? JSON.stringify(body) : ''}`;
  if (cacheTtlMs) { const hit = await cacheGet(key); if (hit !== undefined) return hit; }
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method, signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 404 && allow404) return null;
      if (res.status === 429 || res.status >= 500) {
        lastErr = new SourceError(`HTTP ${res.status}`, { status: res.status, url });
        await sleep(800 * 2 ** attempt); continue;
      }
      if (!res.ok) {
        const snippet = (await res.text().catch(() => '')).slice(0, 200);
        throw new SourceError(`HTTP ${res.status}${snippet ? `: ${snippet}` : ''}`, { status: res.status, url });
      }
      const data = text ? await res.text() : await res.json();
      if (cacheTtlMs) cacheSet(key, data, cacheTtlMs);
      return data;
    } catch (e) {
      if (e instanceof SourceError && e.status && e.status < 500 && e.status !== 429) throw e;
      lastErr = e.name === 'AbortError' ? new SourceError(`Timed out after ${timeoutMs / 1000}s`, { url })
        // A browser reports CORS refusals and network blocks identically, as a TypeError.
        : e instanceof TypeError ? new SourceError('Unreachable from this browser (network block or CORS)', { url }) : e;
      if (lastErr.message.startsWith('Unreachable')) break;
      if (attempt < retries) await sleep(600 * 2 ** attempt);
    } finally { clearTimeout(t); }
  }
  throw lastErr instanceof SourceError ? lastErr : new SourceError(lastErr?.message || 'Network error', { url });
}
