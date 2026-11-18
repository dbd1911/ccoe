// Outbound HTTP helper: timeouts, limited retries, JSON parsing and a SQLite-backed
// response cache so repeat assessments don't hammer public APIs.
import { cacheGet, cacheSet } from '../db.js';

export class SourceError extends Error {
  constructor(message, { status, url } = {}) { super(message); this.status = status; this.url = url; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = 25000,
  retries = 2, cacheTtlMs = 0, cacheKey, allow404 = false, text = false } = {}) {
  const key = cacheKey || `${method} ${url} ${body ? JSON.stringify(body) : ''}`;
  if (cacheTtlMs) { const hit = cacheGet(key); if (hit !== undefined) return hit; }
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method, signal: ctrl.signal,
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
      lastErr = e.name === 'AbortError' ? new SourceError(`Timed out after ${timeoutMs} ms`, { url }) : e;
      if (attempt < retries) await sleep(600 * 2 ** attempt);
    } finally { clearTimeout(t); }
  }
  throw lastErr instanceof SourceError ? lastErr : new SourceError(lastErr?.cause?.code || lastErr?.message || 'Network error', { url });
}

export const DAY = 86400000;
