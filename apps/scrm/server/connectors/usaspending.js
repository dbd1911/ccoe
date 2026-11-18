// USAspending.gov API (no key). Authoritative public record of federal prime awards
// (from FPDS/FABS) and first-tier subawards (from FSRS/SAM.gov subaward reporting).
// Docs: https://api.usaspending.gov/docs/endpoints
import { fetchJson, DAY } from '../lib/http.js';
import { similarity } from '../lib/match.js';

const BASE = 'https://api.usaspending.gov/api/v2';
const CONTRACTS = ['A', 'B', 'C', 'D'];
const IDVS = ['IDV_A', 'IDV_B', 'IDV_B_A', 'IDV_B_B', 'IDV_B_C', 'IDV_C', 'IDV_D', 'IDV_E'];
const GRANTS = ['02', '03', '04', '05'];
const OTHER = ['06', '07', '08', '09', '10', '11'];
const ALL_TYPES = [CONTRACTS, IDVS, GRANTS, OTHER];

export const meta = {
  id: 'usaspending', name: 'USAspending.gov', provider: 'U.S. Department of the Treasury (Bureau of the Fiscal Service)',
  url: 'https://www.usaspending.gov', docs: 'https://api.usaspending.gov/docs/endpoints', requiresKey: false,
};

function fyRange(years) {
  const now = new Date();
  const fy = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  return { start_date: `${fy - years}-10-01`, end_date: now.toISOString().slice(0, 10) };
}

function recipientFilter(entity) {
  // UEI is exact; names are a keyword search, so prefer UEI whenever we have it.
  return [entity.uei || entity.name];
}

/** Candidate recipients for a name (for the resolver / autocomplete). */
export async function searchRecipients(text, limit = 8) {
  const r = await fetchJson(`${BASE}/recipient/`, {
    method: 'POST', body: { keyword: text, award_type: 'all', limit, page: 1, order: 'desc', sort: 'amount' }, cacheTtlMs: DAY,
  });
  return (r?.results || []).map((x) => ({
    source: 'usaspending', name: x.name, uei: x.uei || null, recipientId: x.id, level: x.recipient_level,
    amount: x.amount, score: similarity(text, x.name),
  }));
}

export async function recipientProfile(recipientId) {
  const r = await fetchJson(`${BASE}/recipient/${encodeURIComponent(recipientId)}/?year=all`, { cacheTtlMs: DAY, allow404: true });
  if (!r) return null;
  return {
    name: r.name, alternateNames: r.alternate_names || [], uei: r.uei, duns: r.duns,
    parentName: r.parent_name, parentUei: r.parent_uei, parents: r.parents || [],
    businessTypes: r.business_types || [], location: r.location || {},
    totalAmount: r.total_transaction_amount, totalTransactions: r.total_transactions,
  };
}

async function byCategory(category, entity, years, limit = 10, typeCodes = CONTRACTS) {
  const r = await fetchJson(`${BASE}/search/spending_by_category/${category}/`, {
    method: 'POST', cacheTtlMs: DAY,
    body: { filters: { recipient_search_text: recipientFilter(entity), time_period: [fyRange(years)], award_type_codes: typeCodes }, limit, page: 1 },
  });
  return (r?.results || []).map((x) => ({ code: x.code, name: x.name, amount: x.amount, id: x.id }));
}

async function overTime(entity, years) {
  const r = await fetchJson(`${BASE}/search/spending_over_time/`, {
    method: 'POST', cacheTtlMs: DAY,
    body: { group: 'fiscal_year', filters: { recipient_search_text: recipientFilter(entity), time_period: [fyRange(years)], award_type_codes: CONTRACTS } },
  });
  return (r?.results || []).map((x) => ({ fy: Number(x.time_period?.fiscal_year), amount: x.aggregated_amount || 0 }))
    .filter((x) => x.fy).sort((a, b) => a.fy - b.fy);
}

async function topAwards(entity, years, limit) {
  const fields = ['Award ID', 'Recipient Name', 'Recipient UEI', 'Award Amount', 'Awarding Agency', 'Awarding Sub Agency',
    'Start Date', 'End Date', 'Description', 'NAICS', 'PSC', 'generated_internal_id', 'Contract Award Type'];
  const r = await fetchJson(`${BASE}/search/spending_by_award/`, {
    method: 'POST', cacheTtlMs: DAY,
    body: { filters: { recipient_search_text: recipientFilter(entity), time_period: [fyRange(years)], award_type_codes: CONTRACTS },
      fields, sort: 'Award Amount', order: 'desc', limit, page: 1 },
  });
  return (r?.results || []).map((x) => ({
    id: x['Award ID'], internalId: x.generated_internal_id, recipient: x['Recipient Name'], amount: x['Award Amount'] || 0,
    agency: x['Awarding Agency'], subAgency: x['Awarding Sub Agency'], start: x['Start Date'], end: x['End Date'],
    description: x.Description, naics: typeof x.NAICS === 'object' ? x.NAICS?.code : x.NAICS,
    psc: typeof x.PSC === 'object' ? x.PSC?.code : x.PSC,
    url: x.generated_internal_id ? `https://www.usaspending.gov/award/${x.generated_internal_id}` : null,
  }));
}

/** First-tier subcontractors reported under one prime award. */
async function subawardsForPrime(internalId) {
  const r = await fetchJson(`${BASE}/subawards/`, {
    method: 'POST', cacheTtlMs: DAY,
    body: { award_id: internalId, limit: 100, page: 1, sort: 'amount', order: 'desc' },
  });
  return r?.results || [];
}

/** Subawards where this entity is the SUB — reveals which primes it supplies. */
async function subawardsAsSub(entity, years) {
  const fields = ['Sub-Award ID', 'Sub-Awardee Name', 'Sub-Award Amount', 'Sub-Award Date', 'Prime Recipient Name',
    'Prime Award ID', 'Awarding Agency', 'Awarding Sub Agency', 'prime_award_generated_internal_id'];
  const body = { filters: { recipient_search_text: recipientFilter(entity), time_period: [fyRange(years)], award_type_codes: CONTRACTS },
    fields, sort: 'Sub-Award Amount', order: 'desc', limit: 100, page: 1 };
  let r;
  try {
    r = await fetchJson(`${BASE}/search/spending_by_award/`, { method: 'POST', cacheTtlMs: DAY, body: { ...body, spending_level: 'subawards' } });
  } catch {
    r = await fetchJson(`${BASE}/search/spending_by_award/`, { method: 'POST', cacheTtlMs: DAY, body: { ...body, subawards: true } });
  }
  return (r?.results || []).filter((x) => similarity(x['Sub-Awardee Name'], entity.name) >= 0.86 || !entity.uei);
}

function aggregate(rows, keyFn, amtFn, extra = () => ({})) {
  const m = new Map();
  for (const row of rows) {
    const k = keyFn(row); if (!k) continue;
    const cur = m.get(k) || { name: k, amount: 0, count: 0, ...extra(row) };
    cur.amount += Number(amtFn(row)) || 0; cur.count += 1;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.amount - a.amount);
}

/**
 * Gather federal-market profile: who buys from the entity (agencies, primes) and
 * who it buys from (first-tier subcontractors on its prime awards).
 */
export async function gather(entity, { years = 5, maxPrimeAwards = 15 } = {}) {
  const [agencies, subAgencies, naics, psc, trend, awards] = await Promise.all([
    byCategory('awarding_agency', entity, years, 15),
    byCategory('awarding_subagency', entity, years, 15),
    byCategory('naics', entity, years, 10),
    byCategory('psc', entity, years, 10),
    overTime(entity, years),
    topAwards(entity, years, Math.max(maxPrimeAwards, 25)),
  ]);
  // Grants/other assistance are tracked separately so they don't distort contract totals.
  const assistance = await byCategory('awarding_agency', entity, years, 5, [...GRANTS, ...OTHER]).catch(() => []);

  const subRows = [];
  for (const a of awards.slice(0, maxPrimeAwards)) {
    if (!a.internalId) continue;
    try {
      for (const s of await subawardsForPrime(a.internalId)) subRows.push({ ...s, primeAwardId: a.id, agency: a.agency });
    } catch { /* individual award failures are non-fatal */ }
  }
  const suppliers = aggregate(subRows, (s) => s.recipient_name, (s) => s.amount, () => ({ primeAwards: new Set(), lastDate: null }))
    .map((s) => s);
  // attach prime award ids/last dates
  for (const s of suppliers) {
    const rows = subRows.filter((r) => r.recipient_name === s.name);
    s.primeAwards = [...new Set(rows.map((r) => r.primeAwardId))];
    s.lastDate = rows.map((r) => r.action_date).filter(Boolean).sort().pop() || null;
    s.descriptions = [...new Set(rows.map((r) => r.description).filter(Boolean))].slice(0, 3);
    s.source = 'usaspending-subawards';
  }

  let primes = [];
  try {
    const asSub = await subawardsAsSub(entity, years);
    primes = aggregate(asSub, (s) => s['Prime Recipient Name'], (s) => s['Sub-Award Amount'],
      (s) => ({ agency: s['Awarding Agency'] }));
  } catch { /* optional */ }

  const total = agencies.reduce((t, a) => t + (a.amount || 0), 0);
  const dates = awards.map((a) => a.start).filter(Boolean).sort();
  return {
    totalObligated: total,
    awardCount: awards.length,
    firstAwardDate: dates[0] || null, lastAwardDate: dates[dates.length - 1] || null,
    byAgency: agencies, bySubAgency: subAgencies, naics, psc, trend, topAwards: awards.slice(0, 25),
    assistance,
    suppliers, primes,
    subawardCoverage: { primeAwardsExpanded: Math.min(awards.length, maxPrimeAwards), subawardRows: subRows.length },
  };
}
