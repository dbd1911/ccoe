// REST API.
import { db, json, parse, getSetting, setSetting, publicSettings, audit, tx } from './db.js';
import { Router, HttpError, readBody } from './http-util.js';
import { runAssessment, getAssessment } from './pipeline.js';
import { SOURCES, QUESTIONS } from './connectors/catalog.js';
import { importCsl, refreshCsl, cslStats, screenParty } from './connectors/screening.js';
import * as usa from './connectors/usaspending.js';
import * as sam from './connectors/sam.js';
import { DEMO_VENDORS } from './demo/dataset.js';
import { CATEGORIES, CRITICALITY, TIERS, assess, tierFor } from './risk/engine.js';
import { LISTS, WATCH_ENTITIES, WATCHLIST_AS_OF, COUNTRY_RISK } from './reference/watchlists.js';
import { aiEnabled, chat, generateAnalysis, compactContext } from './ai/claude.js';
import { similarity } from './lib/match.js';

export const router = new Router();
const r = (m, p, h) => router.add(m, p, h);
const int = (v, name = 'id') => { const n = Number(v); if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${name}`); return n; };
const CRIT = Object.keys(CRITICALITY);
const STATUS = ['under-review', 'approved', 'conditional', 'rejected', 'offboarded'];
const DISPOSITIONS = ['open', 'mitigating', 'mitigated', 'accepted', 'false-positive'];

// ---------- meta ----------
r('GET', '/api/health', () => ({ ok: true, mode: getSetting('mode'), ai: aiEnabled(), time: new Date().toISOString() }));
r('GET', '/api/meta', () => ({ categories: CATEGORIES, criticality: CRITICALITY, tiers: TIERS, statuses: STATUS, dispositions: DISPOSITIONS,
  lists: LISTS, watchlistAsOf: WATCHLIST_AS_OF, watchEntityCount: WATCH_ENTITIES.length, countryRisk: COUNTRY_RISK }));
r('GET', '/api/settings', () => publicSettings());
r('PUT', '/api/settings', async ({ body }) => {
  for (const [k, v] of Object.entries(body || {})) {
    if (v === undefined) continue;
    if (k === 'mode' && !['live', 'demo'].includes(v)) throw new HttpError(400, 'mode must be live or demo');
    setSetting(k, v);
  }
  audit('settings.updated', Object.keys(body || {}).join(','));
  return publicSettings();
});
r('GET', '/api/sources', () => {
  const s = publicSettings();
  const status = (src) => {
    const keyMap = { sam: 'sam_api_key', 'sam-exclusions': 'sam_api_key', opensanctions: 'opensanctions_api_key' };
    if (!src.automated) return 'reference';
    if (keyMap[src.id]) return s[keyMap[src.id]].configured ? 'configured' : 'needs-key';
    if (src.id === 'csl') return cslStats().entries || s.csl_api_key.configured ? 'configured' : 'needs-data';
    return 'ready';
  };
  return { questions: QUESTIONS, sources: SOURCES.map((x) => ({ ...x, status: status(x) })), csl: cslStats(), ai: aiEnabled(), mode: getSetting('mode') };
});
r('POST', '/api/screening/refresh', async () => { const st = await refreshCsl(); audit('screening.refresh', st); return st; });
r('POST', '/api/screening/import', async ({ body }) => { const st = importCsl(body); audit('screening.import', st); return st; });
r('POST', '/api/screening/check', async ({ body }) => {
  const names = (body?.names || []).map((n) => String(n).trim()).filter(Boolean).slice(0, 200);
  const out = [];
  for (const n of names) out.push({ name: n, ...(await screenParty(n, { cslKey: getSetting('csl_api_key'), osKey: getSetting('opensanctions_api_key'), useLiveApis: getSetting('mode') !== 'demo' })) });
  audit('screening.adhoc', `${names.length} name(s)`);
  return out;
});

// ---------- entity search (resolver) ----------
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
function latestFor(vendorIds) {
  if (!vendorIds.length) return {};
  const rows = db.prepare(`SELECT a.id, a.vendor_id, a.created_at, a.score, a.tier, a.scores_json, a.findings_json, a.mode FROM assessments a
    JOIN vendors v ON v.latest_assessment_id = a.id WHERE v.id IN (${vendorIds.map(() => '?').join(',')})`).all(...vendorIds);
  const actions = db.prepare(`SELECT vendor_id, finding_key, disposition FROM finding_actions WHERE vendor_id IN (${vendorIds.map(() => '?').join(',')})`).all(...vendorIds);
  const disp = new Map(actions.map((a) => [`${a.vendor_id}|${a.finding_key}`, a.disposition]));
  const out = {};
  for (const a of rows) {
    const findings = parse(a.findings_json, []);
    const sc = parse(a.scores_json, {});
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, open = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) {
      counts[f.severity]++;
      const d = disp.get(`${a.vendor_id}|${f.key}`) || 'open';
      if (d === 'open' || d === 'mitigating') open[f.severity]++;
    }
    out[a.vendor_id] = { assessmentId: a.id, assessedAt: a.created_at, score: a.score, tier: a.tier, mode: a.mode, exposure: sc.exposure, likelihood: sc.likelihood, impact: sc.impact,
      hardStops: sc.hardStops || [], categories: (sc.categories || []).map((c) => ({ id: c.id, score: c.score })), findingCounts: counts, openCounts: open,
      findingsByCategory: findings.reduce((m, f) => ((m[f.category] = (m[f.category] || 0) + 1), m), {}) };
  }
  return out;
}

function vendorRows(portfolioId) {
  const rows = portfolioId
    ? db.prepare('SELECT v.* FROM vendors v JOIN portfolio_vendors pv ON pv.vendor_id = v.id WHERE pv.portfolio_id = ? ORDER BY v.name').all(portfolioId)
    : db.prepare('SELECT * FROM vendors ORDER BY name').all();
  const latest = latestFor(rows.map((v) => v.id));
  const memberships = db.prepare('SELECT pv.vendor_id, p.id, p.name FROM portfolio_vendors pv JOIN portfolios p ON p.id = pv.portfolio_id').all();
  return rows.map((v) => ({ ...v, tags: parse(v.tags, []), latest: latest[v.id] || null,
    portfolios: memberships.filter((m) => m.vendor_id === v.id).map((m) => ({ id: m.id, name: m.name })) }));
}

function cleanVendor(b, partial = false) {
  const out = {};
  const str = (k, max = 300) => { if (b[k] !== undefined) out[k] = b[k] == null ? null : String(b[k]).trim().slice(0, max); };
  ['name', 'uei', 'cage', 'cik', 'lei', 'website', 'country', 'state', 'vertical', 'naics', 'contract_ref', 'owner'].forEach((k) => str(k));
  str('notes', 5000);
  if (b.criticality !== undefined) { if (!CRIT.includes(b.criticality)) throw new HttpError(400, 'Invalid criticality'); out.criticality = b.criticality; }
  if (b.status !== undefined) { if (!STATUS.includes(b.status)) throw new HttpError(400, 'Invalid status'); out.status = b.status; }
  if (b.annual_spend !== undefined) out.annual_spend = Number(b.annual_spend) || 0;
  if (b.tags !== undefined) out.tags = json((Array.isArray(b.tags) ? b.tags : String(b.tags).split(',')).map((t) => String(t).trim()).filter(Boolean).slice(0, 20));
  if (out.uei) out.uei = out.uei.toUpperCase();
  if (!partial && !out.name) throw new HttpError(400, 'Vendor name is required');
  return out;
}

export function createVendor(body) {
  const v = cleanVendor(body);
  const existing = v.uei ? db.prepare('SELECT id FROM vendors WHERE uei = ?').get(v.uei) : db.prepare('SELECT id FROM vendors WHERE lower(name) = lower(?)').get(v.name);
  let id;
  if (existing) id = existing.id;
  else {
    const cols = Object.keys(v);
    id = Number(db.prepare(`INSERT INTO vendors(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`).run(...cols.map((c) => v[c])).lastInsertRowid);
    audit('vendor.created', { id, name: v.name });
  }
  for (const pid of body.portfolioIds || []) db.prepare('INSERT OR IGNORE INTO portfolio_vendors(portfolio_id, vendor_id) VALUES(?,?)').run(int(pid), id);
  return { id, existed: !!existing };
}

r('GET', '/api/vendors', ({ query }) => vendorRows(query.portfolioId ? int(query.portfolioId) : null));
r('POST', '/api/vendors', async ({ body }) => {
  const { id, existed } = createVendor(body);
  let assessment = null;
  if (body.assess) assessment = await runAssessment(id);
  return { id, existed, assessment };
});
r('GET', '/api/vendors/:id', ({ params }) => {
  const id = int(params.id);
  const v = vendorRows(null).find((x) => x.id === id);
  if (!v) throw new HttpError(404, 'Vendor not found');
  const history = db.prepare('SELECT id, created_at, score, tier, mode FROM assessments WHERE vendor_id = ? ORDER BY created_at DESC, id DESC').all(id);
  return { vendor: v, history, assessment: v.latest_assessment_id ? getAssessment(v.latest_assessment_id) : null };
});
r('PUT', '/api/vendors/:id', async ({ params, body }) => {
  const id = int(params.id); const v = cleanVendor(body, true);
  const cols = Object.keys(v);
  if (cols.length) db.prepare(`UPDATE vendors SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...cols.map((c) => v[c]), id);
  // Criticality changes the impact axis -> recompute exposure on the latest assessment without re-fetching.
  if (v.criticality) {
    const vend = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);
    if (vend?.latest_assessment_id) {
      const a = getAssessment(vend.latest_assessment_id);
      const res = assess(a.profile, { criticality: v.criticality });
      db.prepare('UPDATE assessments SET scores_json = ? WHERE id = ?').run(json({ categories: res.categories, hardStops: res.hardStops, likelihood: res.likelihood, impact: res.impact, exposure: res.exposure, methodologyVersion: res.methodologyVersion }), a.id);
    }
  }
  audit('vendor.updated', { id, fields: cols });
  return { ok: true };
});
r('DELETE', '/api/vendors/:id', ({ params }) => { const id = int(params.id); db.prepare('DELETE FROM vendors WHERE id = ?').run(id); audit('vendor.deleted', { id }); return { ok: true }; });
r('POST', '/api/vendors/:id/assess', async ({ params, body }) => runAssessment(int(params.id), { withAi: body?.ai !== false }));
r('GET', '/api/assessments/:id', ({ params }) => { const a = getAssessment(int(params.id)); if (!a) throw new HttpError(404, 'Not found'); return a; });
r('POST', '/api/assessments/:id/ai', async ({ params }) => {
  if (!aiEnabled()) throw new HttpError(400, 'Configure an Anthropic API key in Settings to enable the AI analyst.');
  const a = getAssessment(int(params.id)); if (!a) throw new HttpError(404, 'Not found');
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(a.vendorId);
  const ai = await generateAnalysis({ vendor, profile: a.profile, result: a });
  db.prepare('UPDATE assessments SET ai_json = ? WHERE id = ?').run(json(ai), a.id);
  audit('ai.analysis', { assessmentId: a.id });
  return ai;
});
r('PUT', '/api/vendors/:id/findings/:key', async ({ params, body }) => {
  const id = int(params.id);
  if (!DISPOSITIONS.includes(body?.disposition)) throw new HttpError(400, 'Invalid disposition');
  db.prepare(`INSERT INTO finding_actions(vendor_id, finding_key, disposition, note, updated_at) VALUES(?,?,?,?,datetime('now'))
    ON CONFLICT(vendor_id, finding_key) DO UPDATE SET disposition=excluded.disposition, note=excluded.note, updated_at=excluded.updated_at`)
    .run(id, params.key, body.disposition, String(body.note || '').slice(0, 2000));
  audit('finding.disposition', { vendorId: id, key: params.key, disposition: body.disposition });
  return { ok: true };
});

// ---------- portfolios ----------
r('GET', '/api/portfolios', () => db.prepare(`SELECT p.*, COUNT(pv.vendor_id) vendorCount FROM portfolios p LEFT JOIN portfolio_vendors pv ON pv.portfolio_id = p.id
  GROUP BY p.id ORDER BY p.name`).all());
r('POST', '/api/portfolios', ({ body }) => {
  const name = String(body?.name || '').trim(); if (!name) throw new HttpError(400, 'Name required');
  try { const id = Number(db.prepare('INSERT INTO portfolios(name, description) VALUES(?,?)').run(name, String(body.description || '')).lastInsertRowid); audit('portfolio.created', { id, name }); return { id }; }
  catch (e) { if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'A portfolio with that name already exists'); throw e; }
});
r('PUT', '/api/portfolios/:id', ({ params, body }) => {
  db.prepare('UPDATE portfolios SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?').run(body.name ?? null, body.description ?? null, int(params.id));
  return { ok: true };
});
r('DELETE', '/api/portfolios/:id', ({ params }) => { db.prepare('DELETE FROM portfolios WHERE id = ?').run(int(params.id)); audit('portfolio.deleted', { id: params.id }); return { ok: true }; });
r('POST', '/api/portfolios/:id/vendors', ({ params, body }) => {
  const pid = int(params.id);
  for (const vid of body.vendorIds || []) db.prepare('INSERT OR IGNORE INTO portfolio_vendors(portfolio_id, vendor_id) VALUES(?,?)').run(pid, int(vid));
  return { ok: true };
});
r('DELETE', '/api/portfolios/:id/vendors/:vid', ({ params }) => {
  db.prepare('DELETE FROM portfolio_vendors WHERE portfolio_id = ? AND vendor_id = ?').run(int(params.id), int(params.vid)); return { ok: true };
});

// ---------- bulk assessment jobs ----------
const queue = [];
let running = 0;
function pump() {
  while (running < 2 && queue.length) {
    const task = queue.shift(); running++;
    task().finally(() => { running--; pump(); });
  }
}
function updateJob(jobId, mut) {
  const j = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  const items = parse(j.items_json, []);
  mut(items);
  const done = items.filter((i) => ['done', 'error'].includes(i.status)).length;
  const status = done === items.length ? 'complete' : 'running';
  db.prepare(`UPDATE jobs SET items_json = ?, done = ?, status = ?, finished_at = CASE WHEN ? = 'complete' THEN datetime('now') ELSE finished_at END WHERE id = ?`)
    .run(json(items), done, status, status, jobId);
}
export function startBulk(entries, { portfolioId, ai = false } = {}) {
  const items = entries.map((e) => ({ ...e, status: 'queued' }));
  const jobId = Number(db.prepare("INSERT INTO jobs(kind, status, total, items_json) VALUES('bulk-assess','running',?,?)").run(items.length, json(items)).lastInsertRowid);
  items.forEach((it, idx) => queue.push(async () => {
    try {
      updateJob(jobId, (xs) => { xs[idx].status = 'running'; });
      const { status: _s, step: _st, ...fields } = it;
      const { id } = createVendor({ ...fields, portfolioIds: portfolioId ? [portfolioId] : [] });
      const a = await runAssessment(id, { withAi: ai, onProgress: (step) => updateJob(jobId, (xs) => { xs[idx].step = step; }) });
      updateJob(jobId, (xs) => Object.assign(xs[idx], { status: 'done', vendorId: id, score: a.score, tier: a.tier, step: null }));
    } catch (e) {
      updateJob(jobId, (xs) => Object.assign(xs[idx], { status: 'error', error: e.message }));
    }
  }));
  pump();
  audit('bulk.started', { jobId, count: items.length });
  return jobId;
}
r('POST', '/api/bulk', ({ body }) => {
  const entries = (body?.entries || []).map((e) => (typeof e === 'string' ? { name: e } : e))
    .map((e) => ({ name: String(e.name || '').trim(), uei: e.uei ? String(e.uei).trim().toUpperCase() : undefined, criticality: CRIT.includes(e.criticality) ? e.criticality : undefined,
      annual_spend: e.annual_spend, contract_ref: e.contract_ref }))
    .filter((e) => e.name).slice(0, 500);
  if (!entries.length) throw new HttpError(400, 'No vendor names supplied');
  let portfolioId = body.portfolioId ? int(body.portfolioId) : null;
  if (!portfolioId && body.newPortfolioName) {
    const name = String(body.newPortfolioName).trim();
    const ex = db.prepare('SELECT id FROM portfolios WHERE name = ?').get(name);
    portfolioId = ex ? ex.id : Number(db.prepare('INSERT INTO portfolios(name, description) VALUES(?,?)').run(name, 'Created from bulk import').lastInsertRowid);
  }
  return { jobId: startBulk(entries, { portfolioId, ai: !!body.ai }), portfolioId };
});
r('GET', '/api/jobs/:id', ({ params }) => {
  const j = db.prepare('SELECT * FROM jobs WHERE id = ?').get(int(params.id)); if (!j) throw new HttpError(404, 'Not found');
  return { ...j, items: parse(j.items_json, []), items_json: undefined };
});

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
      findings: assessed.reduce((t, v) => t + (v.latest.findingsByCategory[c.id] || 0), 0),
      elevated: scores.filter((s) => s >= 50).length };
  });
  // Monthly trend: portfolio average of each vendor's most recent score as of month end.
  const ids = vendors.map((v) => v.id);
  const hist = ids.length ? db.prepare(`SELECT vendor_id, created_at, score FROM assessments WHERE vendor_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at`).all(...ids) : [];
  const trend = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i + 1); d.setUTCDate(0);
    const end = d.toISOString().slice(0, 10) + ' 23:59:59';
    const last = new Map();
    for (const h of hist) if (h.created_at <= end) last.set(h.vendor_id, h.score);
    if (last.size) trend.push({ month: end.slice(0, 7), avg: Math.round([...last.values()].reduce((a, b) => a + b, 0) / last.size), vendors: last.size, high: [...last.values()].filter((s) => s >= 50).length });
  }
  // Parties & geography across the portfolio (from latest profiles).
  const countries = new Map(); const flagged = []; const agencies = new Map();
  for (const v of assessed) {
    const a = db.prepare('SELECT profile_json FROM assessments WHERE id = ?').get(v.latest.assessmentId);
    const p = parse(a?.profile_json, {});
    for (const s of p.suppliers || []) {
      const c = s.country || 'Unknown';
      const cur = countries.get(c) || { country: c, suppliers: 0, amount: 0, vendors: new Set() };
      cur.suppliers++; cur.amount += s.amount || 0; cur.vendors.add(v.name); countries.set(c, cur);
      if (s.status !== 'clear') flagged.push({ vendorId: v.id, vendor: v.name, party: s.name, role: 'supplier', status: s.status, lists: [...new Set((s.hits || []).map((h) => h.listName))] });
    }
    for (const pr of p.screening?.parents || []) if (pr.hits?.length) flagged.push({ vendorId: v.id, vendor: v.name, party: pr.name, role: pr.role, status: pr.hits.some((h) => h.strength === 'strong') ? 'flagged' : 'potential', lists: [...new Set(pr.hits.map((h) => h.listName))] });
    if (p.screening?.entity?.hits?.length) flagged.push({ vendorId: v.id, vendor: v.name, party: v.name, role: 'vendor', status: p.screening.entity.hits.some((h) => h.strength === 'strong') ? 'flagged' : 'potential', lists: [...new Set(p.screening.entity.hits.map((h) => h.listName))] });
    for (const ag of p.customers?.agencies || []) {
      const cur = agencies.get(ag.name) || { name: ag.name, amount: 0, vendors: 0 }; cur.amount += ag.amount || 0; cur.vendors++; agencies.set(ag.name, cur);
    }
  }
  const sum = (f) => assessed.reduce((t, v) => t + f(v), 0);
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
      stale: assessed.filter((v) => (now - new Date(v.latest.assessedAt + 'Z')) / 86400000 > staleDays).length, staleDays,
    },
    tierCounts, heat, categories: catAgg, trend,
    countries: [...countries.values()].map((c) => ({ ...c, vendors: [...c.vendors] })).sort((a, b) => b.amount - a.amount),
    flaggedParties: flagged.sort((a, b) => (a.status === 'flagged' ? 0 : 1) - (b.status === 'flagged' ? 0 : 1)),
    agencies: [...agencies.values()].sort((a, b) => b.amount - a.amount).slice(0, 10),
    topRisks: [...assessed].sort((a, b) => (b.latest.exposure || 0) - (a.latest.exposure || 0)).slice(0, 10)
      .map((v) => ({ id: v.id, name: v.name, score: v.latest.score, tier: v.latest.tier, exposure: v.latest.exposure, criticality: v.criticality, status: v.status, hardStops: v.latest.hardStops, open: v.latest.openCounts })),
    recent: db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 12").all(),
  };
});

// ---------- AI chat ----------
r('POST', '/api/chat', async ({ body }) => {
  if (!aiEnabled()) throw new HttpError(400, 'Configure an Anthropic API key in Settings to enable the AI analyst.');
  const question = String(body?.question || '').trim().slice(0, 4000);
  if (!question) throw new HttpError(400, 'Question required');
  let context;
  if (body.vendorId) {
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(int(body.vendorId));
    if (!vendor?.latest_assessment_id) throw new HttpError(400, 'Vendor has no assessment yet');
    const a = getAssessment(vendor.latest_assessment_id);
    context = { scope: 'vendor', ...compactContext({ vendor, profile: a.profile, result: a }), aiAssessment: a.ai };
  } else {
    const vendors = vendorRows(body.portfolioId ? int(body.portfolioId) : null);
    context = { scope: 'portfolio', vendors: vendors.map((v) => ({ name: v.name, criticality: v.criticality, status: v.status, annualSpend: v.annual_spend,
      score: v.latest?.score, tier: v.latest?.tier, exposure: v.latest?.exposure, hardStops: v.latest?.hardStops, openFindings: v.latest?.openCounts,
      findingsByCategory: v.latest?.findingsByCategory, assessedAt: v.latest?.assessedAt, vertical: v.vertical, country: v.country })) };
  }
  audit('ai.chat', { vendorId: body.vendorId || null, portfolioId: body.portfolioId || null });
  return chat({ question, context, history: Array.isArray(body.history) ? body.history : [] });
});

// ---------- exports / audit / demo ----------
r('GET', '/api/export/vendors.csv', ({ query }) => {
  const rows = vendorRows(query.portfolioId ? int(query.portfolioId) : null);
  const cols = ['name', 'uei', 'cage', 'country', 'state', 'vertical', 'naics', 'criticality', 'status', 'annual_spend', 'score', 'tier', 'exposure', 'hard_stops', 'open_critical', 'open_high', 'assessed_at', 'portfolios'];
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.join(',')].concat(rows.map((v) => [v.name, v.uei, v.cage, v.country, v.state, v.vertical, v.naics, v.criticality, v.status, v.annual_spend,
    v.latest?.score, v.latest?.tier, v.latest?.exposure, (v.latest?.hardStops || []).join('; '), v.latest?.openCounts.critical, v.latest?.openCounts.high, v.latest?.assessedAt,
    v.portfolios.map((p) => p.name).join('; ')].map(esc).join(',')));
  return { __raw: lines.join('\n'), __type: 'text/csv; charset=utf-8', __filename: 'scrm-vendors.csv' };
});
r('GET', '/api/audit', ({ query }) => db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(Math.min(500, Number(query.limit) || 200)));
r('POST', '/api/demo/seed', async () => {
  setSetting('mode', 'demo');
  const ex = db.prepare("SELECT id FROM portfolios WHERE name = 'Demo — Enterprise IT & Weapons Systems'").get();
  const pid = ex ? ex.id : Number(db.prepare('INSERT INTO portfolios(name, description) VALUES(?,?)').run('Demo — Enterprise IT & Weapons Systems', 'Fictional vendors for training and evaluation').lastInsertRowid);
  const crit = ['mission-critical', 'high', 'mission-critical', 'moderate', 'low', 'moderate', 'high', 'mission-critical'];
  const spend = [42_000_000, 11_500_000, 6_800_000, 3_100_000, 450_000, 1_900_000, 2_600_000, 18_000_000];
  const status = ['approved', 'approved', 'under-review', 'conditional', 'under-review', 'approved', 'under-review', 'approved'];
  const ids = [];
  tx(() => DEMO_VENDORS.forEach((d, i) => {
    const { id } = createVendor({ name: d.entity.name, uei: d.entity.uei, criticality: crit[i], annual_spend: spend[i], status: status[i], portfolioIds: [pid], contract_ref: `DEMO-${1000 + i}` });
    ids.push(id);
  }));
  // Back-dated history so trend charts have shape: one "earlier" assessment per vendor.
  for (const [i, id] of ids.entries()) {
    const a = await runAssessment(id, { withAi: false });
    if (db.prepare('SELECT COUNT(*) n FROM assessments WHERE vendor_id = ?').get(id).n <= 1) {
      for (const [months, delta] of [[5, -14 + i * 2], [2, -6 + i]]) {
        const sc = Math.max(0, Math.min(100, a.score + delta));
        db.prepare(`INSERT INTO assessments(vendor_id, created_at, mode, score, tier, profile_json, findings_json, scores_json, sources_json, ai_json, duration_ms)
          SELECT vendor_id, datetime('now', ?), mode, ?, ?, profile_json, findings_json, scores_json, sources_json, NULL, duration_ms FROM assessments WHERE id = ?`)
          .run(`-${months} months`, sc, tierFor(sc), a.id);
      }
    }
  }
  audit('demo.seeded', { portfolioId: pid, vendors: ids.length });
  return { portfolioId: pid, vendorIds: ids };
});
