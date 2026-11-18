// Browser persistence. Replaces the server database: every record lives in this browser's
// IndexedDB (hundreds of MB available), loaded into memory at startup. If IndexedDB is
// unavailable (private window, locked-down profile, Node tests) it falls back to memory only.
// Secrets (API keys) are NOT stored here — see settings.js — so exports never contain them.

const DB_NAME = 'scrm-sentinel';
const DB_VERSION = 1;
export const COLLECTIONS = ['vendors', 'portfolios', 'assessments', 'actions', 'audit', 'meta'];
const AUX = ['cache', 'screening']; // large / regenerable; loaded on demand

const mem = Object.fromEntries([...COLLECTIONS, ...AUX].map((c) => [c, new Map()]));
let idb = null;
export let persistent = false;

function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

export async function open() {
  if (typeof indexedDB === 'undefined') return false;
  try {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => { for (const c of [...COLLECTIONS, ...AUX]) if (!r.result.objectStoreNames.contains(c)) r.result.createObjectStore(c); };
    idb = await req(r);
    for (const c of COLLECTIONS) {
      const tx = idb.transaction(c, 'readonly'); const st = tx.objectStore(c);
      const [keys, vals] = await Promise.all([req(st.getAllKeys()), req(st.getAll())]);
      keys.forEach((k, i) => mem[c].set(k, vals[i]));
    }
    persistent = true;
    try { await navigator.storage?.persist?.(); } catch { /* best effort: ask the browser not to evict */ }
  } catch (e) { console.warn('IndexedDB unavailable; data will not survive a reload.', e); idb = null; }
  return persistent;
}

function write(c, key, value) {
  if (!idb) return;
  try {
    const tx = idb.transaction(c, 'readwrite');
    value === undefined ? tx.objectStore(c).delete(key) : tx.objectStore(c).put(value, key);
  } catch (e) { console.warn('IndexedDB write failed', e); }
}

export const all = (c) => [...mem[c].values()];
export const get = (c, k) => mem[c].get(k);
export function put(c, k, v) { mem[c].set(k, v); write(c, k, v); return v; }
export function del(c, k) { mem[c].delete(k); write(c, k, undefined); }
export function clear(c) { mem[c].clear(); if (idb) { try { idb.transaction(c, 'readwrite').objectStore(c).clear(); } catch { /* ignore */ } } }

/** Auto-increment ids per collection. */
export function nextId(c) {
  const k = `seq:${c}`; const n = (mem.meta.get(k) || 0) + 1;
  put('meta', k, n); return n;
}

// ---- aux stores (cache, local screening list) read straight from IndexedDB ----
export async function auxGet(c, k) {
  if (mem[c].has(k)) return mem[c].get(k);
  if (!idb) return undefined;
  try { const v = await req(idb.transaction(c, 'readonly').objectStore(c).get(k)); if (v !== undefined) mem[c].set(k, v); return v; } catch { return undefined; }
}
export function auxPut(c, k, v) { mem[c].set(k, v); write(c, k, v); }

export async function usage() {
  try { const e = await navigator.storage?.estimate?.(); return e ? { used: e.usage, quota: e.quota } : null; } catch { return null; }
}
