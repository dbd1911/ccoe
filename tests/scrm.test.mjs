// SCRM Sentinel (tools/scrm) — run from the site root:  node --test tests/scrm.test.mjs
// Exercises the in-browser backend under Node (no IndexedDB -> in-memory store), including a
// local fake of the GenAI.mil OpenAI-compatible endpoint.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const { similarity, normalizeName } = await import('../tools/scrm/js/core/match.js');
const { screenBuiltin, importCsl, screenParty } = await import('../tools/scrm/js/backend/connectors/screening.js');
const { assess } = await import('../tools/scrm/js/core/engine.js');
const { match } = await import('../tools/scrm/js/backend/routes.js');
const settings = await import('../tools/scrm/js/backend/settings.js');
const llm = await import('../tools/scrm/js/backend/llm.js');

const call = async (method, url, body) => {
  const u = new URL(url, 'http://x'); const m = match(method, u.pathname);
  assert.ok(m, `route ${method} ${u.pathname}`);
  return m.handler({ params: m.params, query: Object.fromEntries(u.searchParams), body: body ?? {} });
};
const status = async (p) => { try { await p; return 200; } catch (e) { return e.status || 500; } };

// Fake GenAI.mil endpoint
let fake, fakeUrl, lastReq;
before(async () => {
  settings.setSetting('mode', 'demo');
  fake = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => {
      lastReq = { headers: req.headers, body: JSON.parse(b) };
      if (req.headers.authorization !== 'Bearer good-key') { res.writeHead(401); return res.end('{"error":"bad key"}'); }
      const wantsJson = lastReq.body.messages.some((m) => /Respond with ONLY a JSON object/.test(m.content));
      const content = wantsJson ? '```json\n' + JSON.stringify({ executiveSummary: 'Summary.', decision: 'escalate', decisionRationale: 'Because.', keyRisks: [{ title: 'Parent in PRC', severity: 'critical', explanation: 'x' }],
        mitigations: [{ action: 'Require SF 328', owner: 'Contracting Officer', timing: 'pre-award', reference: '32 CFR 117' }], vendorQuestions: ['Who owns you?'], dataGaps: ['Ownership'], confidence: 'medium' }) + '\n```' : 'ready';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: lastReq.body.model, choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
    });
  });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  fakeUrl = `http://127.0.0.1:${fake.address().port}/v1/chat/completions`;
});
after(() => fake.close());

test('name normalization and false-positive guards', () => {
  assert.equal(normalizeName('Huawei Technologies Co., Ltd.'), 'huawei');
  assert.equal(similarity('Lockheed Martin Corporation', 'LOCKHEED MARTIN CORP'), 1);
  assert.ok(similarity('Shenzhen Crestline Semiconductor Group', 'Semiconductor Manufacturing International Corporation') < 0.86);
  assert.ok(similarity('Mobile Communications Inc', 'China Mobile') < 0.86);
});

test('built-in lists catch §889 entities and brand names', () => {
  const lists = (n) => screenBuiltin(n).filter((h) => h.strength === 'strong').map((h) => h.list);
  assert.ok(lists('Hangzhou Hikvision Digital Technology Co., Ltd.').includes('S889'));
  assert.ok(lists('Huawei Device USA Inc').includes('S889'));
  assert.ok(lists('AO Kaspersky Lab').includes('KAS'));
  assert.deepEqual(lists('Northwind Avionics Inc.'), []);
});

test('local CSL import is searchable', async () => {
  await importCsl({ results: [{ name: 'Example Restricted Trading Co', alt_names: ['ERT Co'], source: 'Entity List (EL) - Bureau of Industry and Security', addresses: [{ country: 'CN' }] }] });
  const r = await screenParty('Example Restricted Trading Company Limited', { useLiveApis: false });
  assert.ok(r.hits.some((h) => h.list === 'CSL' && h.strength === 'strong'));
});

test('engine: clean vs prohibited supplier vs exclusion', () => {
  const clean = assess({ entity: { name: 'Clean Co', registration: { status: 'Active', expirationDate: '2099-01-01' } }, federal: { totalObligated: 5e6, trend: [] }, suppliers: [], customers: {}, screening: { entity: { hits: [] } } });
  assert.equal(clean.tier, 'low');
  const bad = assess({ entity: { name: 'Bad Co' }, federal: { totalObligated: 5e6, trend: [] }, suppliers: [{ name: 'Zhejiang Dahua Technology', amount: 1e5, count: 1, hits: screenBuiltin('Zhejiang Dahua Technology Co., Ltd.') }], customers: {}, screening: { entity: { hits: [] } } });
  assert.equal(bad.tier, 'critical');
  const ex = assess({ entity: { name: 'X' }, exclusions: [{ name: 'X', terminationDate: '2099-01-01', type: 'Ineligible' }], suppliers: [], customers: {}, screening: { entity: { hits: [] } } });
  assert.ok(ex.score >= 85);
  const inactive = assess({ entity: { name: 'Y', registration: { status: 'Inactive' } }, suppliers: [], customers: {}, screening: { entity: { hits: [] } } });
  assert.ok(inactive.findings.some((f) => /registration inactive/i.test(f.title)));
});

test('demo seed, dashboard, dispositions, CSV export', async () => {
  const seed = await call('POST', '/api/demo/seed');
  assert.equal(seed.vendorIds.length, 8);
  const dash = await call('GET', `/api/dashboard?portfolioId=${seed.portfolioId}`);
  assert.equal(dash.kpis.assessed, 8);
  assert.ok(dash.kpis.hardStops >= 2);
  assert.ok(dash.trend.length >= 2);
  const vs = await call('GET', '/api/vendors');
  const crest = vs.find((v) => v.name.startsWith('Crestline'));
  assert.equal(crest.latest.tier, 'critical');
  assert.equal(vs.find((v) => v.name.startsWith('Northwind')).latest.tier, 'low');
  const d = await call('GET', `/api/vendors/${crest.id}`);
  const f = d.assessment.findings[0];
  await call('PUT', `/api/vendors/${crest.id}/findings/${encodeURIComponent(f.key)}`, { disposition: 'mitigating', note: 'Prime notified' });
  assert.equal((await call('GET', `/api/vendors/${crest.id}`)).assessment.findings.find((x) => x.key === f.key).disposition, 'mitigating');
  const csv = await call('GET', '/api/export/vendors.csv');
  assert.match(csv.__download, /Crestline Microelectronics/);
});

test('unknown name in demo mode is still screened; bulk job completes', async () => {
  const { assessment } = await call('POST', '/api/vendors', { name: 'Hytera Communications Corporation Limited', assess: true });
  assert.equal(assessment.tier, 'critical');
  const { jobId } = await call('POST', '/api/bulk', { entries: ['Helix Data Systems LLC', 'Summit Ridge Analytics Inc.'], newPortfolioName: 'Bulk test' });
  let job;
  for (let i = 0; i < 50; i++) { job = await call('GET', `/api/jobs/${jobId}`); if (job.status === 'complete') break; await new Promise((r) => setTimeout(r, 50)); }
  assert.equal(job.status, 'complete');
  assert.ok(job.items.every((i) => i.status === 'done'), JSON.stringify(job.items));
});

test('workspace: summary export is compact, never contains keys, and round-trips', async () => {
  settings.setSetting('llm_api_key', 'SUPER-SECRET-KEY');
  const full = await call('GET', '/api/workspace/export?kind=full');
  const sum = await call('GET', '/api/workspace/export?kind=summary');
  assert.ok(!full.__download.includes('SUPER-SECRET-KEY') && !sum.__download.includes('SUPER-SECRET-KEY'));
  assert.ok(sum.__download.length < full.__download.length);
  const data = JSON.parse(sum.__download);
  const perVendor = sum.__download.length / data.vendors.length;
  assert.ok(perVendor < 40000, `summary is ${Math.round(perVendor)} bytes/vendor`);
  await call('POST', '/api/workspace/reset');
  assert.equal((await call('GET', '/api/vendors')).length, 0);
  const res = await call('POST', '/api/workspace/import', data);
  assert.equal(res.added, data.vendors.length);
  const vs = await call('GET', '/api/vendors');
  assert.equal(vs.find((v) => v.name.startsWith('Crestline')).latest.tier, 'critical');
  const again = await call('POST', '/api/workspace/import', data); // idempotent merge
  assert.equal(again.added, 0);
  assert.equal((await call('GET', '/api/vendors')).length, data.vendors.length);
  assert.equal(await status(call('POST', '/api/workspace/import', { hello: 1 })), 400);
});

test('settings: secrets are never returned', async () => {
  const s = await call('GET', '/api/settings');
  assert.equal(s.llm_api_key.value, '');
  assert.equal(s.llm_api_key.configured, true);
  assert.ok(!JSON.stringify(s).includes('SUPER-SECRET-KEY'));
  assert.equal(s.llm_endpoint.value, 'https://api.genai.mil/v1/chat/completions');
  assert.equal(s.llm_model.value, 'gemini-2.5-flash');
});

test('GenAI (OpenAI-compatible): bad key, test connection, analysis, chat', async () => {
  settings.setSetting('llm_endpoint', fakeUrl);
  settings.setSetting('llm_api_key', 'wrong');
  await assert.rejects(llm.testConnection(), /rejected the API key/);
  settings.setSetting('llm_api_key', 'good-key');
  const t = await call('POST', '/api/llm/test');
  assert.equal(t.ok, true);
  assert.equal(lastReq.headers.authorization, 'Bearer good-key');
  assert.equal(lastReq.body.model, 'gemini-2.5-flash');
  const crest = (await call('GET', '/api/vendors')).find((v) => v.name.startsWith('Crestline'));
  const ai = await call('POST', `/api/assessments/${crest.latest.assessmentId}/ai`);
  assert.equal(ai.decision, 'escalate');
  assert.equal(ai.mitigations[0].owner, 'Contracting Officer');
  assert.ok(JSON.stringify(lastReq.body).includes('<assessment_data>'));
  const c = await call('POST', '/api/chat', { vendorId: crest.id, question: 'Summarize' });
  assert.equal(c.answer, 'ready');
});

test('validation errors', async () => {
  assert.equal(await status(call('POST', '/api/vendors', { name: '' })), 400);
  assert.equal(await status(call('PUT', '/api/vendors/1', { criticality: 'extreme' })), 400);
});
