// Deterministic, explainable SCRM scoring model.
// Every point of risk traces to a finding with evidence, a framework reference and a
// recommended mitigation. AI narrative (backend/llm.js) sits ON TOP of this, never instead.
//
// Methodology (see the in-app Methodology page):
//   category scores 0-100  ->  overall = 0.55*weighted mean + 0.45*max(category)
//   hard stops (statutory prohibitions, active exclusions) floor the overall score.
import { countryRisk, isCriticalNaics, LISTS } from './watchlists.js';

export const CATEGORIES = [
  { id: 'sanctions', name: 'Sanctions & Restricted Parties', weight: 25 },
  { id: 'foreign', name: 'Foreign Ownership, Control or Influence', weight: 20 },
  { id: 'supplychain', name: 'Sub-tier Supplier Risk', weight: 20 },
  { id: 'integrity', name: 'Federal Integrity & Responsibility', weight: 10 },
  { id: 'operational', name: 'Operational & Concentration', weight: 10 },
  { id: 'financial', name: 'Financial Transparency', weight: 5 },
  { id: 'cyber', name: 'Cyber & Product Security', weight: 5 },
  { id: 'media', name: 'Adverse Media', weight: 5 },
];

export const TIERS = [
  { id: 'low', name: 'Low', min: 0 }, { id: 'moderate', name: 'Moderate', min: 25 },
  { id: 'high', name: 'High', min: 50 }, { id: 'critical', name: 'Critical', min: 75 },
];
export const tierFor = (s) => [...TIERS].reverse().find((t) => s >= t.min).id;

export const CRITICALITY = {
  low: { impact: 1, factor: 0.6, label: 'Low' }, moderate: { impact: 2, factor: 0.8, label: 'Moderate' },
  high: { impact: 3, factor: 1.0, label: 'High' }, 'mission-critical': { impact: 4, factor: 1.2, label: 'Mission-critical' },
};

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const money = (n) => `$${Math.round(n || 0).toLocaleString('en-US')}`;

export function assess(profile, { criticality = 'moderate' } = {}) {
  const findings = [];
  const cat = Object.fromEntries(CATEGORIES.map((c) => [c.id, { ...c, score: 0, drivers: [] }]));
  const hardStops = [];
  const raise = (id, score, driver) => { const c = cat[id]; if (score > c.score) c.score = score; if (driver) c.drivers.push(driver); };
  const add = (f) => { findings.push({ key: `${f.category}:${slug(f.party || '')}:${slug(f.title)}`, evidence: [], refs: [], ...f }); };

  const e = profile.entity || {};
  const name = e.legalName || e.name;

  // ---------- 1. Sanctions & restricted parties ----------
  for (const h of profile.screening?.entity?.hits || []) {
    const isStatutory = !!LISTS[h.list];
    const strong = h.strength === 'strong';
    const sev = strong ? 'critical' : 'high';
    raise('sanctions', strong ? 100 : 60, `${h.listName} ${h.strength} match`);
    if (strong && (isStatutory ? LISTS[h.list].severity === 'critical' : true)) hardStops.push(`${name} matches ${h.listName}`);
    add({ category: 'sanctions', severity: sev, party: name, partyRole: 'vendor',
      title: `${strong ? 'Match' : 'Potential match'} on ${h.listName}`,
      detail: `"${name}" ${strong ? 'matches' : 'resembles'} listed entity "${h.entryName}"${h.matchedName && h.matchedName !== h.entryName ? ` (alias "${h.matchedName}")` : ''} — similarity ${(h.score * 100).toFixed(0)}%. ${h.effect || ''}`.trim(),
      evidence: [{ source: h.authority || h.listName, url: h.url }],
      refs: isStatutory ? [LISTS[h.list].authority, 'NIST SP 800-161r1 SR-6'] : ['15 CFR 744 / 31 CFR 501', 'NIST SP 800-161r1 SR-6'],
      recommendation: strong ? 'Do not award. Escalate to legal/compliance for adjudication and document the determination.'
        : 'Adjudicate the potential match (compare addresses, identifiers, ownership) before proceeding; document disposition.' });
  }
  for (const p of profile.screening?.parents || []) {
    for (const h of p.hits || []) {
      const strong = h.strength === 'strong';
      raise('sanctions', strong ? 90 : 45, `${p.role} ${p.name} on ${h.listName}`);
      if (strong) hardStops.push(`${p.role} ${p.name} matches ${h.listName}`);
      add({ category: 'sanctions', severity: strong ? 'critical' : 'high', party: p.name, partyRole: p.role,
        title: `${p.role === 'ultimate parent' ? 'Ultimate parent' : 'Parent'} ${strong ? 'matches' : 'potentially matches'} ${h.listName}`,
        detail: `${p.role} "${p.name}" ${strong ? 'matches' : 'resembles'} "${h.entryName}" (${(h.score * 100).toFixed(0)}%). Prohibitions under ${h.authority || h.listName} generally extend to subsidiaries and affiliates.`,
        evidence: [{ source: h.authority || h.listName, url: h.url }], refs: ['FAR 52.204-25(b)', '31 CFR 501 (OFAC 50% rule)', 'NIST SP 800-161r1 SR-6'],
        recommendation: 'Treat as affiliate of a listed entity pending adjudication; OFAC 50% rule and §889 "affiliate" language may apply.' });
    }
  }
  for (const x of profile.exclusions || []) {
    const active = !x.terminationDate || x.terminationDate === 'Indefinite' || new Date(x.terminationDate) > new Date();
    if (!active) continue;
    raise('integrity', 100, `Active SAM exclusion (${x.classification || x.type || 'exclusion'})`);
    raise('sanctions', 70);
    hardStops.push(`Active SAM.gov exclusion: ${x.type || x.classification || 'exclusion'} by ${x.agency || 'agency'}`);
    add({ category: 'integrity', severity: 'critical', party: x.name, partyRole: 'vendor',
      title: `Active SAM.gov exclusion — ${x.type || 'excluded'}`,
      detail: `${x.name} is excluded (${x.classification || ''} ${x.program || ''}) by ${x.agency || 'an agency'} since ${x.activeDate || 'n/a'}${x.terminationDate ? `, through ${x.terminationDate}` : ''}.`,
      evidence: [{ source: 'SAM.gov Exclusions', url: 'https://sam.gov/search/?index=ex' }], refs: ['FAR 9.405', 'FAR 52.209-6'],
      recommendation: 'Contracting officers may not solicit offers from, award to, or consent to subcontracts with excluded parties (FAR 9.405).' });
  }

  // ---------- 2. Foreign ownership, control or influence ----------
  const countryOf = (o) => o?.country || o?.hqCountry || null;
  const ownChain = [
    ['immediate parent', profile.ownership?.immediateParent], ['ultimate parent', profile.ownership?.ultimateParent],
    ['direct parent (GLEIF)', profile.ownership?.gleif?.directParent], ['ultimate parent (GLEIF)', profile.ownership?.gleif?.ultimateParent],
  ].filter(([, o]) => o && o.name);
  const seenParents = new Set();
  for (const [role, o] of ownChain) {
    const key = `${(o.name || '').toLowerCase()}|${countryOf(o)}`; if (seenParents.has(key)) continue; seenParents.add(key);
    const cr = countryRisk(countryOf(o));
    if (!cr) {
      if (countryOf(o) && countryOf(o) !== 'US' && countryOf(o) !== 'USA') {
        raise('foreign', 25, `${role} in ${countryOf(o)}`);
        add({ category: 'foreign', severity: 'low', party: o.name, partyRole: role, title: `Foreign ${role} (${countryOf(o)})`,
          detail: `${o.name} (${countryOf(o)}) is the ${role}. Allied-nation ownership is common but should be confirmed against FOCI requirements for classified or sensitive work.`,
          evidence: [{ source: role.includes('GLEIF') ? 'GLEIF Level 2' : 'SAM.gov entity hierarchy', url: o.url }], refs: ['32 CFR 117.11 (FOCI)', 'NIST SP 800-161r1 SR-6'],
          recommendation: 'Confirm FOCI status/mitigation if the work involves classified information or critical technology.' });
      }
      continue;
    }
    const s = cr.level === 'adversary' ? 85 : cr.level === 'elevated' ? 55 : 35;
    raise('foreign', s, `${role} in ${cr.name}`);
    add({ category: 'foreign', severity: cr.level === 'adversary' ? 'critical' : 'high', party: o.name, partyRole: role,
      title: `${role[0].toUpperCase() + role.slice(1)} domiciled in ${cr.level === 'adversary' ? 'foreign adversary' : cr.level === 'elevated' ? 'sanctioned/elevated-risk' : 'diversion-risk'} jurisdiction (${cr.name})`,
      detail: `${o.name} — the vendor's ${role} — is located in ${cr.name}. ${cr.level === 'adversary' ? 'Foreign adversary jurisdictions (15 CFR 791.4) can compel cooperation with state intelligence services.' : 'Jurisdiction is associated with sanctions evasion or export-control diversion.'}`,
      evidence: [{ source: role.includes('GLEIF') ? 'GLEIF Level 2 relationship data' : 'SAM.gov entity hierarchy', url: o.url }],
      refs: ['15 CFR 791.4', '32 CFR 117.11', 'NIST SP 800-161r1 SR-6, SR-5'],
      recommendation: 'Require FOCI disclosure (SF 328) and mitigation; restrict access to CUI/critical systems; consider alternate sources.' });
  }
  const homeCountry = e.country || e.incorporationCountry;
  const hcr = countryRisk(homeCountry);
  if (hcr) {
    raise('foreign', hcr.level === 'adversary' ? 90 : 55, `Vendor located in ${hcr.name}`);
    add({ category: 'foreign', severity: hcr.level === 'adversary' ? 'critical' : 'high', party: name, partyRole: 'vendor',
      title: `Vendor located/incorporated in ${hcr.name}`, detail: `Registered address or incorporation country is ${hcr.name} (${hcr.level}).`,
      evidence: [{ source: 'SAM.gov / USAspending recipient profile' }], refs: ['15 CFR 791.4'], recommendation: 'Elevate to SCRM board review; evaluate alternate sources.' });
  }
  const foreignTypes = (e.businessTypes || []).filter((b) => /foreign/i.test(b));
  if (foreignTypes.length) {
    raise('foreign', 35, 'Self-identified foreign ownership');
    add({ category: 'foreign', severity: 'medium', party: name, partyRole: 'vendor', title: 'Self-reported foreign ownership/location',
      detail: `Business types include: ${foreignTypes.join('; ')}.`, evidence: [{ source: 'SAM.gov / USAspending business types' }],
      refs: ['FAR 52.204-17', '32 CFR 117.11'], recommendation: 'Identify the foreign owner and country; request SF 328 if sensitive work.' });
  }
  const gl = profile.ownership?.gleif;
  if (gl && !gl.ultimateParent && gl.ultimateException && !/NATURAL_PERSONS|NO_KNOWN_PERSON/.test(gl.ultimateException)) {
    raise('foreign', 20, 'Ownership opacity');
    add({ category: 'foreign', severity: 'low', party: name, partyRole: 'vendor', title: 'Ultimate parent not disclosed (LEI reporting exception)',
      detail: `GLEIF reporting exception: ${gl.ultimateException}. Ownership cannot be independently verified.`,
      evidence: [{ source: 'GLEIF Level 2', url: profile.entity?.lei ? `https://search.gleif.org/#/record/${profile.entity.lei}` : null }],
      refs: ['NIST SP 800-161r1 SR-4 (provenance)'], recommendation: 'Request beneficial-ownership disclosure from the vendor.' });
  }

  // ---------- 3. Sub-tier supplier risk ----------
  const suppliers = profile.suppliers || [];
  const totalSub = suppliers.reduce((t, s) => t + (s.amount || 0), 0);
  for (const s of suppliers) {
    for (const h of s.hits || []) {
      const strong = h.strength === 'strong';
      const statutory = LISTS[h.list];
      raise('supplychain', strong ? 95 : 50, `Supplier ${s.name} on ${h.listName}`);
      if (strong && statutory && ['S889', 'FCC', 'KAS'].includes(h.list)) hardStops.push(`Sub-tier supplier ${s.name} is a §889/FCC covered entity`);
      add({ category: 'supplychain', severity: strong ? 'critical' : 'high', party: s.name, partyRole: 'supplier',
        title: `Supplier ${strong ? 'matches' : 'potentially matches'} ${h.listName}`,
        detail: `First-tier supplier "${s.name}" (${money(s.amount)} across ${s.count} subaward${s.count === 1 ? '' : 's'}) ${strong ? 'matches' : 'resembles'} "${h.entryName}" (${(h.score * 100).toFixed(0)}%).${statutory ? ' ' + statutory.effect : ''}`,
        evidence: [{ source: 'USAspending.gov subaward data (FSRS)', url: 'https://www.usaspending.gov/search' }, { source: h.authority || h.listName, url: h.url }],
        refs: statutory ? [statutory.authority, 'NIST SP 800-161r1 SR-3, SR-6'] : ['NIST SP 800-161r1 SR-3, SR-6'],
        recommendation: strong ? 'Require the prime to remove/replace the supplier and certify under FAR 52.204-24/-26; assess product provenance.'
          : 'Ask the vendor to identify the supplier entity and its ownership; adjudicate the match.' });
    }
    const cr = countryRisk(s.country);
    if (cr && cr.level !== 'diversion') {
      raise('supplychain', cr.level === 'adversary' ? 60 : 40, `Supplier in ${cr.name}`);
      add({ category: 'supplychain', severity: cr.level === 'adversary' ? 'high' : 'medium', party: s.name, partyRole: 'supplier',
        title: `Supplier located in ${cr.name}`, detail: `${s.name} supplies ${money(s.amount)} and is located in ${cr.name}.`,
        evidence: [{ source: s.source || 'Supplier record' }], refs: ['NIST SP 800-161r1 SR-4, SR-6'], recommendation: 'Validate provenance and request a bill of materials / country-of-origin certification.' });
    }
  }
  if (suppliers.length && totalSub > 0) {
    const top = [...suppliers].sort((a, b) => b.amount - a.amount)[0];
    const share = top.amount / totalSub;
    if (share > 0.5 && suppliers.length >= 1) {
      raise('supplychain', 25, 'Supplier concentration');
      add({ category: 'supplychain', severity: 'low', party: top.name, partyRole: 'supplier', title: 'High dependence on a single sub-tier supplier',
        detail: `${top.name} accounts for ${(share * 100).toFixed(0)}% of reported subcontract dollars — a single point of failure.`,
        evidence: [{ source: 'USAspending.gov subaward data' }], refs: ['NIST SP 800-161r1 SR-5(1) diversity of suppliers'], recommendation: 'Ask about second sources and continuity plans for this supplier.' });
    }
  }
  const fedTotal = profile.federal?.totalObligated || 0;
  if (fedTotal > 10_000_000 && !suppliers.length) {
    raise('supplychain', 20, 'No sub-tier visibility');
    add({ category: 'supplychain', severity: 'low', party: name, partyRole: 'vendor', title: 'No reported sub-tier suppliers despite significant prime awards',
      detail: `${money(fedTotal)} in prime obligations but no first-tier subawards reported — sub-tier supply chain is not visible in public data.`,
      evidence: [{ source: 'USAspending.gov' }], refs: ['FAR 52.204-10', 'NIST SP 800-161r1 SR-4'],
      recommendation: 'Request a supplier list / SBOM / HBOM and FAR 52.204-10 subcontract reporting compliance.' });
  }
  for (const p of profile.customers?.primes || []) {
    for (const h of p.hits || []) {
      if (h.strength !== 'strong') continue;
      raise('supplychain', 55, `Customer ${p.name} on ${h.listName}`);
      add({ category: 'supplychain', severity: 'high', party: p.name, partyRole: 'customer', title: `Vendor sells to a listed entity (${h.listName})`,
        detail: `Prime contractor/customer "${p.name}" matches "${h.entryName}".`, evidence: [{ source: h.authority || h.listName, url: h.url }],
        refs: ['NIST SP 800-161r1 SR-6'], recommendation: 'Understand the relationship; may indicate diversion or affiliation risk.' });
    }
  }

  // ---------- 4. Federal integrity & responsibility ----------
  const reg = e.registration;
  if (reg) {
    const expired = reg.expirationDate && new Date(reg.expirationDate) < new Date();
    if ((reg.status && !/^active$/i.test(reg.status.trim())) || expired) {
      raise('integrity', 45, 'SAM registration not active');
      add({ category: 'integrity', severity: 'medium', party: name, partyRole: 'vendor', title: 'SAM.gov registration inactive or expired',
        detail: `Registration status "${reg.status || 'unknown'}"${reg.expirationDate ? `, expiration ${reg.expirationDate}` : ''}.`,
        evidence: [{ source: 'SAM.gov Entity API', url: e.uei ? `https://sam.gov/entity/${e.uei}` : 'https://sam.gov' }], refs: ['FAR 4.1102', 'FAR 52.204-7'],
        recommendation: 'Vendor must have an active SAM registration at time of offer and award.' });
    }
  } else if (profile.sourcesChecked?.includes('sam')) {
    raise('integrity', 30, 'Not found in SAM.gov');
    add({ category: 'integrity', severity: 'medium', party: name, partyRole: 'vendor', title: 'No SAM.gov registration found',
      detail: 'The entity could not be located in SAM.gov by UEI or name.', evidence: [{ source: 'SAM.gov Entity API' }], refs: ['FAR 4.1102'],
      recommendation: 'Obtain the vendor UEI and confirm registration before award.' });
  }
  const procs = profile.proceedings || [];
  if (procs.length) {
    raise('integrity', Math.min(85, 50 + procs.length * 10), `${procs.length} FAPIIS proceeding(s)`);
    add({ category: 'integrity', severity: 'high', party: name, partyRole: 'vendor', title: `${procs.length} reported criminal/civil/administrative proceeding(s)`,
      detail: procs.slice(0, 5).map((p) => `${p.proceedingDate || ''} ${p.proceedingType || ''} ${p.proceedingDescription || p.description || ''}`.trim()).join(' • '),
      evidence: [{ source: 'SAM.gov integrity information (FAPIIS)' }], refs: ['FAR 9.104-6', 'FAR 52.209-7'], recommendation: 'Review in responsibility determination.' });
  }

  // ---------- 5. Operational & concentration ----------
  const fed = profile.federal;
  if (!fed || !fedTotal) {
    raise('operational', 30, 'No federal performance history');
    add({ category: 'operational', severity: 'low', party: name, partyRole: 'vendor', title: 'No federal contract history in the look-back period',
      detail: 'No prime contract obligations found on USAspending.gov — past performance and federal compliance maturity cannot be verified from public data.',
      evidence: [{ source: 'USAspending.gov' }], refs: ['FAR 15.305(a)(2)'], recommendation: 'Request commercial references and evidence of compliance programs (NIST SP 800-171, CMMC).' });
  } else {
    const t = fed.trend || [];
    if (t.length >= 3) {
      const peak = Math.max(...t.map((x) => x.amount));
      const last = t[t.length - 1].amount, prev = t[t.length - 2].amount;
      const recent = Math.max(last, prev);
      if (peak > 1_000_000 && recent < peak * 0.4) {
        raise('operational', 35, 'Sharp decline in federal revenue');
        add({ category: 'operational', severity: 'medium', party: name, partyRole: 'vendor', title: 'Federal obligations have declined sharply',
          detail: `Recent fiscal-year obligations (${money(recent)}) are ${(100 - recent / peak * 100).toFixed(0)}% below the peak (${money(peak)}).`,
          evidence: [{ source: 'USAspending.gov spending over time' }], refs: ['NIST SP 800-161r1 SR-6'], recommendation: 'Probe for lost re-competes, performance issues or financial stress.' });
      }
    }
  }
  if (e.startDate) {
    const ageYears = (Date.now() - new Date(e.startDate).getTime()) / (365.25 * 86400000);
    if (ageYears < 2) {
      raise('operational', 40, 'Newly formed entity');
      add({ category: 'operational', severity: 'medium', party: name, partyRole: 'vendor', title: 'Recently formed entity',
        detail: `Business start date ${e.startDate} (${ageYears.toFixed(1)} years). New entities are a common front/shell indicator.`,
        evidence: [{ source: 'SAM.gov' }], refs: ['NIST SP 800-161r1 SR-6'], recommendation: 'Verify principals, facilities and beneficial ownership.' });
    }
  }
  const critical = isCriticalNaics(e.naicsPrimary);
  if (critical) raise('operational', Math.max(cat.operational.score, 10), 'Critical-technology sector');

  // ---------- 6. Financial transparency ----------
  const sec = profile.sec;
  if (sec) {
    for (const f of sec.riskFilings || []) {
      const s = /NT 10/.test(f.form) ? 55 : /^15/.test(f.form) ? 40 : 30;
      raise('financial', s, f.label);
      add({ category: 'financial', severity: s >= 50 ? 'medium' : 'low', party: name, partyRole: 'vendor', title: f.label,
        detail: `${f.form} filed ${f.date}.`, evidence: [{ source: 'SEC EDGAR', url: f.url }], refs: ['NIST SP 800-161r1 SR-6'],
        recommendation: /NT 10/.test(f.form) ? 'Late filings can indicate accounting problems or financial distress — review subsequent filings.' : 'Review the filing for changes in control or reporting status.' });
    }
    if (sec.lastAnnualReport && (Date.now() - new Date(sec.lastAnnualReport)) / 86400000 > 550) {
      raise('financial', 40, 'Stale annual report');
      add({ category: 'financial', severity: 'medium', party: name, partyRole: 'vendor', title: 'Annual report overdue',
        detail: `Most recent annual report filed ${sec.lastAnnualReport}.`, evidence: [{ source: 'SEC EDGAR', url: sec.edgarUrl }], refs: [], recommendation: 'Request current audited financial statements.' });
    }
  } else if (!e.lei && fedTotal < 1_000_000) {
    raise('financial', 20, 'Limited financial transparency');
    add({ category: 'financial', severity: 'info', party: name, partyRole: 'vendor', title: 'Limited public financial information',
      detail: 'Not an SEC registrant and no LEI — financial health cannot be assessed from public sources.', evidence: [],
      refs: ['FAR 9.104-1(a)'], recommendation: 'Request financial statements or a commercial credit report (e.g., D&B) for the responsibility determination.' });
  }

  // ---------- 7. Cyber ----------
  const kev = profile.kev;
  if (kev && kev.total > 0) {
    const s = Math.min(85, 20 + kev.lastYear * 8 + (kev.ransomware ? 20 : 0) + Math.min(20, kev.total));
    raise('cyber', s, `${kev.total} known-exploited CVEs`);
    add({ category: 'cyber', severity: s >= 60 ? 'high' : 'medium', party: name, partyRole: 'vendor',
      title: `${kev.total} actively exploited vulnerabilities in vendor products (CISA KEV)`,
      detail: `${kev.lastYear} added in the last 12 months; ${kev.ransomware} linked to ransomware campaigns. Products: ${kev.products.join(', ')}.`,
      evidence: [{ source: 'CISA KEV', url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' }],
      refs: ['BOD 22-01', 'NIST SP 800-161r1 SR-3, SA-15', 'Secure Software Development Attestation (OMB M-22-18)'],
      recommendation: 'Require secure-development attestation (CISA form), SBOM, and a vulnerability disclosure program; verify patch SLAs.' });
  }

  // ---------- 8. Adverse media ----------
  const media = profile.media || [];
  if (media.length) {
    const severeCats = ['sanctions', 'fraud', 'forcedLabor', 'foreign'];
    const severe = media.filter((m) => m.categories.some((c) => severeCats.includes(c))).length;
    const s = Math.min(85, severe * 20 + (media.length - severe) * 8);
    raise('media', s, `${media.length} adverse articles`);
    const counts = {};
    for (const m of media) for (const c of m.categories) counts[c] = (counts[c] || 0) + 1;
    add({ category: 'media', severity: severe >= 3 ? 'high' : severe ? 'medium' : 'low', party: name, partyRole: 'vendor',
      title: `${media.length} adverse media article(s) in the last 24 months`,
      detail: `Themes: ${Object.entries(counts).map(([k, v]) => `${k} (${v})`).join(', ')}. Most recent: "${media[0].title}".`,
      evidence: media.slice(0, 5).map((m) => ({ source: m.domain, url: m.url })), refs: ['NIST SP 800-161r1 SR-6'],
      recommendation: 'Analyst review: confirm the articles refer to this entity and assess materiality.' });
  }

  // ---------- roll-up ----------
  const cats = CATEGORIES.map((c) => ({ ...cat[c.id], score: Math.round(cat[c.id].score) }));
  const weighted = cats.reduce((t, c) => t + c.score * c.weight, 0) / 100;
  const maxCat = Math.max(...cats.map((c) => c.score));
  // Breadth: several independently elevated categories compound (each beyond the first adds 5).
  const elevated = cats.filter((c) => c.score >= 40).length;
  let score = 0.55 * weighted + 0.45 * maxCat + Math.max(0, elevated - 1) * 5;
  const uniqueStops = [...new Set(hardStops)];
  if (uniqueStops.length) score = Math.max(score, 85 + Math.min(10, (uniqueStops.length - 1) * 3));
  score = Math.round(Math.min(100, score));
  const crit = CRITICALITY[criticality] || CRITICALITY.moderate;
  const sevRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  // de-duplicate identical keys
  const uniq = []; const keys = new Set();
  for (const f of findings) { if (keys.has(f.key)) continue; keys.add(f.key); uniq.push(f); }
  return {
    score, tier: tierFor(score), categories: cats, hardStops: uniqueStops, findings: uniq,
    likelihood: Math.min(4, 1 + Math.floor(score / 25)), impact: crit.impact,
    exposure: Math.round(Math.min(100, score * crit.factor)),
    methodologyVersion: '1.0',
  };
}
