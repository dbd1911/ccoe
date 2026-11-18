// GLEIF Legal Entity Identifier API (no key). Level 2 data gives "who owns whom":
// direct and ultimate accounting-consolidating parents, and children.
// Docs: https://www.gleif.org/en/lei-data/gleif-api
import { fetchJson, DAY } from '../http.js';
import { similarity } from '../../core/match.js';

const BASE = 'https://api.gleif.org/api/v1';
const H = { Accept: 'application/vnd.api+json' };

export const meta = {
  id: 'gleif', name: 'GLEIF LEI (Level 1 & 2)', provider: 'Global Legal Entity Identifier Foundation',
  url: 'https://search.gleif.org', docs: 'https://www.gleif.org/en/lei-data/gleif-api', requiresKey: false,
};

const mapRec = (d) => d && d.attributes ? {
  lei: d.attributes.lei, name: d.attributes.entity?.legalName?.name,
  country: d.attributes.entity?.legalAddress?.country, jurisdiction: d.attributes.entity?.jurisdiction,
  status: d.attributes.entity?.status, category: d.attributes.entity?.category,
  hqCountry: d.attributes.entity?.headquartersAddress?.country,
  registrationStatus: d.attributes.registration?.status,
  url: `https://search.gleif.org/#/record/${d.attributes.lei}`,
} : null;

export async function search(name, { country } = {}) {
  const params = new URLSearchParams({ 'filter[fulltext]': name, 'page[size]': '10' });
  const r = await fetchJson(`${BASE}/lei-records?${params}`, { headers: H, cacheTtlMs: DAY });
  return (r?.data || []).map(mapRec).map((x) => ({ ...x, score: similarity(name, x.name) + (country && x.country === country ? 0.02 : 0) }))
    .sort((a, b) => b.score - a.score);
}

async function rel(lei, kind) {
  const r = await fetchJson(`${BASE}/lei-records/${lei}/${kind}`, { headers: H, cacheTtlMs: DAY, allow404: true });
  if (!r) return null;
  if (Array.isArray(r.data)) return r.data.map(mapRec);
  return mapRec(r.data);
}

async function exception(lei, kind) {
  const r = await fetchJson(`${BASE}/lei-records/${lei}/${kind}-parent-reporting-exception`, { headers: H, cacheTtlMs: DAY, allow404: true });
  return r?.data?.attributes?.reason || null;
}

export async function ownership(lei) {
  const [directParent, ultimateParent, children] = await Promise.all([
    rel(lei, 'direct-parent'), rel(lei, 'ultimate-parent'), rel(lei, 'direct-children?page[size]=50'),
  ]);
  const [directException, ultimateException] = await Promise.all([
    directParent ? null : exception(lei, 'direct').catch(() => null),
    ultimateParent ? null : exception(lei, 'ultimate').catch(() => null),
  ]);
  return { directParent, ultimateParent, children: children || [], directException, ultimateException };
}
