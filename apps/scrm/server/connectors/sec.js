// SEC EDGAR (no key; requires a descriptive User-Agent with contact email, <=10 req/s).
// Gives SIC industry, incorporation, tickers/exchanges, former names and filing history
// (e.g. NT 10-K late filings, 8-K events, SC 13D activist/beneficial ownership).
// Docs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
import { fetchJson, DAY } from '../lib/http.js';
import { similarity, normalizeName } from '../lib/match.js';

export const meta = {
  id: 'sec', name: 'SEC EDGAR', provider: 'U.S. Securities and Exchange Commission',
  url: 'https://www.sec.gov/edgar', docs: 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces', requiresKey: false,
};

async function tickers(ua) {
  const r = await fetchJson('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': ua }, cacheTtlMs: DAY });
  return Object.values(r || {});
}

export async function findCik(ua, name) {
  const list = await tickers(ua);
  const n = normalizeName(name);
  let best = null;
  for (const c of list) {
    const s = normalizeName(c.title) === n ? 1 : similarity(name, c.title);
    if (!best || s > best.score) best = { cik: String(c.cik_str), ticker: c.ticker, title: c.title, score: s };
  }
  return best && best.score >= 0.9 ? best : null;
}

const RISK_FORMS = {
  'NT 10-K': 'Late annual report (NT 10-K)', 'NT 10-Q': 'Late quarterly report (NT 10-Q)',
  'SC 13D': 'Activist / >5% beneficial ownership change (SC 13D)', '15-12G': 'Deregistration (Form 15)',
  '15-15D': 'Suspension of reporting (Form 15)', 'CORRESP': null,
};

export async function profile(ua, cik) {
  const padded = String(cik).padStart(10, '0');
  const r = await fetchJson(`https://data.sec.gov/submissions/CIK${padded}.json`, { headers: { 'User-Agent': ua }, cacheTtlMs: DAY });
  const rec = r?.filings?.recent || {};
  const filings = (rec.form || []).map((form, i) => ({
    form, date: rec.filingDate[i], accession: rec.accessionNumber[i], doc: rec.primaryDocument[i], items: rec.items?.[i] || '',
    url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${String(rec.accessionNumber[i]).replace(/-/g, '')}/${rec.primaryDocument[i]}`,
  }));
  const since = new Date(Date.now() - 3 * 365 * DAY).toISOString().slice(0, 10);
  const recent = filings.filter((f) => f.date >= since);
  return {
    cik: String(cik), name: r.name, sic: r.sic, sicDescription: r.sicDescription, entityType: r.entityType,
    tickers: r.tickers || [], exchanges: r.exchanges || [], stateOfIncorporation: r.stateOfIncorporation,
    fiscalYearEnd: r.fiscalYearEnd, formerNames: (r.formerNames || []).map((f) => f.name),
    businessAddress: r.addresses?.business || null, website: r.website || null,
    lastAnnualReport: filings.find((f) => f.form === '10-K' || f.form === '20-F' || f.form === '40-F')?.date || null,
    riskFilings: recent.filter((f) => RISK_FORMS[f.form]).map((f) => ({ ...f, label: RISK_FORMS[f.form] })),
    recentFilings: filings.slice(0, 15),
    edgarUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padded}`,
  };
}
