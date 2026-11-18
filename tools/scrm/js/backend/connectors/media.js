// Adverse-media screening via the GDELT 2.0 DOC API (no key; global news index).
// Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
import { fetchJson, DAY } from '../http.js';

export const meta = {
  id: 'gdelt', name: 'GDELT Global News (adverse media)', provider: 'The GDELT Project', url: 'https://www.gdeltproject.org',
  docs: 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/', requiresKey: false,
};

export const RISK_TERMS = {
  sanctions: ['sanction', 'ofac', 'entity list', 'export control', 'embargo', 'itar'],
  fraud: ['fraud', 'false claims', 'kickback', 'bribery', 'brib', 'corruption', 'embezzle', 'qui tam', 'indict'],
  cyber: ['breach', 'ransomware', 'hack', 'cyberattack', 'data leak', 'vulnerability', 'compromise'],
  forcedLabor: ['forced labor', 'uyghur', 'xinjiang', 'uflpa'],
  legal: ['lawsuit', 'settle', 'penalty', 'fine', 'debar', 'suspend', 'investigation', 'subpoena', 'guilty', 'plea'],
  financial: ['bankrupt', 'chapter 11', 'default', 'insolven', 'layoff', 'going concern', 'delist'],
  foreign: ['chinese military', 'pla', 'espionage', 'foreign influence', 'cfius', 'state-owned'],
};

export function classifyHeadline(title) {
  const t = String(title || '').toLowerCase();
  return Object.entries(RISK_TERMS).filter(([, words]) => words.some((w) => t.includes(w))).map(([k]) => k);
}

export async function search(name) {
  const terms = '(fraud OR sanctions OR breach OR lawsuit OR indictment OR "export control" OR bankruptcy OR "forced labor" OR espionage OR settlement OR penalty)';
  const query = `"${name.replace(/"/g, '')}" ${terms}`;
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?${new URLSearchParams({ query, mode: 'artlist', format: 'json', maxrecords: '50', timespan: '24m', sort: 'datedesc' })}`;
  const r = await fetchJson(url, { cacheTtlMs: DAY / 2, timeoutMs: 20000, retries: 1 });
  return (r?.articles || []).map((a) => ({
    title: a.title, url: a.url, date: a.seendate ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}` : null,
    domain: a.domain, country: a.sourcecountry, language: a.language, categories: classifyHeadline(a.title),
  })).filter((a) => a.categories.length);
}
