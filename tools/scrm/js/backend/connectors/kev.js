// CISA Known Exploited Vulnerabilities catalog (no key). Used to flag product vendors
// whose products have actively exploited CVEs — a cyber supply chain risk indicator.
import { fetchJson, DAY } from '../http.js';
import { similarity } from '../../core/match.js';

export const meta = {
  id: 'kev', name: 'CISA Known Exploited Vulnerabilities', provider: 'Cybersecurity and Infrastructure Security Agency',
  url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', docs: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', requiresKey: false,
};

// CISA's own feed first; CISA's official GitHub mirror as a fallback for browsers/networks
// where cisa.gov does not allow cross-origin reads.
const URLS = [
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
  'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json',
];

export async function forVendor(name) {
  let r, err;
  for (const u of URLS) { try { r = await fetchJson(u, { cacheTtlMs: DAY, cacheKey: 'kev-catalog', timeoutMs: 60000, retries: 0 }); break; } catch (e) { err = e; } }
  if (!r) throw err;
  const vulns = (r?.vulnerabilities || []).filter((v) => similarity(name, v.vendorProject) >= 0.93);
  const since = new Date(Date.now() - 365 * DAY).toISOString().slice(0, 10);
  return {
    total: vulns.length,
    lastYear: vulns.filter((v) => v.dateAdded >= since).length,
    ransomware: vulns.filter((v) => v.knownRansomwareCampaignUse === 'Known').length,
    products: [...new Set(vulns.map((v) => v.product))].slice(0, 10),
    recent: vulns.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, 10).map((v) => ({
      cve: v.cveID, product: v.product, name: v.vulnerabilityName, dateAdded: v.dateAdded, ransomware: v.knownRansomwareCampaignUse,
    })),
  };
}
