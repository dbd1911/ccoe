import { api } from '../api.js';
import { html, raw, render, fmtMoney, fmtDateTime, tierBadge, statusBadge, tierColor, TIER_LABEL, CRIT_LABEL, toast, ALERT_ICON, INFO_ICON } from '../ui.js';
import { barH, line, segmented } from '../charts.js';
import { refreshModePill } from '../app.js';

const LIKELIHOOD = ['Low', 'Moderate', 'High', 'Critical'];
const IMPACT = ['Low', 'Moderate', 'High', 'Mission-critical'];

export default async function dashboard(main, _params, query) {
  const [portfolios] = await Promise.all([api.get('/api/portfolios')]);
  const pid = query.portfolio || '';
  const d = await api.get(`/api/dashboard${pid ? `?portfolioId=${pid}` : ''}`);
  const k = d.kpis;

  if (!k.vendors) {
    render(main, html`
      <div class="page-head"><div><h1>Supply Chain Risk Dashboard</h1><div class="sub">Portfolio-level view of the risk your vendors bring into the organization.</div></div></div>
      <div class="card"><div class="empty">
        <h3>No vendors yet</h3>
        <p>Start by assessing a company, importing a vendor list, or loading the fictional demo portfolio to explore the application.</p>
        <div class="actions" style="justify-content:center;margin-top:12px">
          <a class="btn primary" href="#/assess">Assess a vendor</a>
          <a class="btn" href="#/assess?tab=bulk">Import a list</a>
          <button class="btn" id="seed">Load demo portfolio</button>
        </div></div></div>`);
    main.querySelector('#seed').onclick = async (e) => {
      e.target.disabled = true; e.target.textContent = 'Loading…';
      try { await api.post('/api/demo/seed'); toast('Demo portfolio loaded (demo data mode enabled)'); refreshModePill(); dashboard(main, [], query); }
      catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
    };
    return;
  }

  const heatLevel = (l, i) => Math.min(4, Math.max(1, Math.round((l + i) / 2)));
  const tierItems = ['critical', 'high', 'moderate', 'low'].map((t) => ({ label: TIER_LABEL[t], value: d.tierCounts[t], color: tierColor(t) }));

  render(main, html`
  <div class="page-head">
    <div><h1>Supply Chain Risk Dashboard</h1>
      <div class="sub">${pid ? `Portfolio: ${portfolios.find((p) => String(p.id) === pid)?.name || ''}` : 'All vendors'} · ${k.assessed} of ${k.vendors} vendors assessed</div></div>
    <div class="actions">
      <label class="f" for="pf" style="margin:0">Portfolio</label>
      <select id="pf" style="width:auto">
        <option value="">All vendors</option>
        ${portfolios.map((p) => html`<option value="${p.id}" ${raw(String(p.id) === pid ? 'selected' : '')}>${p.name} (${p.vendorCount})</option>`)}
      </select>
      <a class="btn" href="/api/export/vendors.csv${pid ? `?portfolioId=${pid}` : ''}">Export CSV</a>
      <a class="btn primary" href="#/assess">New assessment</a>
    </div>
  </div>

  ${k.hardStops ? html`<div class="alert critical">${ALERT_ICON}<div><strong>${k.hardStops} vendor${k.hardStops > 1 ? 's' : ''} triggered a statutory hard stop</strong> (prohibited source, restricted party or active exclusion). Review before any further obligation of funds.</div></div>` : ''}
  ${k.stale ? html`<div class="alert warn">${INFO_ICON}<div>${k.stale} assessment${k.stale > 1 ? 's are' : ' is'} older than ${k.staleDays} days. Continuous monitoring recommends re-assessment.</div></div>` : ''}

  <div class="grid g-6" style="margin-bottom:16px">
    ${stat('Portfolio risk score', k.avgScore ?? '—', 'Average of latest vendor scores (0–100)', k.avgScore != null ? tierBadge(tierFromScore(k.avgScore)) : '')}
    ${stat('Risk exposure index', k.avgExposure ?? '—', 'Score weighted by mission criticality')}
    ${stat('High / critical vendors', k.highOrCritical, `${k.vendors ? Math.round((k.highOrCritical / Math.max(1, k.assessed)) * 100) : 0}% of assessed vendors`)}
    ${stat('Open critical findings', k.openCritical, `${k.openHigh} open high-severity`)}
    ${stat('Annual spend at risk', fmtMoney(k.spendAtRisk), `of ${fmtMoney(k.annualSpend)} with high/critical vendors`)}
    ${stat('Unassessed / stale', `${k.unassessed} / ${k.stale}`, `Stale = older than ${k.staleDays} days`)}
  </div>

  <div class="grid g-3" style="margin-bottom:16px">
    <div class="card"><div class="card-h"><h2>Risk tier distribution</h2><span class="hint">${k.assessed} vendors</span></div>
      <div class="card-b">${segmented(tierItems, { ariaLabel: 'Vendors by risk tier' })}
        <div class="legend">${tierItems.map((t) => html`<span><i style="background:${t.color}"></i>${t.label} <strong>${t.value}</strong></span>`)}</div>
        <div style="margin-top:14px">${barH(tierItems, { labelW: 80, valueW: 40, width: 360, barH: 14, format: (v) => `${v}`, ariaLabel: 'Vendors per tier' })}</div>
      </div></div>
    <div class="card"><div class="card-h"><h2>Risk heat map</h2><span class="hint">Likelihood × impact</span></div>
      <div class="card-b">
        <div class="heat" role="table" aria-label="Risk heat map">
          ${[3, 2, 1, 0].map((li) => html`
            <div class="ylab" role="rowheader">${LIKELIHOOD[li]}</div>
            ${[0, 1, 2, 3].map((im) => { const cell = d.heat[li][im]; const lvl = heatLevel(li + 1, im + 1);
              return html`<div class="cell h-${lvl} ${cell.length ? 'has' : ''}" role="cell" ${raw(cell.length ? `data-tip="${escAttr(cell.map((v) => `${v.name} (${v.score})`).join('\n'))}" tabindex="0"` : '')}>
                <span class="n">${cell.length || ''}</span><span class="cap">${cell.length ? (cell.length === 1 ? 'vendor' : 'vendors') : ''}</span></div>`; })}`)}
          <div></div>${IMPACT.map((x) => html`<div class="xlab">${x}</div>`)}
        </div>
        <div class="help" style="text-align:center">Rows: vendor risk likelihood (score tier) · Columns: mission impact (criticality you assign)</div>
      </div></div>
    <div class="card"><div class="card-h"><h2>Portfolio risk trend</h2><span class="hint">Average score, last 12 months</span></div>
      <div class="card-b">${line(d.trend.map((t) => ({ label: t.month.slice(2).replace('-', '/'), value: t.avg, tip: `${t.month}: average ${t.avg} across ${t.vendors} vendors · ${t.high} high/critical` })), { width: 400, height: 230, bands: true, ariaLabel: 'Average portfolio risk by month' })}</div></div>
  </div>

  <div class="grid g-2" style="margin-bottom:16px">
    <div class="card"><div class="card-h"><h2>Top vendors by risk exposure</h2><a class="hint" href="#/vendors${pid ? `?portfolio=${pid}` : ''}">View all →</a></div>
      <div class="card-b table-wrap"><table>
        <thead><tr><th>Vendor</th><th>Tier</th><th class="num">Score</th><th class="num">Exposure</th><th>Criticality</th><th class="num">Open crit/high</th></tr></thead>
        <tbody>${d.topRisks.map((v) => html`<tr class="click" data-href="#/vendors/${v.id}">
          <td><a href="#/vendors/${v.id}">${v.name}</a>${v.hardStops.length ? html` <span class="badge t-critical" data-tip="${v.hardStops.join('\n')}">Hard stop</span>` : ''}</td>
          <td>${tierBadge(v.tier)}</td><td class="num">${v.score}</td><td class="num">${v.exposure}</td><td>${CRIT_LABEL[v.criticality]}</td>
          <td class="num">${v.open.critical} / ${v.open.high}</td></tr>`)}</tbody></table></div></div>
    <div class="card"><div class="card-h"><h2>Risk drivers by category</h2><span class="hint">Average category score across vendors</span></div>
      <div class="card-b">${barH(d.categories.map((c) => ({ label: c.name, value: c.avg, color: 'var(--s1)', tip: `${c.name}\nAverage score ${c.avg}/100\n${c.findings} findings · ${c.elevated} vendors ≥ 50` })), { max: 100, format: (v) => `${v}`, ariaLabel: 'Average category scores' })}</div></div>
  </div>

  <div class="grid g-3" style="margin-bottom:16px">
    <div class="card span-2"><div class="card-h"><h2>Flagged parties across the supply chain</h2><span class="hint">Vendors, owners and sub-tier suppliers with screening hits</span></div>
      <div class="card-b table-wrap">${d.flaggedParties.length ? html`<table>
        <thead><tr><th>Party</th><th>Role</th><th>Via vendor</th><th>Status</th><th>Lists</th></tr></thead>
        <tbody>${d.flaggedParties.slice(0, 15).map((f) => html`<tr><td>${f.party}</td><td class="nowrap">${f.role}</td><td><a href="#/vendors/${f.vendorId}">${f.vendor}</a></td>
          <td>${statusBadge(f.status)}</td><td>${f.lists.map((l) => html`<span class="chip">${l}</span>`)}</td></tr>`)}</tbody></table>`
        : html`<div class="empty small">No screening hits across the portfolio.</div>`}</div></div>
    <div class="card"><div class="card-h"><h2>Sub-tier supplier geography</h2><span class="hint">Reported subcontract $</span></div>
      <div class="card-b">${barH(d.countries.slice(0, 8).map((c) => ({ label: countryName(c.country), value: c.amount,
        color: ['CN', 'HK', 'MO', 'RU', 'IR', 'KP', 'CU', 'VE'].includes(c.country) ? 'var(--critical)' : 'var(--s1)',
        tip: `${countryName(c.country)}\n${c.suppliers} suppliers · ${fmtMoney(c.amount)}\nVia: ${c.vendors.join(', ')}` })), { labelW: 120, width: 400, format: fmtMoney, ariaLabel: 'Supplier spend by country' })}
        <div class="legend"><span><i style="background:var(--critical)"></i>Foreign adversary jurisdiction</span><span><i style="background:var(--s1)"></i>Other</span></div></div></div>
  </div>

  <div class="grid g-2">
    <div class="card"><div class="card-h"><h2>Government customers of portfolio vendors</h2><span class="hint">Prime obligations, look-back period</span></div>
      <div class="card-b">${barH(d.agencies.map((a) => ({ label: a.name.replace('Department of ', 'Dept. of '), value: a.amount, tip: `${a.name}\n${fmtMoney(a.amount)} across ${a.vendors} vendor(s)` })), { format: fmtMoney, ariaLabel: 'Obligations by agency' })}</div></div>
    <div class="card"><div class="card-h"><h2>Recent activity</h2></div>
      <div class="card-b"><ul class="list-plain small">${d.recent.map((r) => html`<li><span class="muted">${fmtDateTime(r.ts)}</span> — ${activity(r)}</li>`)}</ul></div></div>
  </div>`);

  main.querySelector('#pf').onchange = (e) => { location.hash = `#/dashboard${e.target.value ? `?portfolio=${e.target.value}` : ''}`; };
  main.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.hash = tr.dataset.href; }));
}

function stat(label, value, foot, extra = '') {
  return html`<div class="card stat"><div class="label">${label}</div><div class="value">${value} ${extra}</div><div class="foot">${foot}</div></div>`;
}
const tierFromScore = (s) => (s >= 75 ? 'critical' : s >= 50 ? 'high' : s >= 25 ? 'moderate' : 'low');
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const CN = { US: 'United States', CN: 'China', HK: 'Hong Kong', RU: 'Russia', DE: 'Germany', TW: 'Taiwan', AE: 'UAE', GB: 'United Kingdom', JP: 'Japan', KR: 'South Korea', CA: 'Canada', MX: 'Mexico', IL: 'Israel', IN: 'India', FR: 'France', Unknown: 'Unknown (not reported)' };
export const countryName = (c) => CN[c] || c;
function activity(r) {
  let d = {}; try { d = JSON.parse(r.detail); } catch { /* plain */ }
  const map = {
    'assessment.completed': () => `Assessment completed — score ${d.score} (${d.tier})`,
    'vendor.created': () => `Vendor added: ${d.name}`, 'bulk.started': () => `Bulk assessment started (${d.count} vendors)`,
    'finding.disposition': () => `Finding marked ${d.disposition}`, 'demo.seeded': () => `Demo portfolio loaded`,
    'portfolio.created': () => `Portfolio created: ${d.name}`, 'ai.analysis': () => 'AI analysis generated', 'ai.chat': () => 'AI analyst consulted',
  };
  return (map[r.action] || (() => r.action))();
}
