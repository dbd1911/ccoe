// CISA Known Exploited Vulnerabilities catalog (no key). Used to flag product vendors
// whose products have actively exploited CVEs — a cyber supply chain risk indicator.
import { fetchJson, DAY } from '../lib/http.js';
import { similarity } from '../lib/match.js';

export const meta = {
  id: 'kev', name: 'CISA Known Exploited Vulnerabilities', provider: 'Cybersecurity and Infrastructure Security Agency',
  url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', docs: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', requiresKey: false,
};

const URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

export async function forVendor(name) {
  const r = await fetchJson(URL, { cacheTtlMs: DAY, timeoutMs: 60000 });
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
