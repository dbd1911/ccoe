// Restricted-party screening.
//  1. Built-in statutory prohibition lists (reference/watchlists.js) — always on, offline.
//  2. Consolidated Screening List (CSL) — 11 export/sanctions lists from Commerce, State
//     and Treasury (OFAC SDN, BIS Entity List, Denied Persons, Unverified, MEU, ITAR
//     debarred, NS-CMIC, SSI, FSE, etc.). Loaded locally from the free downloadable file
//     (no key) and/or queried live via the trade.gov API (subscription key).
//  3. OpenSanctions (optional key) — global sanctions, PEPs, and debarment datasets.
import { auxGet, auxPut } from '../store.js';
import { fetchJson, DAY } from '../http.js';
import { normalizeName, tokens, bestMatch, classifyMatch, similarity } from '../../core/match.js';
import { WATCH_ENTITIES, LISTS } from '../../core/watchlists.js';

export const meta = {
  csl: {
    id: 'csl', name: 'Consolidated Screening List', provider: 'International Trade Administration (Commerce, State, Treasury lists)',
    url: 'https://www.trade.gov/consolidated-screening-list', docs: 'https://developer.trade.gov/', requiresKey: false, keySetting: 'csl_api_key',
  },
  opensanctions: {
    id: 'opensanctions', name: 'OpenSanctions', provider: 'OpenSanctions.org', url: 'https://www.opensanctions.org',
    docs: 'https://api.opensanctions.org/', requiresKey: true, keySetting: 'opensanctions_api_key',
  },
  builtin: {
    id: 'builtin', name: 'Statutory Prohibition Lists (built-in)', provider: 'NDAA §889, FCC Covered List, §1260H, UFLPA, FAR 52.204-23/27',
    url: 'https://www.acquisition.gov/far/subpart-4.21', docs: null, requiresKey: false,
  },
};

const CSL_DOWNLOAD = 'https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.json';

// ---------- local CSL store (IndexedDB) ----------
// Kept as one compact array; ~20k entries is a few MB, well within browser storage.
let entries = null;
let index = null;

export async function loadCsl() {
  if (entries) return entries;
  const v = await auxGet('screening', 'csl');
  entries = v?.entries || [];
  return entries;
}

export async function importCsl(payload) {
  const rows = Array.isArray(payload) ? payload : (payload?.results || []);
  if (!rows.length) throw new Error('No screening entries found in file (expected an array or {results:[...]})');
  entries = rows.filter((r) => r?.name).map((r) => ({
    source: r.source || 'CSL', name: r.name, aliases: Array.isArray(r.alt_names) ? r.alt_names : [],
    country: [...new Set((r.addresses || []).map((a) => a.country).filter(Boolean))].join(',') || r.country || null,
    programs: r.programs || [], url: r.source_list_url || r.source_information_url || null,
  }));
  auxPut('screening', 'csl', { entries, loadedAt: new Date().toISOString() });
  index = null;
  return cslStats();
}

/** Bulk file needs no key. Some networks/browsers block it (CORS); then import the file manually. */
export async function refreshCsl() {
  const data = await fetchJson(CSL_DOWNLOAD, { timeoutMs: 120000, retries: 0 });
  return importCsl(data);
}

export async function cslStats() {
  const list = await loadCsl();
  const v = await auxGet('screening', 'csl');
  const by = {};
  for (const e of list) by[e.source] = (by[e.source] || 0) + 1;
  return { entries: list.length, loadedAt: v?.loadedAt || null,
    bySource: Object.entries(by).map(([source, n]) => ({ source, n })).sort((a, b) => b.n - a.n) };
}

function buildIndex() {
  const list = entries || [];
  const tokIdx = new Map();
  list.forEach((e, i) => {
    for (const n of [e.name, ...e.aliases]) for (const t of tokens(n)) {
      if (t.length < 3) continue;
      if (!tokIdx.has(t)) tokIdx.set(t, new Set());
      tokIdx.get(t).add(i);
    }
  });
  index = { entries: list, tokIdx };
  return index;
}

function screenLocalCsl(name) {
  const idx = index || buildIndex();
  if (!idx.entries.length) return [];
  const cand = new Set();
  for (const t of tokens(name)) { const s = idx.tokIdx.get(t); if (s && s.size < 4000) for (const i of s) cand.add(i); }
  const hits = [];
  for (const i of cand) {
    const e = idx.entries[i];
    const m = bestMatch(name, e);
    const strength = classifyMatch(m.score);
    if (strength) hits.push({
      list: 'CSL', listName: e.source, matchedName: m.matched, entryName: e.name, score: m.score, strength,
      country: e.country, programs: e.programs, url: e.url, authority: 'Consolidated Screening List', severity: 'critical',
    });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ---------- built-in lists ----------
// Single-word aliases (e.g. "Huawei", "Hikvision", "SMIC") are distinctive brand tokens: any
// party name containing one is at least a potential match, regardless of other words.
const BRANDS = WATCH_ENTITIES.map((e) => new Set(e.aliases.map(normalizeName).filter((a) => a && !a.includes(' ') && a.length >= 3)));

export function screenBuiltin(name) {
  const hits = [];
  const nameToks = new Set(tokens(name));
  for (const [i, e] of WATCH_ENTITIES.entries()) {
    const m = bestMatch(name, e);
    for (const b of BRANDS[i]) {
      if (!nameToks.has(b)) continue;
      const s = b.length >= 4 ? 0.95 : 0.88;
      if (s > m.score) { m.score = s; m.matched = e.aliases.find((a) => normalizeName(a) === b); }
    }
    const strength = classifyMatch(m.score);
    if (!strength) continue;
    for (const l of e.lists) {
      const L = LISTS[l];
      hits.push({ list: l, listName: L.name, matchedName: m.matched, entryName: e.name, score: m.score, strength,
        country: e.country, authority: L.authority, effect: L.effect, url: L.url, severity: L.severity });
    }
  }
  return hits;
}

// ---------- live APIs ----------
export async function screenCslApi(key, name) {
  const r = await fetchJson(`https://data.trade.gov/consolidated_screening_list/v1/search?${new URLSearchParams({ name, fuzzy_name: 'true', size: '10' })}`,
    { headers: { 'subscription-key': key }, cacheTtlMs: DAY / 2 });
  return (r?.results || []).map((e) => {
    const m = bestMatch(name, { name: e.name, aliases: e.alt_names || [] });
    return { list: 'CSL', listName: e.source, matchedName: m.matched, entryName: e.name, score: m.score, strength: classifyMatch(m.score),
      country: (e.addresses || []).map((a) => a.country).filter(Boolean).join(','), programs: e.programs || [],
      url: e.source_list_url, authority: 'Consolidated Screening List (live)', severity: 'critical' };
  }).filter((h) => h.strength);
}

export async function screenOpenSanctions(key, name, schema = 'Company') {
  const r = await fetchJson('https://api.opensanctions.org/match/default', {
    method: 'POST', headers: { Authorization: `ApiKey ${key}` }, cacheTtlMs: DAY / 2,
    body: { queries: { q: { schema, properties: { name: [name] } } } },
  });
  return (r?.responses?.q?.results || []).filter((x) => x.match || x.score >= 0.8).map((x) => ({
    list: 'OPENSANCTIONS', listName: `OpenSanctions: ${(x.datasets || []).slice(0, 3).join(', ')}`, matchedName: x.caption,
    entryName: x.caption, score: Math.max(x.score, similarity(name, x.caption)), strength: x.score >= 0.93 ? 'strong' : 'potential',
    topics: x.properties?.topics || x.topics || [], url: `https://www.opensanctions.org/entities/${x.id}/`,
    authority: 'OpenSanctions consolidated', severity: (x.properties?.topics || []).includes('sanction') ? 'critical' : 'high',
  }));
}

/** Screen one party name against every available list. Returns { hits, checked:[...] }. */
export async function screenParty(name, { cslKey, osKey, useLiveApis = true } = {}) {
  await loadCsl();
  const hits = [...screenBuiltin(name), ...screenLocalCsl(name)];
  const checked = ['builtin'];
  if (entries.length) checked.push('csl-local');
  const errors = [];
  if (useLiveApis && cslKey) {
    try { hits.push(...await screenCslApi(cslKey, name)); checked.push('csl-api'); } catch (e) { errors.push(`CSL API: ${e.message}`); }
  }
  if (useLiveApis && osKey) {
    try { hits.push(...await screenOpenSanctions(osKey, name)); checked.push('opensanctions'); } catch (e) { errors.push(`OpenSanctions: ${e.message}`); }
  }
  // de-duplicate by list + entry
  const seen = new Map();
  for (const h of hits) { const k = `${h.listName}|${h.entryName}`; if (!seen.has(k) || seen.get(k).score < h.score) seen.set(k, h); }
  return { hits: [...seen.values()].sort((a, b) => b.score - a.score), checked, errors };
}
