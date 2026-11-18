import { getMeta } from '../api.js';
import { html, render, tierBadge } from '../ui.js';

export default async function methodology(main) {
  const m = await getMeta();
  render(main, html`
    <div class="page-head"><div><h1>Risk methodology</h1><div class="sub">Transparent, deterministic and explainable — every point of risk traces to a finding with evidence and a reference.</div></div></div>
    <div class="grid g-2" style="margin-bottom:16px">
      <div class="card"><div class="card-h"><h2>How the score is built</h2></div><div class="card-b">
        <ol style="padding-left:18px;margin:0">
          <li><strong>Resolve identity</strong> — UEI/CAGE (SAM.gov), recipient profile (USAspending), LEI (GLEIF), CIK (SEC).</li>
          <li><strong>Map the supply chain</strong> — government customers and prime contractors (upstream); first-tier subcontractors from subaward reports (downstream); corporate parents and subsidiaries.</li>
          <li><strong>Screen every party</strong> — vendor, former names, parents, suppliers and customers against statutory prohibition lists, the Consolidated Screening List and (optionally) OpenSanctions.</li>
          <li><strong>Score eight categories</strong> 0–100 from explicit rules (below).</li>
          <li><strong>Roll up</strong>: <code>overall = 0.55 × weighted mean + 0.45 × highest category + 5 × (elevated categories − 1)</code>. The max term prevents one severe risk from being averaged away.</li>
          <li><strong>Hard stops</strong> — a strong match to a statutory prohibition, restricted-party list or an active SAM exclusion floors the score at 85 (Critical).</li>
          <li><strong>Exposure</strong> = score × mission-criticality factor (Low 0.6 · Moderate 0.8 · High 1.0 · Mission-critical 1.2), capped at 100.</li>
          <li><strong>AI analyst</strong> (optional) explains and drafts mitigations and vendor questions; it never changes the score.</li>
        </ol></div></div>
      <div class="card"><div class="card-h"><h2>Tiers</h2></div><div class="card-b">
        <table><thead><tr><th>Tier</th><th>Score</th><th>Typical action</th></tr></thead><tbody>
          <tr><td>${tierBadge('low')}</td><td>0–24</td><td>Proceed; standard monitoring (annual re-assessment).</td></tr>
          <tr><td>${tierBadge('moderate')}</td><td>25–49</td><td>Proceed with conditions; adjudicate findings; semi-annual monitoring.</td></tr>
          <tr><td>${tierBadge('high')}</td><td>50–74</td><td>Escalate to SCRM board / ISSM; mitigation plan before award; quarterly monitoring.</td></tr>
          <tr><td>${tierBadge('critical')}</td><td>75–100</td><td>Do not proceed without legal review and documented risk acceptance by the authorizing official.</td></tr>
        </tbody></table>
        <h3 style="margin:14px 0 6px">Screening match strength</h3>
        <p class="small">Names are normalized (legal suffixes and punctuation removed) and compared using token containment over distinctive words and Jaro-Winkler similarity. <strong>Strong</strong> ≥ 93% drives scoring and hard stops; <strong>potential</strong> 86–92% creates a finding to adjudicate. Distinctive brand names on statutory lists (e.g. “Hikvision”) match anywhere in a party name.</p>
      </div></div>
    </div>
    <div class="card"><div class="card-h"><h2>Categories, weights and rules</h2></div><div class="card-b table-wrap"><table>
      <thead><tr><th>Category</th><th class="num">Weight</th><th>Indicators (score contribution)</th><th>Frameworks</th></tr></thead><tbody>
      ${RULES.map((r) => html`<tr><td><strong>${m.categories.find((c) => c.id === r.id).name}</strong></td><td class="num">${m.categories.find((c) => c.id === r.id).weight}%</td><td class="small">${r.rules}</td><td class="small">${r.refs}</td></tr>`)}
      </tbody></table></div></div>`);
}

const RULES = [
  { id: 'sanctions', rules: 'Vendor strong match on any list (100, hard stop) · potential match (60) · parent strong match (90, hard stop) · parent potential (45) · active exclusion (70).', refs: 'OFAC 31 CFR 501; EAR 15 CFR 744; NDAA §889; FAR 52.204-23/25/27' },
  { id: 'foreign', rules: 'Vendor located in foreign-adversary jurisdiction (90) · parent in foreign adversary (85) · parent in sanctioned/elevated jurisdiction (55) · diversion-risk jurisdiction (35) · self-reported foreign ownership (35) · allied foreign parent (25) · undisclosed ultimate parent (20).', refs: '15 CFR 791.4; 32 CFR 117.11 (FOCI); NIST SP 800-161r1 SR-6' },
  { id: 'supplychain', rules: 'Supplier strong match (95; §889/FCC/Kaspersky = hard stop) · supplier potential match (50) · supplier in foreign adversary (60) / elevated (40) · sells to a listed entity (55) · >50% supplier concentration (25) · >$10M prime with no reported subs (20).', refs: 'FAR 52.204-24/-25/-26; NIST SP 800-161r1 SR-3, SR-4, SR-5' },
  { id: 'integrity', rules: 'Active SAM exclusion (100, hard stop) · FAPIIS proceedings (50 + 10 each) · SAM registration inactive/expired (45) · not registered (30).', refs: 'FAR 9.4, 9.104, 4.1102' },
  { id: 'operational', rules: 'Entity < 2 years old (40) · obligations down > 60% from peak (35) · no federal history (30) · critical-technology NAICS (10).', refs: 'NIST SP 800-161r1 SR-6; FAR 15.305' },
  { id: 'financial', rules: 'Late filing NT 10-K/Q (55) · deregistration Form 15 (40) · annual report > 18 months old (40) · SC 13D ownership change (30) · no SEC filings and no LEI (20).', refs: 'FAR 9.104-1(a)' },
  { id: 'cyber', rules: 'CISA KEV vulnerabilities in vendor products: 20 + 8 per CVE added in last 12 months + 20 if ransomware-linked + up to 20 for volume (max 85).', refs: 'BOD 22-01; OMB M-22-18; NIST SP 800-161r1 SA-15' },
  { id: 'media', rules: 'Adverse news (24 months): 20 per sanctions/fraud/forced-labor/foreign-influence article, 8 per other adverse article (max 85).', refs: 'NIST SP 800-161r1 SR-6' },
];
