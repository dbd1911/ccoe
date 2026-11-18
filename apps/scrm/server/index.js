import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { PORT, HOST, APP_USER, APP_PASSWORD } from './config.js';
import { send, readBody, serveStatic, HttpError } from './http-util.js';
import { router } from './api.js';

function authorized(req) {
  if (!APP_PASSWORD) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const [u, ...rest] = Buffer.from(h.slice(6), 'base64').toString().split(':');
  const p = rest.join(':');
  const eq = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  return eq(u, APP_USER || 'admin') && eq(p, APP_PASSWORD);
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!authorized(req)) return send(res, 401, 'Authentication required', { 'WWW-Authenticate': 'Basic realm="SCRM Sentinel"' });
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
    // Same-origin guard for state-changing requests (defense against CSRF from other sites).
    if (req.method !== 'GET') {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) return send(res, 403, { error: 'Cross-origin request blocked' });
    }
    const m = router.match(req.method, url.pathname);
    if (!m) return send(res, 404, { error: 'Not found' });
    try {
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : undefined;
      const out = await m.handler({ params: m.params, query: Object.fromEntries(url.searchParams), body, req });
      if (out && out.__raw !== undefined) {
        return send(res, 200, out.__raw, { 'Content-Type': out.__type, 'Content-Disposition': `attachment; filename="${out.__filename}"` });
      }
      send(res, 200, out ?? { ok: true });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : e.status && e.status >= 400 && e.status < 600 ? 502 : 500;
      if (status >= 500) console.error(`[${req.method} ${url.pathname}]`, e);
      send(res, status, { error: e.message || 'Internal error' });
    }
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  createServer().listen(PORT, HOST, () => {
    console.log(`SCRM Sentinel running at http://${HOST}:${PORT}`);
    if (!APP_PASSWORD && HOST !== '127.0.0.1' && HOST !== 'localhost') console.warn('WARNING: listening on a non-loopback interface without SCRM_PASSWORD set.');
  });
}
