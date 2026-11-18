// In-browser "API". The UI calls api.get('/api/...') exactly as it would a server; these
// handlers run locally against IndexedDB. No server, no database: works on static hosting.
import * as store from './store.js';
import { getSetting, setSetting, publicSettings, setRemember, forgetKeys, site } from './settings.js';
import { audit } from './audit.js';
import { runAssessment, getAssessment, nowSql } from './pipeline.js';
import { SOURCES, QUESTIONS } from '../core/catalog.js';
import { importCsl, refreshCsl, cslStats, screenParty } from './connectors/screening.js';
import * as usa from './connectors/usaspending.js';
import * as sam from './connectors/sam.js';
import { fetchJson } from './http.js';
import { DEMO_VENDORS } from '../core/dataset.js';
import { CATEGORIES, CRITICALITY, TIERS, assess, tierFor } from '../core/engine.js';
import { LISTS, WATCH_ENTITIES, WATCHLIST_AS_OF, COUNTRY_RISK } from '../core/watchlists.js';
import { aiEnabled, chat, generateAnalysis, compactContext, testConnection } from './llm.js';
import { similarity } from '../core/match.js';

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

const routes = [];
const r = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}/?$`);
  routes.push({ method, re, keys, handler });
};
export function match(method, pathname) {
  for (const x of routes) {
    if (x.method !== method) continue;
    const m = pathname.match(x.re);
    if (m) return { handler: x.handler, params: Object.fromEntries(x.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

const int = (v, name = 'id') => { const n = Number(v); if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${name}`); return n; };
const CRIT = Object.keys(CRITICALITY);
const STATUS = ['under-review', 'approved', 'conditional', 'rejected', 'offboarded'];
const DISPOSITIONS = ['open', 'mitigating', 'mitigated', 'accepted', 'false-positive'];
const SECRET_KEYS = ['llm_api_key', 'sam_api_key', 'csl_api_key', 'opensanctions_api_key'];

// ---------- meta & settings ----------
r('GET', '/api/health', () => ({ ok: true, mode: getSetting('mode'), ai: aiEnabled(), persistent: store.persistent, time: new Date().toISOString() }));
r('GET', '/api/meta', () => ({ categories: CATEGORIES, criticality: CRITICALITY, tiers: TIERS, statuses: STATUS, dispositions: DISPOSITIONS,
  lists: LISTS, watchlistAsOf: WATCHLIST_AS_OF, watchEntityCount: WATCH_ENTITIES.length, countryRisk: COUNTRY_RISK }));
r('GET', '/api/settings', () => publicSettings());
r('PUT', '/api/settings', ({ body }) => {
  if (body.remember_keys !== undefined) setRemember(body.remember_keys === true || body.remember_keys === 'true');
  for (const [k, v] of Object.entries(body || {})) {
    if (v === undefined || k === 'remember_keys') continue;
    if (k === 'mode' && !['live', 'demo'].includes(v)) throw new HttpError(400, 'mode must be live or demo');
    setSetting(k, typeof v === 'string' ? v.trim() : v);
  }
  audit('settings.updated', Object.keys(body || {}).map((k) => (SECRET_KEYS.includes(k) ? `${k}(set)` : k)).join(','));
  return publicSettings();
});
r('POST', '/api/settings/forget-keys', () => { forgetKeys(); audit('settings.keys-cleared', ''); return publicSettings(); });
r('POST', '/api/llm/test', () => testConnection());

/** Checks which public sources this browser/network can reach (CORS + firewall). */
r('POST', '/api/connectivity', async () => {
  const probes = [
    ['usaspending', 'USAspending.gov', () => fetchJson('https://api.usaspending.gov/api/v2/references/toptier_agencies/', { timeoutMs: 15000, retries: 0 })],
    ['gleif', 'GLEIF LEI', () => fetchJson('https://api.gleif.org/api/v1/lei-records?page[size]=1', { timeoutMs: 15000, retries: 0, headers: { Accept: 'application/vnd.api+json' } })],
    ['sam', 'SAM.gov API', () => (getSetting('sam_api_key') ? sam.searchEntities(getSetting('sam_api_key'), 'test') : Promise.reject(new Error('No SAM.gov key configured')))],
    ['gdelt', 'GDELT news', () => fetchJson('https://api.gdeltproject.org/api/v2/doc/doc?query=%22supply%20chain%22&mode=artlist&format=json&maxrecords=1&timespan=1d', { timeoutMs: 15000, retries: 0 })],
    ['kev', 'CISA KEV', () => import('./connectors/kev.js').then((m) => m.forVendor('Microsoft'))],
    ['csl', 'Screening list download (trade.gov)', () => fetchJson('https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.json', { method: 'HEAD', timeoutMs: 15000, retries: 0, text: true })],
    ['llm', 'AI service (GenAI)', () => (aiEnabled() ? testConnection() : Promise.reject(new Error('No AI key configured')))],
  ];
  const out = await Promise.all(probes.map(async ([id, label, fn]) => {
    const t0 = Date.now();
    try { await fn(); return { id, label, ok: true, ms: Date.now() - t0 }; } catch (e) { return { id, label, ok: false, error: e.message, ms: Date.now() - t0 }; }
  }));
  audit('connectivity.check', out.map((x) => `${x.id}:${x.ok ? 'ok' : 'fail'}`).join(' '));
  return out;
});

r('GET', '/api/sources', async () => {
  const s = publicSettings(); const csl = await cslStats();
  const status = (src) => {
    const keyMap = { sam: 'sam_api_key', 'sam-exclusions': 'sam_api_key', opensanctions: 'opensanctions_api_key' };
    if (src.id === 'sec') return 'reference';
    if (!src.automated) return 'reference';
    if (keyMap[src.id]) return s[keyMap[src.id]].configured ? 'configured' : 'needs-key';
    if (src.id === 'csl') return csl.entries || s.csl_api_key.configured ? 'configured' : 'needs-data';
    return 'ready';
  };
  return { questions: QUESTIONS, sources: SOURCES.map((x) => ({ ...x, status: status(x) })), csl, ai: aiEnabled(), mode: getSetting('mode') };
});
r('POST', '/api/screening/refresh', async () => { const st = await refreshCsl(); audit('screening.refresh', { entries: st.entries }); return st; });
r('POST', '/api/screening/import', async ({ body }) => { const st = await importCsl(body); audit('screening.import', { entries: st.entries }); return st; });
r('POST', '/api/screening/check', async ({ body }) => {
  const names = (body?.names || []).map((n) => String(n).trim()).filter(Boolean).slice(0, 200);
  const out = [];
  for (const n of names) out.push({ name: n, ...(await screenParty(n, { cslKey: getSetting('csl_api_key'), osKey: getSetting('opensanctions_api_key'), useLiveApis: getSetting('mode') !== 'demo' })) });
  audit('screening.adhoc', `${names.length} name(s)`);
  return out;
});

// ---------- entity search ----------
r('GET', '/api/search', async ({ query }) => {
  const q = String(query.q || '').trim();
  if (q.length < 2) return { results: [], errors: [] };
  if (getSetting('mode') === 'demo') {
    return { results: DEMO_VENDORS.map((d) => ({ source: 'demo', name: d.entity.name, uei: d.entity.uei, cage: d.entity.cage, country: d.entity.country, state: d.entity.state,
      score: Math.max(similarity(q, d.entity.name), d.entity.name.toLowerCase().includes(q.toLowerCase()) ? 0.9 : 0) })).filter((x) => x.score > 0.5).sort((a, b) => b.score - a.score), errors: [] };
  }
  const errors = []; const results = [];
  const samKey = getSetting('sam_api_key');
  await Promise.all([
    usa.searchRecipients(q, 10).then((x) => results.push(...x)).catch((e) => errors.push(`USAspending: ${e.message}`)),
    samKey ? sam.searchEntities(samKey, q).then((x) => results.push(...x)).catch((e) => errors.push(`SAM.gov: ${e.message}`)) : null,
  ]);
  const merged = new Map();
  for (const x of results) { const k = x.uei || x.name.toLowerCase(); merged.set(k, { ...(merged.get(k) || {}), ...x, amount: x.amount ?? merged.get(k)?.amount }); }
  return { results: [...merged.values()].sort((a, b) => b.score - a.score).slice(0, 15), errors };
});

// ---------- vendors ----------
function summarize(a, vendorId) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, open = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of a.findings || []) {
    counts[f.severity]++;
    const d = store.get('actions', `${vendorId}|${f.key}`)?.disposition || 'open';
    if (d === 'open' || d === 'mitigating') open[f.severity]++;
  }
  const sc = a.scores || {};
  return { assessmentId: a.id, assessedAt: a.created_at, score: a.score, tier: a.tier, mode: a.mode, exposure: sc.exposure, likelihood: sc.likelihood, impact: sc.impact,
    hardStops: sc.hardStops || [], categories: (sc.categories || []).map((c) => ({ id: c.id, score: c.score })), findingCounts: counts, openCounts: open,
    findingsByCategory: (a.findings || []).reduce((m, f) => ((m[f.category] = (m[f.category] || 0) + 1), m), {}) };
}

function vendorRows(portfolioId) {
  const pmap = new Map(store.all('portfolios').map((p) => [p.id, p]));
  return store.all('vendors')
    .filter((v) => !portfolioId || (v.portfolioIds || []).includes(portfolioId))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((v) => {
      const a = v.latest_assessment_id ? store.get('assessments', v.latest_assessment_id) : null;
      return { ...v, tags: v.tags || [], latest: a ? summarize(a, v.id) : null,
        portfolios: (v.portfolioIds || []).filter((id) => pmap.has(id)).map((id) => ({ id, name: pmap.get(id).name })) };
    });
}

function cleanVendor(b, partial = false) {
  const out = {};
  const str = (k, max = 300) => { if (b[k] !== undefined) out[k] = b[k] == null ? null : String(b[k]).trim().slice(0, max); };
  ['name', 'uei', 'cage', 'cik', 'lei', 'website', 'country', 'state', 'vertical', 'naics', 'contract_ref', 'owner'].forEach((k) => str(k));
  str('notes', 5000);
  if (b.criticality !== undefined) { if (!CRIT.includes(b.criticality)) throw new HttpError(400, 'Invalid criticality'); out.criticality = b.criticality; }
  if (b.status !== undefined) { if (!STATUS.includes(b.status)) throw new HttpError(400, 'Invalid status'); out.status = b.status; }
  if (b.annual_spend !== undefined) out.annual_spend = Number(b.annual_spend) || 0;
  if (b.tags !== undefined) out.tags = (Array.isArray(b.tags) ? b.tags : String(b.tags).split(',')).map((t) => String(t).trim()).filter(Boolean).slice(0, 20);
  if (out.uei) out.uei = out.uei.toUpperCase();
  if (!partial && !out.name) throw new HttpError(400, 'Vendor name is required');
  return out;
}

function findVendor({ uei, name }) {
  const all = store.all('vendors');
  return (uei && all.find((v) => v.uei && v.uei === String(uei).toUpperCase())) || all.find((v) => v.name.toLowerCase() === String(name || '').toLowerCase());
}

export function createVendor(body) {
  const v = cleanVendor(body);
  const existing = findVendor(v);
  let rec;
  if (existing) rec = existing;
  else {
    const id = store.nextId('vendors');
    rec = { id, criticality: 'moderate', status: 'under-review', annual_spend: 0, tags: [], portfolioIds: [], latest_assessment_id: null, created_at: nowSql(), updated_at: nowSql(), ...v };
    audit('vendor.created', { id, name: v.name });
  }
  const pids = new Set(rec.portfolioIds || []);
  for (const pid of body.portfolioIds || []) pids.add(int(pid));
  store.put('vendors', rec.id, { ...rec, portfolioIds: [...pids] });
  return { id: rec.id, existed: !!existing };
}

r('GET', '/api/vendors', ({ query }) => vendorRows(query.portfolioId ? int(query.portfolioId) : null));
r('POST', '/api/vendors', async ({ body }) => {
  const { id, existed } = createVendor(body);
  return { id, existed, assessment: body.assess ? await runAssessment(id) : null };
});
r('GET', '/api/vendors/:id', ({ params }) => {
  const id = int(params.id);
  const v = vendorRows(null).find((x) => x.id === id);
  if (!v) throw new HttpError(404, 'Vendor not found');
  const history = store.all('assessments').filter((a) => a.vendor_id === id)
    .map((a) => ({ id: a.id, created_at: a.created_at, score: a.score, tier: a.tier, mode: a.mode }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  return { vendor: v, history, assessment: v.latest_assessment_id ? getAssessment(v.latest_assessment_id) : null };
});
r('PUT', '/api/vendors/:id', ({ params, body }) => {
  const id = int(params.id); const v = cleanVendor(body, true);
  const cur = store.get('vendors', id); if (!cur) throw new HttpError(404, 'Vendor not found');
  store.put('vendors', id, { ...cur, ...v, updated_at: nowSql() });
  if (v.criticality && cur.latest_assessment_id) {
    const a = store.get('assessments', cur.latest_assessment_id);
    if (a?.profile?.entity) {
      const res = assess(a.profile, { criticality: v.criticality });
      store.put('assessments', a.id, { ...a, scores: { categories: res.categories, hardStops: res.hardStops, likelihood: res.likelihood, impact: res.impact, exposure: res.exposure, methodologyVersion: res.methodologyVersion } });
    }
  }
  audit('vendor.updated', { id, fields: Object.keys(v) });
  return { ok: true };
});
r('DELETE', '/api/vendors/:id', ({ params }) => {
  const id = int(params.id);
  for (const a of store.all('assessments')) if (a.vendor_id === id) store.del('assessments', a.id);
  for (const a of store.all('actions')) if (a.vendor_id === id) store.del('actions', `${id}|${a.finding_key}`);
  store.del('vendors', id); audit('vendor.deleted', { id });
  return { ok: true };
});
r('POST', '/api/vendors/:id/assess', ({ params, body }) => runAssessment(int(params.id), { withAi: body?.ai !== false }));
r('GET', '/api/assessments/:id', ({ params }) => { const a = getAssessment(int(params.id)); if (!a) throw new HttpError(404, 'Not found'); return a; });
r('POST', '/api/assessments/:id/ai', async ({ params }) => {
  if (!aiEnabled()) throw new HttpError(400, 'Add your GenAI.mil / Gemini API key in Settings to enable the AI analyst.');
  const a = getAssessment(int(params.id)); if (!a) throw new HttpError(404, 'Not found');
  if (a.summaryOnly) throw new HttpError(400, 'This is a summary-only (published) assessment. Re-assess the vendor to generate an AI analysis.');
  const vendor = store.get('vendors', a.vendorId);
  const ai = await generateAnalysis({ vendor, profile: a.profile, result: a });
  store.put('assessments', a.id, { ...store.get('assessments', a.id), ai });
  audit('ai.analysis', { assessmentId: a.id });
  return ai;
});
r('PUT', '/api/vendors/:id/findings/:key', ({ params, body }) => {
  const id = int(params.id);
  if (!DISPOSITIONS.includes(body?.disposition)) throw new HttpError(400, 'Invalid disposition');
  store.put('actions', `${id}|${params.key}`, { vendor_id: id, finding_key: params.key, disposition: body.disposition, note: String(body.note || '').slice(0, 2000), updated_at: nowSql() });
  audit('finding.disposition', { vendorId: id, key: params.key, disposition: body.disposition });
  return { ok: true };
});

// ---------- portfolios ----------
r('GET', '/api/portfolios', () => store.all('portfolios').map((p) => ({ ...p, vendorCount: store.all('vendors').filter((v) => (v.portfolioIds || []).includes(p.id)).length }))
  .sort((a, b) => a.name.localeCompare(b.name)));
function createPortfolio(name, description = '') {
  name = String(name || '').trim(); if (!name) throw new HttpError(400, 'Name required');
  const ex = store.all('portfolios').find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (ex) return { id: ex.id, existed: true };
  const id = store.nextId('portfolios');
  store.put('portfolios', id, { id, name, description: String(description || ''), created_at: nowSql() });
  audit('portfolio.created', { id, name });
  return { id };
}
r('POST', '/api/portfolios', ({ body }) => { const res = createPortfolio(body?.name, body?.description); if (res.existed) throw new HttpError(409, 'A portfolio with that name already exists'); return res; });
r('PUT', '/api/portfolios/:id', ({ params, body }) => {
  const p = store.get('portfolios', int(params.id)); if (!p) throw new HttpError(404, 'Not found');
  store.put('portfolios', p.id, { ...p, name: body.name ?? p.name, description: body.description ?? p.description }); return { ok: true };
});
r('DELETE', '/api/portfolios/:id', ({ params }) => {
  const pid = int(params.id);
  for (const v of store.all('vendors')) if ((v.portfolioIds || []).includes(pid)) store.put('vendors', v.id, { ...v, portfolioIds: v.portfolioIds.filter((x) => x !== pid) });
  store.del('portfolios', pid); audit('portfolio.deleted', { id: pid }); return { ok: true };
});
r('POST', '/api/portfolios/:id/vendors', ({ params, body }) => {
  const pid = int(params.id);
  for (const vid of body.vendorIds || []) { const v = store.get('vendors', int(vid)); if (v) store.put('vendors', v.id, { ...v, portfolioIds: [...new Set([...(v.portfolioIds || []), pid])] }); }
  return { ok: true };
});
r('DELETE', '/api/portfolios/:id/vendors/:vid', ({ params }) => {
  const pid = int(params.id); const v = store.get('vendors', int(params.vid));
  if (v) store.put('vendors', v.id, { ...v, portfolioIds: (v.portfolioIds || []).filter((x) => x !== pid) });
  return { ok: true };
});

// ---------- bulk assessment jobs (run while the tab is open) ----------
const jobs = new Map();
let jobSeq = 0;
const queue = []; let running = 0;
function pump() { while (running < 2 && queue.length) { const t = queue.shift(); running++; t().finally(() => { running--; pump(); }); } }
function startBulk(entries, { portfolioId, ai = false } = {}) {
  const id = ++jobSeq;
  const job = { id, kind: 'bulk-assess', status: 'running', total: entries.length, done: 0, items: entries.map((e) => ({ ...e, status: 'queued' })), created_at: nowSql() };
  jobs.set(id, job);
  const finish = () => { job.done = job.items.filter((i) => ['done', 'error'].includes(i.status)).length; if (job.done === job.total) { job.status = 'complete'; job.finished_at = nowSql(); } };
  job.items.forEach((it) => queue.push(async () => {
    try {
      it.status = 'running';
      const { status: _s, step: _st, ...fields } = it;
      const { id: vid } = createVendor({ ...fields, portfolioIds: portfolioId ? [portfolioId] : [] });
      const a = await runAssessment(vid, { withAi: ai, onProgress: (step) => { it.step = step; } });
      Object.assign(it, { status: 'done', vendorId: vid, score: a.score, tier: a.tier, step: null });
    } catch (e) { Object.assign(it, { status: 'error', error: e.message }); }
    finish();
  }));
  pump();
  audit('bulk.started', { jobId: id, count: entries.length });
  return id;
}
r('POST', '/api/bulk', ({ body }) => {
  const entries = (body?.entries || []).map((e) => (typeof e === 'string' ? { name: e } : e))
    .map((e) => ({ name: String(e.name || '').trim(), uei: e.uei ? String(e.uei).trim().toUpperCase() : undefined, criticality: CRIT.includes(e.criticality) ? e.criticality : undefined,
      annual_spend: e.annual_spend, contract_ref: e.contract_ref }))
    .filter((e) => e.name).slice(0, 500);
  if (!entries.length) throw new HttpError(400, 'No vendor names supplied');
  let portfolioId = body.portfolioId ? int(body.portfolioId) : null;
  if (!portfolioId && body.newPortfolioName) portfolioId = createPortfolio(body.newPortfolioName, 'Created from bulk import').id;
  return { jobId: startBulk(entries, { portfolioId, ai: !!body.ai }), portfolioId };
});
r('GET', '/api/jobs/:id', ({ params }) => { const j = jobs.get(int(params.id)); if (!j) throw new HttpError(404, 'Job not found (bulk jobs run only while this tab stays open)'); return structuredClone(j); });

// ---------- dashboard ----------
r('GET', '/api/dashboard', ({ query }) => {
  const pid = query.portfolioId ? int(query.portfolioId) : null;
  const vendors = vendorRows(pid);
  const assessed = vendors.filter((v) => v.latest);
  const staleDays = Number(getSetting('stale_days')) || 90;
  const now = Date.now();
  const tierCounts = Object.fromEntries(TIERS.map((t) => [t.id, 0]));
  for (const v of assessed) tierCounts[v.latest.tier]++;
  const heat = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => []));
  for (const v of assessed) heat[(v.latest.likelihood || 1) - 1][(v.latest.impact || 2) - 1].push({ id: v.id, name: v.name, score: v.latest.score });
  const catAgg = CATEGORIES.map((c) => {
    const scores = assessed.map((v) => v.latest.categories.find((x) => x.id === c.id)?.score || 0);
    return { id: c.id, name: c.name, avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      findings: assessed.reduce((t, v) => t + (v.latest.findingsByCategory[c.id] || 0), 0), elevated: scores.filter((s) => s >= 50).length };
  });
  const ids = new Set(vendors.map((v) => v.id));
  const hist = store.all('assessments').filter((a) => ids.has(a.vendor_id)).map((a) => ({ vendor_id: a.vendor_id, created_at: a.created_at, score: a.score }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const trend = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i + 1); d.setUTCDate(0);
    const end = `${d.toISOString().slice(0, 10)} 23:59:59`;
    const last = new Map();
    for (const h of hist) if (h.created_at <= end) last.set(h.vendor_id, h.score);
    if (last.size) trend.push({ month: end.slice(0, 7), avg: Math.round([...last.values()].reduce((a, b) => a + b, 0) / last.size), vendors: last.size, high: [...last.values()].filter((s) => s >= 50).length });
  }
  const countries = new Map(); const flagged = []; const agencies = new Map();
  for (const v of assessed) {
    const p = store.get('assessments', v.latest.assessmentId)?.profile || {};
    for (const s of p.suppliers || []) {
      const c = s.country || 'Unknown';
      const cur = countries.get(c) || { country: c, suppliers: 0, amount: 0, vendors: new Set() };
      cur.suppliers++; cur.amount += s.amount || 0; cur.vendors.add(v.name); countries.set(c, cur);
      if (s.status && s.status !== 'clear') flagged.push({ vendorId: v.id, vendor: v.name, party: s.name, role: 'supplier', status: s.status, lists: [...new Set((s.hits || []).map((h) => h.listName))] });
    }
    for (const pr of p.screening?.parents || []) if (pr.hits?.length) flagged.push({ vendorId: v.id, vendor: v.name, party: pr.name, role: pr.role, status: pr.hits.some((h) => h.strength === 'strong') ? 'flagged' : 'potential', lists: [...new Set(pr.hits.map((h) => h.listName))] });
    if (p.screening?.entity?.hits?.length) flagged.push({ vendorId: v.id, vendor: v.name, party: v.name, role: 'vendor', status: p.screening.entity.hits.some((h) => h.strength === 'strong') ? 'flagged' : 'potential', lists: [...new Set(p.screening.entity.hits.map((h) => h.listName))] });
    for (const ag of p.customers?.agencies || []) { const cur = agencies.get(ag.name) || { name: ag.name, amount: 0, vendors: 0 }; cur.amount += ag.amount || 0; cur.vendors++; agencies.set(ag.name, cur); }
  }
  const sum = (f) => assessed.reduce((t, v) => t + f(v), 0);
  const ageDays = (s) => (now - new Date(`${s.replace(' ', 'T')}Z`)) / 86400000;
  return {
    portfolioId: pid,
    kpis: {
      vendors: vendors.length, assessed: assessed.length, unassessed: vendors.length - assessed.length,
      avgScore: assessed.length ? Math.round(sum((v) => v.latest.score) / assessed.length) : null,
      avgExposure: assessed.length ? Math.round(sum((v) => v.latest.exposure || 0) / assessed.length) : null,
      highOrCritical: tierCounts.high + tierCounts.critical, hardStops: assessed.filter((v) => v.latest.hardStops.length).length,
      openCritical: sum((v) => v.latest.openCounts.critical), openHigh: sum((v) => v.latest.openCounts.high),
      annualSpend: vendors.reduce((t, v) => t + (v.annual_spend || 0), 0),
      spendAtRisk: assessed.filter((v) => v.latest.score >= 50).reduce((t, v) => t + (v.annual_spend || 0), 0),
      stale: assessed.filter((v) => ageDays(v.latest.assessedAt) > staleDays).length, staleDays,
    },
    tierCounts, heat, categories: catAgg, trend,
    countries: [...countries.values()].map((c) => ({ ...c, vendors: [...c.vendors] })).sort((a, b) => b.amount - a.amount),
    flaggedParties: flagged.sort((a, b) => (a.status === 'flagged' ? 0 : 1) - (b.status === 'flagged' ? 0 : 1)),
    agencies: [...agencies.values()].sort((a, b) => b.amount - a.amount).slice(0, 10),
    topRisks: [...assessed].sort((a, b) => (b.latest.exposure || 0) - (a.latest.exposure || 0)).slice(0, 10)
      .map((v) => ({ id: v.id, name: v.name, score: v.latest.score, tier: v.latest.tier, exposure: v.latest.exposure, criticality: v.criticality, status: v.status, hardStops: v.latest.hardStops, open: v.latest.openCounts })),
    recent: store.all('audit').sort((a, b) => b.id - a.id).slice(0, 12),
  };
});

// ---------- AI chat ----------
r('POST', '/api/chat', async ({ body }) => {
  if (!aiEnabled()) throw new HttpError(400, 'Add your GenAI.mil / Gemini API key in Settings to enable the AI analyst.');
  const question = String(body?.question || '').trim().slice(0, 4000);
  if (!question) throw new HttpError(400, 'Question required');
  let context;
  if (body.vendorId) {
    const vendor = store.get('vendors', int(body.vendorId));
    if (!vendor?.latest_assessment_id) throw new HttpError(400, 'Vendor has no assessment yet');
    const a = getAssessment(vendor.latest_assessment_id);
    context = { scope: 'vendor', ...compactContext({ vendor, profile: a.profile, result: a }), aiAssessment: a.ai };
  } else {
    context = { scope: 'portfolio', vendors: vendorRows(body.portfolioId ? int(body.portfolioId) : null).map((v) => ({ name: v.name, criticality: v.criticality, status: v.status, annualSpend: v.annual_spend,
      score: v.latest?.score, tier: v.latest?.tier, exposure: v.latest?.exposure, hardStops: v.latest?.hardStops, openFindings: v.latest?.openCounts,
      findingsByCategory: v.latest?.findingsByCategory, assessedAt: v.latest?.assessedAt, vertical: v.vertical, country: v.country })) };
  }
  audit('ai.chat', { vendorId: body.vendorId || null });
  return chat({ question, context, history: Array.isArray(body.history) ? body.history : [] });
});

// ---------- exports, audit, demo ----------
r('GET', '/api/export/vendors.csv', ({ query }) => {
  const rows = vendorRows(query.portfolioId ? int(query.portfolioId) : null);
  const cols = ['name', 'uei', 'cage', 'country', 'state', 'vertical', 'naics', 'criticality', 'status', 'annual_spend', 'score', 'tier', 'exposure', 'hard_stops', 'open_critical', 'open_high', 'assessed_at', 'portfolios'];
  const esc = (v) => { const s = v == null ? '' : String(v); const inj = /^[=+\-@]/.test(s); return /[",\n]/.test(s) || inj ? `"${(inj ? "'" : '') + s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.join(',')].concat(rows.map((v) => [v.name, v.uei, v.cage, v.country, v.state, v.vertical, v.naics, v.criticality, v.status, v.annual_spend,
    v.latest?.score, v.latest?.tier, v.latest?.exposure, (v.latest?.hardStops || []).join('; '), v.latest?.openCounts.critical, v.latest?.openCounts.high, v.latest?.assessedAt,
    v.portfolios.map((p) => p.name).join('; ')].map(esc).join(',')));
  return { __download: lines.join('\n'), type: 'text/csv', filename: 'scrm-vendors.csv' };
});
r('GET', '/api/audit', ({ query }) => store.all('audit').sort((a, b) => b.id - a.id).slice(0, Math.min(500, Number(query.limit) || 200)));
r('GET', '/api/storage', async () => ({ persistent: store.persistent, usage: await store.usage(), counts: Object.fromEntries(store.COLLECTIONS.map((c) => [c, store.all(c).length])),
  lastExport: store.get('meta', 'lastExport') || null, lastShared: store.get('meta', 'sharedLoaded') || null }));

r('POST', '/api/demo/seed', async () => {
  setSetting('mode', 'demo');
  const { id: pid } = createPortfolio('Demo — Enterprise IT & Weapons Systems', 'Fictional vendors for training and evaluation');
  const crit = ['mission-critical', 'high', 'mission-critical', 'moderate', 'low', 'moderate', 'high', 'mission-critical'];
  const spend = [42_000_000, 11_500_000, 6_800_000, 3_100_000, 450_000, 1_900_000, 2_600_000, 18_000_000];
  const status = ['approved', 'approved', 'under-review', 'conditional', 'under-review', 'approved', 'under-review', 'approved'];
  const ids = DEMO_VENDORS.map((d, i) => createVendor({ name: d.entity.name, uei: d.entity.uei, criticality: crit[i], annual_spend: spend[i], status: status[i], portfolioIds: [pid], contract_ref: `DEMO-${1000 + i}` }).id);
  for (const [i, id] of ids.entries()) {
    const first = !store.all('assessments').some((a) => a.vendor_id === id);
    const a = await runAssessment(id, { withAi: false });
    if (first) {
      const base = store.get('assessments', a.id);
      for (const [months, delta] of [[5, -14 + i * 2], [2, -6 + i]]) {
        const d = new Date(); d.setUTCMonth(d.getUTCMonth() - months);
        const sc = Math.max(0, Math.min(100, a.score + delta)); const hid = store.nextId('assessments');
        store.put('assessments', hid, { ...base, id: hid, created_at: d.toISOString().slice(0, 19).replace('T', ' '), score: sc, tier: tierFor(sc), ai: null });
      }
    }
  }
  audit('demo.seeded', { portfolioId: pid, vendors: ids.length });
  return { portfolioId: pid, vendorIds: ids };
});

// ---------- workspace backup / sharing (replaces a database) ----------
const MAX_SUPPLIERS_SUMMARY = 25;
function slimProfile(p) {
  if (!p) return p;
  const hit = (h) => ({ list: h.list, listName: h.listName, entryName: h.entryName, matchedName: h.matchedName, score: h.score, strength: h.strength, url: h.url, authority: h.authority });
  return {
    entity: p.entity, ownership: p.ownership,
    federal: p.federal && { totalObligated: p.federal.totalObligated, awardCount: p.federal.awardCount, firstAwardDate: p.federal.firstAwardDate, lastAwardDate: p.federal.lastAwardDate,
      byAgency: (p.federal.byAgency || []).slice(0, 10), bySubAgency: (p.federal.bySubAgency || []).slice(0, 10), naics: (p.federal.naics || []).slice(0, 5), psc: (p.federal.psc || []).slice(0, 5),
      trend: p.federal.trend, topAwards: (p.federal.topAwards || []).slice(0, 5), subawardCoverage: p.federal.subawardCoverage },
    suppliers: [...(p.suppliers || [])].sort((a, b) => (b.status !== 'clear') - (a.status !== 'clear') || b.amount - a.amount).slice(0, MAX_SUPPLIERS_SUMMARY)
      .map((s) => ({ name: s.name, amount: s.amount, count: s.count, country: s.country, status: s.status, descriptions: s.descriptions, hits: (s.hits || []).map(hit) })),
    customers: { agencies: (p.customers?.agencies || []).slice(0, 10), subAgencies: (p.customers?.subAgencies || []).slice(0, 10),
      primes: (p.customers?.primes || []).slice(0, 10).map((x) => ({ ...x, hits: (x.hits || []).map(hit) })) },
    screening: p.screening && { entity: { hits: (p.screening.entity?.hits || []).map(hit) }, parents: (p.screening.parents || []).map((x) => ({ ...x, hits: x.hits.map(hit) })), listsChecked: p.screening.listsChecked },
    exclusions: p.exclusions, proceedings: p.proceedings, sec: p.sec, media: (p.media || []).slice(0, 10), kev: p.kev, sourcesChecked: p.sourcesChecked,
  };
}

/**
 * Export the workspace. "full" = everything (your backup). "summary" = latest assessment per vendor
 * with trimmed profiles plus score history only — small enough to commit to the site repository
 * as a shared, read-mostly team portfolio (~10-20 KB per vendor).
 */
r('GET', '/api/workspace/export', ({ query }) => {
  const summary = query.kind === 'summary';
  const vendors = store.all('vendors');
  const latestIds = new Set(vendors.map((v) => v.latest_assessment_id).filter(Boolean));
  const assessments = store.all('assessments').map((a) => {
    if (!summary) return a;
    if (latestIds.has(a.id)) return { ...a, profile: slimProfile(a.profile) };
    return { id: a.id, vendor_id: a.vendor_id, created_at: a.created_at, mode: a.mode, score: a.score, tier: a.tier }; // history point only
  });
  store.put('meta', 'lastExport', nowSql());
  audit('workspace.exported', { kind: summary ? 'summary' : 'full', vendors: vendors.length });
  const payload = { format: 'scrm-workspace', version: 1, kind: summary ? 'summary' : 'full', exportedAt: new Date().toISOString(),
    vendors, portfolios: store.all('portfolios'), assessments, actions: store.all('actions') };
  return { __download: JSON.stringify(payload, null, summary ? 0 : 1), type: 'application/json',
    filename: summary ? 'scrm-workspace.json' : `scrm-backup-${new Date().toISOString().slice(0, 10)}.json` };
});

/** Merge a workspace file into this browser. Vendors match on UEI, then name; newer data wins. */
export function importWorkspace(data, { source = 'file' } = {}) {
  if (data?.format !== 'scrm-workspace') throw new HttpError(400, 'Not an SCRM workspace file');
  const pMap = new Map(); const vMap = new Map(); const aMap = new Map();
  let added = 0, updated = 0;
  for (const p of data.portfolios || []) pMap.set(p.id, createPortfolio(p.name, p.description).id);
  for (const v of data.vendors || []) {
    const ex = findVendor(v);
    const portfolioIds = (v.portfolioIds || []).map((x) => pMap.get(x)).filter(Boolean);
    if (ex) {
      const newer = (v.updated_at || '') > (ex.updated_at || '');
      store.put('vendors', ex.id, { ...(newer ? { ...ex, ...v } : ex), id: ex.id, latest_assessment_id: ex.latest_assessment_id, portfolioIds: [...new Set([...(ex.portfolioIds || []), ...portfolioIds])] });
      vMap.set(v.id, ex.id); updated++;
    } else {
      const id = store.nextId('vendors');
      store.put('vendors', id, { ...v, id, portfolioIds, latest_assessment_id: null }); vMap.set(v.id, id); added++;
    }
  }
  const existingKeys = new Set(store.all('assessments').map((a) => `${a.vendor_id}|${a.created_at}`));
  for (const a of (data.assessments || []).sort((x, y) => x.created_at.localeCompare(y.created_at))) {
    const vid = vMap.get(a.vendor_id); if (!vid) continue;
    const k = `${vid}|${a.created_at}`;
    if (existingKeys.has(k)) { aMap.set(a.id, store.all('assessments').find((x) => `${x.vendor_id}|${x.created_at}` === k).id); continue; }
    const id = store.nextId('assessments');
    store.put('assessments', id, { ...a, id, vendor_id: vid }); aMap.set(a.id, id); existingKeys.add(k);
  }
  // Point each vendor at its newest full assessment.
  for (const vid of new Set(vMap.values())) {
    const latest = store.all('assessments').filter((a) => a.vendor_id === vid && a.findings).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (latest) store.put('vendors', vid, { ...store.get('vendors', vid), latest_assessment_id: latest.id });
  }
  for (const act of data.actions || []) {
    const vid = vMap.get(act.vendor_id); if (!vid) continue;
    const key = `${vid}|${act.finding_key}`; const cur = store.get('actions', key);
    if (!cur || (act.updated_at || '') > (cur.updated_at || '')) store.put('actions', key, { ...act, vendor_id: vid });
  }
  audit('workspace.imported', { source, added, updated });
  return { added, updated, assessments: aMap.size };
}
r('POST', '/api/workspace/import', ({ body }) => importWorkspace(body));

/** Load the team-published workspace committed to the site (path set in config.json). */
export async function loadShared({ force = false } = {}) {
  const path = site().sharedWorkspace;
  if (!path) return { loaded: false, reason: 'No sharedWorkspace configured' };
  const res = await fetch(path, { cache: 'no-cache' }).catch(() => null);
  if (!res?.ok) return { loaded: false, reason: 'No published workspace file found' };
  const data = await res.json();
  if (!data?.vendors?.length) return { loaded: false, reason: 'The published workspace file is empty' };
  const stamp = data.exportedAt || '';
  if (!force && store.get('meta', 'sharedLoaded') === stamp) return { loaded: false, reason: 'Already up to date', exportedAt: stamp };
  const out = importWorkspace(data, { source: 'published' });
  store.put('meta', 'sharedLoaded', stamp);
  return { loaded: true, exportedAt: stamp, ...out };
}
r('POST', '/api/workspace/load-shared', () => loadShared({ force: true }));
r('POST', '/api/workspace/reset', () => {
  for (const c of store.COLLECTIONS) store.clear(c);
  store.clear('cache');
  return { ok: true };
});
