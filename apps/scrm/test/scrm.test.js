// Run with: npm test  (uses an isolated temporary database)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrm-test-'));
process.env.SCRM_DB = path.join(tmp, 'test.db');
process.env.SCRM_MODE = 'demo';
delete process.env.ANTHROPIC_API_KEY;

const { similarity, normalizeName } = await import('../server/lib/match.js');
const { screenBuiltin, importCsl, screenParty } = await import('../server/connectors/screening.js');
const { assess } = await import('../server/risk/engine.js');
const { createServer } = await import('../server/index.js');

let server, base;
before(async () => { server = createServer(); await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(() => server.close());
const call = async (method, p, body) => {
  const r = await fetch(base + p, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, body: ct.includes('json') ? await r.json() : await r.text(), headers: r.headers };
};

test('name normalization strips legal suffixes and punctuation', () => {
  assert.equal(normalizeName('Huawei Technologies Co., Ltd.'), 'huawei');
  assert.equal(similarity('Lockheed Martin Corporation', 'LOCKHEED MARTIN CORP'), 1);
});

test('matcher avoids generic-word false positives', () => {
  assert.ok(similarity('Shenzhen Crestline Semiconductor Group', 'Semiconductor Manufacturing International Corporation') < 0.86);
  assert.ok(similarity('Mobile Communications Inc', 'China Mobile') < 0.86);
  assert.ok(similarity('Global Systems Inc', 'Global Solutions LLC') < 0.86);
});

test('built-in lists catch §889 entities and their brand names', () => {
  const lists = (n) => screenBuiltin(n).filter((h) => h.strength === 'strong').map((h) => h.list);
  assert.ok(lists('Hangzhou Hikvision Digital Technology Co., Ltd.').includes('S889'));
  assert.ok(lists('Huawei Device USA Inc').includes('S889'));
  assert.ok(lists('AO Kaspersky Lab').includes('KAS'));
  assert.deepEqual(lists('Northwind Avionics Inc.'), []);
});

test('local CSL import is searchable', async () => {
  importCsl({ results: [{ name: 'Example Restricted Trading Co', alt_names: ['ERT Co'], source: 'Entity List (EL) - Bureau of Industry and Security', addresses: [{ country: 'CN' }] }] });
  const r = await screenParty('Example Restricted Trading Company Limited', { useLiveApis: false });
  assert.ok(r.hits.some((h) => h.list === 'CSL' && h.strength === 'strong'));
  importCsl({ results: [{ name: 'placeholder entity zzzz', source: 'test' }] });
});

test('engine: clean profile scores low; prohibited supplier is a hard stop', () => {
  const clean = assess({ entity: { name: 'Clean Co', registration: { status: 'Active', expirationDate: '2099-01-01' } }, federal: { totalObligated: 5e6, trend: [] }, suppliers: [], customers: {}, screening: { entity: { hits: [] } } });
  assert.equal(clean.tier, 'low');
  const hits = screenBuiltin('Zhejiang Dahua Technology Co., Ltd.');
  const bad = assess({ entity: { name: 'Bad Co' }, federal: { totalObligated: 5e6, trend: [] }, suppliers: [{ name: 'Zhejiang Dahua Technology Co., Ltd.', amount: 1e5, count: 1, hits }], customers: {}, screening: { entity: { hits: [] } } });
  assert.equal(bad.tier, 'critical');
  assert.ok(bad.hardStops.length >= 1);
  assert.ok(bad.findings.every((f) => f.key && f.recommendation));
});

test('engine: active exclusion and adversary parent', () => {
  const r = assess({ entity: { name: 'X' }, exclusions: [{ name: 'X', terminationDate: '2099-01-01', type: 'Ineligible' }], ownership: { ultimateParent: { name: 'P', country: 'RU' } }, suppliers: [], customers: {}, screening: { entity: { hits: [] } } });
  assert.ok(r.score >= 85);
  assert.ok(r.findings.some((f) => f.category === 'foreign' && f.severity === 'critical'));
});

test('engine: inactive SAM registration is flagged (and "Inactive" is not read as active)', () => {
  const r = assess({ entity: { name: 'Y', registration: { status: 'Inactive', expirationDate: '2020-01-01' } }, suppliers: [], customers: {}, screening: { entity: { hits: [] } } });
  assert.ok(r.findings.some((f) => /registration inactive/i.test(f.title)));
});

test('API: demo seed, dashboard, vendor detail, dispositions, CSV export', async () => {
  const seed = await call('POST', '/api/demo/seed');
  assert.equal(seed.status, 200);
  assert.equal(seed.body.vendorIds.length, 8);
  const dash = await call('GET', `/api/dashboard?portfolioId=${seed.body.portfolioId}`);
  assert.equal(dash.body.kpis.assessed, 8);
  assert.ok(dash.body.kpis.hardStops >= 2);
  assert.ok(dash.body.trend.length >= 2);
  const vs = (await call('GET', '/api/vendors')).body;
  const crest = vs.find((v) => v.name.startsWith('Crestline'));
  assert.equal(crest.latest.tier, 'critical');
  assert.equal(vs.find((v) => v.name.startsWith('Northwind')).latest.tier, 'low');
  const detail = (await call('GET', `/api/vendors/${crest.id}`)).body;
  assert.ok(detail.assessment.profile.suppliers.some((s) => s.status === 'flagged'));
  const f = detail.assessment.findings[0];
  const put = await call('PUT', `/api/vendors/${crest.id}/findings/${encodeURIComponent(f.key)}`, { disposition: 'mitigating', note: 'Prime notified' });
  assert.equal(put.status, 200);
  const again = (await call('GET', `/api/vendors/${crest.id}`)).body;
  assert.equal(again.assessment.findings.find((x) => x.key === f.key).disposition, 'mitigating');
  const csv = await call('GET', '/api/export/vendors.csv');
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.body, /Crestline Microelectronics/);
});

test('API: unknown vendor in demo mode is still screened (prohibited name => critical)', async () => {
  const { body } = await call('POST', '/api/vendors', { name: 'Hytera Communications Corporation Limited', assess: true });
  assert.equal(body.assessment.tier, 'critical');
});

test('API: bulk job completes', async () => {
  const { body } = await call('POST', '/api/bulk', { entries: ['Helix Data Systems LLC', 'Summit Ridge Analytics Inc.'], newPortfolioName: 'Bulk test' });
  let job;
  for (let i = 0; i < 50; i++) { job = (await call('GET', `/api/jobs/${body.jobId}`)).body; if (job.status === 'complete') break; await new Promise((r) => setTimeout(r, 100)); }
  assert.equal(job.status, 'complete');
  assert.ok(job.items.every((i) => i.status === 'done'), JSON.stringify(job.items));
});

test('API: input validation, CSRF guard and secret handling', async () => {
  assert.equal((await call('POST', '/api/vendors', { name: '' })).status, 400);
  assert.equal((await call('PUT', '/api/vendors/1', { criticality: 'extreme' })).status, 400);
  const r = await fetch(`${base}/api/portfolios`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{"name":"x"}' });
  assert.equal(r.status, 403);
  await call('PUT', '/api/settings', { sam_api_key: 'SECRET-123' });
  const s = await call('GET', '/api/settings');
  assert.equal(s.body.sam_api_key.value, '');
  assert.equal(s.body.sam_api_key.configured, true);
  assert.ok(!JSON.stringify(s.body).includes('SECRET-123'));
  assert.equal((await call('POST', '/api/chat', { question: 'hi' })).status, 400); // AI not configured
});

test('static files are served with security headers and no path traversal', async () => {
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  const t = await fetch(`${base}/..%2f..%2fpackage.json`);
  assert.notEqual(t.status, 200);
});
