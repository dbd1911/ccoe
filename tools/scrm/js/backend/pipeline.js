// Assessment pipeline: resolve identity -> gather public data -> screen every party
// (vendor, parents, suppliers, customers) -> score -> persist.
import * as store from './store.js';
import { getSetting } from './settings.js';
import { audit } from './audit.js';
import * as usa from './connectors/usaspending.js';
import * as sam from './connectors/sam.js';
import * as gleif from './connectors/gleif.js';
import * as media from './connectors/media.js';
import * as kevSrc from './connectors/kev.js';
import { screenParty } from './connectors/screening.js';
import { assess } from '../core/engine.js';
import { verticalFromNaics, verticalFromSic, toIso2 } from '../core/watchlists.js';
import { DEMO_VENDORS, demoRaw } from '../core/dataset.js';
import { similarity } from '../core/match.js';
import { generateAnalysis, aiEnabled } from './llm.js';

const MAX_SCREEN_SUPPLIERS = 75;

class Tracker {
  constructor(onProgress) { this.sources = []; this.onProgress = onProgress || (() => {}); }
  async step(id, label, fn, { skip } = {}) {
    if (skip) { this.sources.push({ id, label, status: 'skipped', detail: skip }); return null; }
    const t0 = Date.now();
    this.onProgress(label);
    try {
      const r = await fn();
      this.sources.push({ id, label, status: 'ok', ms: Date.now() - t0, detail: r == null ? 'No record found' : undefined });
      return r;
    } catch (e) {
      this.sources.push({ id, label, status: 'error', ms: Date.now() - t0, detail: e.message });
      return null;
    }
  }
}

export function findDemo(vendor) {
  let best = null;
  for (const d of DEMO_VENDORS) {
    const s = vendor.uei && vendor.uei === d.entity.uei ? 1 : similarity(vendor.name, d.entity.name);
    if (!best || s > best.s) best = { d, s };
  }
  return best && best.s >= 0.9 ? best.d : null;
}

async function gatherDemo(vendor, tr) {
  const rec = findDemo(vendor);
  await tr.step('demo', 'Demo dataset', async () => rec ? 'ok' : null);
  if (!rec) {
    return { entity: { name: vendor.name, legalName: vendor.name, uei: vendor.uei, country: vendor.country }, ownership: {}, federal: null,
      suppliers: [], primes: [], exclusions: [], proceedings: [], sec: null, media: [], kev: null, demoMiss: true };
  }
  return demoRaw(rec);
}

async function gatherLive(vendor, tr) {
  const years = Number(getSetting('lookback_years')) || 5;
  const maxPrimeAwards = Number(getSetting('max_prime_awards')) || 15;
  const samKey = getSetting('sam_api_key');
  const entity = { name: vendor.name, uei: vendor.uei || null, cage: vendor.cage || null, cik: vendor.cik || null, lei: vendor.lei || null, country: vendor.country || null };

  // 1. Identity resolution
  const samEntity = await tr.step('sam', 'SAM.gov entity registration', () => sam.lookupEntity(samKey, entity),
    { skip: samKey ? null : 'No SAM.gov API key configured' });
  if (samEntity) Object.assign(entity, { uei: samEntity.uei || entity.uei, cage: samEntity.cage || entity.cage });

  const recip = await tr.step('usaspending-recipient', 'USAspending recipient profile', async () => {
    const cands = await usa.searchRecipients(entity.uei || entity.name, 10);
    const pick = cands.filter((c) => (entity.uei ? c.uei === entity.uei : c.score >= 0.9)).sort((a, b) => (b.level === 'P') - (a.level === 'P') || b.amount - a.amount)[0]
      || cands.find((c) => c.score >= 0.95);
    if (!pick) return null;
    const prof = await usa.recipientProfile(pick.recipientId);
    return prof ? { ...prof, recipientId: pick.recipientId } : null;
  });
  if (recip?.uei && !entity.uei) entity.uei = recip.uei;

  const secProf = null; // SEC EDGAR blocks browser (CORS) requests; see Data Sources.
  const [federal, exclusions, gl, mediaHits, kev] = await Promise.all([
    tr.step('usaspending', 'USAspending awards, agencies & subawards', () => usa.gather(entity, { years, maxPrimeAwards })),
    tr.step('sam-exclusions', 'SAM.gov exclusions', () => sam.exclusions(samKey, { uei: entity.uei, name: samEntity?.legalName || entity.name }),
      { skip: samKey ? null : 'No SAM.gov API key configured' }),
    tr.step('gleif', 'GLEIF legal entity & ownership', async () => {
      let rec = null;
      if (entity.lei) rec = { lei: entity.lei };
      else {
        const hits = await gleif.search(samEntity?.legalName || entity.name, { country: toIso2(samEntity?.address?.country || entity.country) });
        rec = hits.find((h) => h.score >= 0.95);
      }
      if (!rec) return null;
      return { record: rec, ...(await gleif.ownership(rec.lei)) };
    }),
    tr.step('gdelt', 'Adverse media (GDELT)', () => media.search(samEntity?.legalName || entity.name),
      { skip: getSetting('enable_media') === 'false' ? 'Disabled in settings' : null }),
    tr.step('kev', 'CISA Known Exploited Vulnerabilities', () => kevSrc.forVendor(entity.name),
      { skip: getSetting('enable_kev') === 'false' ? 'Disabled in settings' : null }),
  ]);

  const loc = recip?.location || {};
  const naicsPrimary = samEntity?.primaryNaics || federal?.naics?.[0]?.code || vendor.naics || null;
  return {
    entity: {
      name: entity.name, legalName: samEntity?.legalName || recip?.name || secProf?.name || gl?.record?.name || entity.name,
      dba: samEntity?.dba, uei: entity.uei, cage: entity.cage, cik: secProf?.cik || entity.cik, lei: gl?.record?.lei || entity.lei,
      website: samEntity?.website || secProf?.website || vendor.website,
      country: toIso2(samEntity?.address?.country || loc.country_code || gl?.record?.country || entity.country),
      state: samEntity?.address?.state || loc.state_code || secProf?.businessAddress?.stateOrCountry, city: samEntity?.address?.city || loc.city_name,
      incorporationCountry: toIso2(samEntity?.incorporationCountry), incorporationState: samEntity?.incorporationState || secProf?.stateOfIncorporation,
      structure: samEntity?.structure, startDate: samEntity?.startDate,
      businessTypes: [...new Set([...(samEntity?.businessTypes || []), ...(recip?.businessTypes || []).map((b) => b.replace(/_/g, ' '))])],
      naicsPrimary, naics: samEntity?.naics || [], sic: secProf?.sic, sicDescription: secProf?.sicDescription,
      tickers: secProf?.tickers || [], exchanges: secProf?.exchanges || [], formerNames: secProf?.formerNames || [], alternateNames: recip?.alternateNames || [],
      registration: samEntity ? { status: samEntity.registrationStatus, expirationDate: samEntity.expirationDate, exclusionFlag: samEntity.exclusionFlag } : null,
    },
    ownership: {
      immediateParent: samEntity?.immediateParent || (recip?.parentName && recip.parentUei !== entity.uei ? { name: recip.parentName, uei: recip.parentUei } : null),
      ultimateParent: samEntity?.ultimateParent || null,
      gleif: gl ? { directParent: gl.directParent, ultimateParent: gl.ultimateParent, children: gl.children, directException: gl.directException, ultimateException: gl.ultimateException } : null,
    },
    federal, suppliers: federal?.suppliers || [], primes: federal?.primes || [],
    exclusions: exclusions || [], proceedings: samEntity?.proceedings || [], sec: secProf, media: mediaHits || [], kev,
  };
}

async function screenAll(raw, tr) {
  const cslKey = getSetting('csl_api_key'), osKey = getSetting('opensanctions_api_key');
  const live = getSetting('mode') !== 'demo';
  const opts = { cslKey, osKey, useLiveApis: live };
  const errors = new Set(); const checked = new Set();
  const run = async (n, o = opts) => { const r = await screenParty(n, o); r.checked.forEach((c) => checked.add(c)); r.errors.forEach((x) => errors.add(x)); return r.hits; };

  await tr.step('screening', 'Restricted-party screening (vendor, owners, suppliers, customers)', async () => {
    const names = [...new Set([raw.entity.legalName, raw.entity.name, raw.entity.dba, ...(raw.entity.formerNames || [])].filter(Boolean))];
    const entityHits = [];
    for (const n of names) entityHits.push(...await run(n));
    const dedup = new Map(); for (const h of entityHits) { const k = `${h.listName}|${h.entryName}`; if (!dedup.has(k) || dedup.get(k).score < h.score) dedup.set(k, h); }
    const parents = [];
    const o = raw.ownership || {};
    const seen = new Set();
    for (const [role, p] of [['immediate parent', o.immediateParent], ['ultimate parent', o.ultimateParent], ['immediate parent', o.gleif?.directParent], ['ultimate parent', o.gleif?.ultimateParent]]) {
      if (!p?.name || seen.has(p.name.toLowerCase())) continue; seen.add(p.name.toLowerCase());
      parents.push({ name: p.name, role, hits: await run(p.name) });
    }
    // Suppliers & customers: local lists always; live APIs only for the largest suppliers to respect rate limits.
    const sorted = [...raw.suppliers].sort((a, b) => b.amount - a.amount);
    for (const [i, s] of sorted.slice(0, MAX_SCREEN_SUPPLIERS).entries()) s.hits = await run(s.name, { ...opts, useLiveApis: opts.useLiveApis && i < 15 });
    for (const p of raw.primes) p.hits = await run(p.name, { ...opts, useLiveApis: false });
    raw.screening = { entity: { hits: [...dedup.values()] }, parents, listsChecked: [...checked], errors: [...errors] };
    return true;
  });
}

function partyStatus(hits = []) {
  if (hits.some((h) => h.strength === 'strong')) return 'flagged';
  if (hits.length) return 'potential';
  return 'clear';
}

export async function runAssessment(vendorId, { onProgress, withAi = true } = {}) {
  const vendor = store.get('vendors', vendorId);
  if (!vendor) throw new Error('Vendor not found');
  const t0 = Date.now();
  const mode = getSetting('mode') === 'demo' ? 'demo' : 'live';
  const tr = new Tracker(onProgress);
  const raw = mode === 'demo' ? await gatherDemo(vendor, tr) : await gatherLive(vendor, tr);
  await screenAll(raw, tr);
  raw.sourcesChecked = tr.sources.filter((s) => s.status === 'ok').map((s) => s.id);
  raw.entity.vertical = verticalFromNaics(raw.entity.naicsPrimary) || verticalFromSic(raw.entity.sic, raw.entity.sicDescription) || vendor.vertical || null;
  for (const s of raw.suppliers) s.status = partyStatus(s.hits);
  for (const p of raw.primes) p.status = partyStatus(p.hits);
  const profile = { ...raw, customers: { agencies: raw.federal?.byAgency || [], subAgencies: raw.federal?.bySubAgency || [], primes: raw.primes } };
  delete profile.primes;
  if (profile.federal) { delete profile.federal.suppliers; delete profile.federal.primes; }

  const result = assess(profile, { criticality: vendor.criticality });
  let ai = null;
  if (withAi && aiEnabled()) {
    onProgress?.('AI analyst narrative');
    try { ai = await generateAnalysis({ vendor, profile, result }); tr.sources.push({ id: 'ai', label: 'AI analyst', status: 'ok' }); }
    catch (e) { tr.sources.push({ id: 'ai', label: 'AI analyst', status: 'error', detail: e.message }); }
  }
  const id = store.nextId('assessments');
  store.put('assessments', id, {
    id, vendor_id: vendorId, created_at: nowSql(), mode, score: result.score, tier: result.tier, profile, findings: result.findings,
    scores: { categories: result.categories, hardStops: result.hardStops, likelihood: result.likelihood, impact: result.impact, exposure: result.exposure, methodologyVersion: result.methodologyVersion },
    sources: tr.sources, ai, duration_ms: Date.now() - t0,
  });
  // Enrich the vendor record with resolved identifiers (never overwrite analyst-entered values).
  const e = profile.entity;
  const keep = (a, b) => (a != null && a !== '' ? a : b ?? null);
  store.put('vendors', vendorId, { ...vendor, latest_assessment_id: id, uei: keep(vendor.uei, e.uei), cage: keep(vendor.cage, e.cage), cik: keep(vendor.cik, e.cik),
    lei: keep(vendor.lei, e.lei), country: keep(vendor.country, e.country), state: keep(vendor.state, e.state), vertical: e.vertical || vendor.vertical || null,
    naics: e.naicsPrimary || vendor.naics || null, website: keep(vendor.website, e.website), updated_at: nowSql() });
  audit('assessment.completed', { vendorId, assessmentId: id, score: result.score, tier: result.tier, mode });
  return getAssessment(id);
}

export const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export function getAssessment(id) {
  const a = store.get('assessments', id);
  if (!a) return null;
  const findings = (a.findings || []).map((f) => {
    const act = store.get('actions', `${a.vendor_id}|${f.key}`);
    return { ...f, disposition: act?.disposition || 'open', dispositionNote: act?.note || '' };
  });
  return { id: a.id, vendorId: a.vendor_id, createdAt: a.created_at, mode: a.mode, score: a.score, tier: a.tier,
    profile: a.profile, findings, ...(a.scores || {}), sources: a.sources || [], ai: a.ai, durationMs: a.duration_ms, summaryOnly: !a.profile?.entity };
}
