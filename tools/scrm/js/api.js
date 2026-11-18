// The UI talks to an "API", but there is no server: requests are dispatched to in-browser
// handlers (backend/routes.js) that read and write IndexedDB.
import { match } from './backend/routes.js';

async function req(method, url, body) {
  const u = new URL(url, 'http://local');
  const m = match(method, u.pathname);
  if (!m) throw new Error(`Unknown action ${method} ${u.pathname}`);
  try {
    const out = await m.handler({ params: m.params, query: Object.fromEntries(u.searchParams), body: body ?? {} });
    return out === undefined ? { ok: true } : out;
  } catch (e) {
    if (!e.status || e.status >= 500) console.error(e);
    throw e;
  }
}

export function saveFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.parentNode?.removeChild(a); }, 1000);
}

export async function download(url) {
  const out = await req('GET', url);
  if (out?.__download === undefined) throw new Error('Nothing to download');
  saveFile(out.__download, out.filename, out.type);
}

export const api = {
  get: (u) => req('GET', u),
  post: (u, b = {}) => req('POST', u, b),
  put: (u, b = {}) => req('PUT', u, b),
  del: (u) => req('DELETE', u),
};
let metaCache;
export const getMeta = async () => (metaCache ||= await api.get('/api/meta'));
