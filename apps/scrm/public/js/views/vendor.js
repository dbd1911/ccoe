import { api, getMeta } from '../api.js';
import { html, raw, render, esc, fmtMoney, fmtDate, fmtDateTime, tierBadge, sevBadge, statusBadge, tierColor, CRIT_LABEL, STATUS_LABEL, toast, modal, md, ALERT_ICON, INFO_ICON, daysSince } from '../ui.js';
import { barH, line } from '../charts.js';
import { countryName } from './dashboard.js';

const TABS = [['overview', 'Overview'], ['map', 'Supply chain map'], ['customers', 'Customers (upstream)'], ['suppliers', 'Suppliers (downstream)'],
  ['ownership', 'Ownership & identity'], ['findings', 'Findings'], ['ai', 'AI analyst'], ['history', 'History & sources']];

export default async function vendor(main, [id], query, isCurrent) {
  const [data, meta] = await Promise.all([api.get(`/api/vendors/${id}`), getMeta()]);
  if (!isCurrent()) return;
  const { vendor: v, history, assessment: a } = data;
  let tab = query.tab || 'overview';

  const header = () => html`
    <div class="page-head">
      <div><div class="crumbs"><a href="#/vendors">Vendors</a> / ${v.name}</div>
        <h1>${a?.profile?.entity?.legalName || v.name}</h1>
        <div class="sub">${[v.uei && `UEI ${v.uei}`, v.cage && `CAGE ${v.cage}`, v.vertical, [v.state, v.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Identifiers resolve on first assessment'}</div></div>
      <div class="actions no-print">
        <button class="btn" id="edit">Edit relationship</button>
        ${a ? html`<a class="btn" href="#/report/${v.id}">Printable report</a>` : ''}
        <button class="btn primary" id="run">${a ? 'Re-assess' : 'Run assessment'}</button>
      </div>
    </div>`;

  const shell = () => {
    render(main, html`${header()}
      ${!a ? html`<div class="card"><div class="empty"><h3>Not assessed yet</h3><p>Run an assessment to pull public data from SAM.gov, USAspending.gov, GLEIF, SEC EDGAR and screening lists.</p></div></div>` : html`
      ${a.mode === 'demo' ? html`<div class="alert warn">${INFO_ICON}<div>This assessment used the <strong>fictional demo dataset</strong>, not live public data.</div></div>` : ''}
      ${a.hardStops?.length ? html`<div class="alert critical">${ALERT_ICON}<div><strong>Statutory hard stop${a.hardStops.length > 1 ? 's' : ''}:</strong><ul style="margin:4px 0 0;padding-left:18px">${a.hardStops.map((h) => html`<li>${h}</li>`)}</ul></div></div>` : ''}
      <div class="tabs" role="tablist">${TABS.map(([k, label]) => html`<button role="tab" data-tab="${k}" class="${k === tab ? 'active' : ''}" aria-selected="${k === tab}">${label}${count(k)}</button>`)}</div>
      <div id="tab"></div>`}`);
    main.querySelector('#run').onclick = run;
    main.querySelector('#edit').onclick = edit;
    main.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; window.history.replaceState(null, '', `#/vendors/${id}?tab=${tab}`); shell(); });
    if (a) VIEWS[tab]();
  };
  const count = (k) => {
    if (!a) return '';
    const n = { findings: a.findings.filter((f) => ['open', 'mitigating'].includes(f.disposition)).length, suppliers: a.profile.suppliers?.length,
      customers: (a.profile.customers?.agencies?.length || 0) + (a.profile.customers?.primes?.length || 0) }[k];
    return n ? html`<span class="count">${n}</span>` : '';
  };
  const tabEl = () => main.querySelector('#tab');
  const P = a?.profile || {};

  async function run() {
    const btn = main.querySelector('#run'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Assessing…';
    try { await api.post(`/api/vendors/${id}/assess`); toast('Assessment complete'); vendor(main, [id], { tab }, isCurrent); }
    catch (e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Re-assess'; }
  }

  function edit() {
    modal({
      title: 'Edit vendor relationship', wide: true,
      body: html`<div class="row">
          <div class="field"><label class="f" for="e-name">Name</label><input id="e-name" value="${v.name}"></div>
          <div class="field"><label class="f" for="e-uei">UEI</label><input id="e-uei" value="${v.uei || ''}"></div>
          <div class="field"><label class="f" for="e-cage">CAGE</label><input id="e-cage" value="${v.cage || ''}"></div></div>
        <div class="row">
          <div class="field"><label class="f" for="e-crit">Mission criticality</label><select id="e-crit">${Object.entries(CRIT_LABEL).map(([k, l]) => html`<option value="${k}" ${raw(v.criticality === k ? 'selected' : '')}>${l}</option>`)}</select>
            <div class="help">Drives the impact axis and exposure index.</div></div>
          <div class="field"><label class="f" for="e-status">Relationship status</label><select id="e-status">${Object.entries(STATUS_LABEL).map(([k, l]) => html`<option value="${k}" ${raw(v.status === k ? 'selected' : '')}>${l}</option>`)}</select></div>
          <div class="field"><label class="f" for="e-spend">Annual spend (USD)</label><input id="e-spend" type="number" min="0" value="${v.annual_spend || 0}"></div></div>
        <div class="row">
          <div class="field"><label class="f" for="e-ref">Contract / PO reference</label><input id="e-ref" value="${v.contract_ref || ''}"></div>
          <div class="field"><label class="f" for="e-owner">Relationship owner</label><input id="e-owner" value="${v.owner || ''}"></div>
          <div class="field"><label class="f" for="e-tags">Tags (comma-separated)</label><input id="e-tags" value="${(v.tags || []).join(', ')}"></div></div>
        <div class="field"><label class="f" for="e-notes">Analyst notes</label><textarea id="e-notes">${v.notes || ''}</textarea></div>`,
      onConfirm: async (m) => {
        const g = (s) => m.querySelector(s).value;
        await api.put(`/api/vendors/${id}`, { name: g('#e-name'), uei: g('#e-uei'), cage: g('#e-cage'), criticality: g('#e-crit'), status: g('#e-status'),
          annual_spend: g('#e-spend'), contract_ref: g('#e-ref'), owner: g('#e-owner'), tags: g('#e-tags'), notes: g('#e-notes') });
        toast('Saved'); vendor(main, [id], { tab }, isCurrent);
      },
    });
  }

  const VIEWS = {
    overview() {
      const e = P.entity || {}; const fed = P.federal;
      const top = a.findings.filter((f) => ['open', 'mitigating'].includes(f.disposition)).slice(0, 5);
      render(tabEl(), html`
      <div class="grid g-3" style="margin-bottom:16px">
        <div class="card"><div class="card-b">
          <div class="label small muted">Overall risk score</div>
          <div class="score-hero"><div class="score-num">${a.score}</div><div>${tierBadge(a.tier)}<div class="small muted" style="margin-top:6px">Likelihood ${a.likelihood}/4 · Impact ${a.impact}/4</div></div></div>
          <div class="score-bar" aria-hidden="true"><div class="mark" style="left:calc(${a.score}% - 2px)"></div></div>
          <div class="scale"><span>0 Low</span><span>25</span><span>50</span><span>75</span><span>100 Critical</span></div>
          <div style="margin-top:14px" class="small"><strong>Exposure index ${a.exposure}</strong> <span class="muted">— score adjusted for ${CRIT_LABEL[v.criticality].toLowerCase()} mission criticality</span></div>
          <div class="small muted" style="margin-top:4px">Assessed ${fmtDateTime(a.createdAt)} · ${(a.durationMs / 1000).toFixed(1)}s · model v${a.methodologyVersion}</div>
        </div></div>
        <div class="card span-2"><div class="card-h"><h2>Risk by category</h2><a class="hint" href="#/methodology">How scores work →</a></div>
          <div class="card-b">${barH(a.categories.map((c) => ({ label: `${c.name} (${c.weight}%)`, value: c.score, color: tierColor(tierFor(c.score)),
            tip: `${c.name}: ${c.score}/100\n${c.drivers.length ? c.drivers.join('\n') : 'No risk indicators found'}` })), { max: 100, labelW: 260, format: (x) => `${x}`, ariaLabel: 'Category scores' })}
            <div class="legend">${['low', 'moderate', 'high', 'critical'].map((t) => html`<span><i style="background:${tierColor(t)}"></i>${t[0].toUpperCase() + t.slice(1)}</span>`)}</div></div></div>
      </div>
      <div class="grid g-3" style="margin-bottom:16px">
        <div class="card"><div class="card-h"><h2>Company profile</h2></div><div class="card-b"><dl class="kv">
          <dt>Legal name</dt><dd>${e.legalName || '—'}</dd>
          <dt>Vertical</dt><dd>${e.vertical || '—'}</dd>
          <dt>Primary NAICS</dt><dd>${e.naicsPrimary || '—'}</dd>
          ${e.sicDescription ? html`<dt>SEC SIC</dt><dd>${e.sic} ${e.sicDescription}</dd>` : ''}
          <dt>Location</dt><dd>${[e.city, e.state, e.country].filter(Boolean).join(', ') || '—'}</dd>
          <dt>Structure</dt><dd>${e.structure || '—'}</dd>
          <dt>In business since</dt><dd>${fmtDate(e.startDate)}</dd>
          <dt>SAM registration</dt><dd>${e.registration ? html`${e.registration.status} · exp. ${fmtDate(e.registration.expirationDate)}` : 'Not available'}</dd>
          ${e.tickers?.length ? html`<dt>Public listing</dt><dd>${e.tickers.join(', ')} (${(e.exchanges || []).join(', ')})</dd>` : ''}
          <dt>Business types</dt><dd>${(e.businessTypes || []).slice(0, 6).map((b) => html`<span class="chip">${b}</span>`)}</dd>
        </dl></div></div>
        <div class="card"><div class="card-h"><h2>Federal footprint</h2><span class="hint">Prime contract obligations</span></div><div class="card-b">
          ${fed ? html`<div class="stat" style="padding:0 0 8px"><div class="value">${fmtMoney(fed.totalObligated)}</div><div class="foot">${fed.byAgency.length} awarding agencies · first award ${fmtDate(fed.firstAwardDate)}</div></div>
            ${line((fed.trend || []).map((t) => ({ label: `FY${String(t.fy).slice(2)}`, value: t.amount })), { yMax: Math.max(1, ...fed.trend.map((t) => t.amount)) * 1.1, width: 360, height: 170, format: fmtMoney, ariaLabel: 'Obligations by fiscal year' })}`
            : html`<div class="empty small">No federal prime awards found.</div>`}
        </div></div>
        <div class="card"><div class="card-h"><h2>Your relationship</h2></div><div class="card-b"><dl class="kv">
          <dt>Criticality</dt><dd>${CRIT_LABEL[v.criticality]}</dd><dt>Status</dt><dd>${STATUS_LABEL[v.status]}</dd>
          <dt>Annual spend</dt><dd>${fmtMoney(v.annual_spend, false)}</dd><dt>Contract ref.</dt><dd>${v.contract_ref || '—'}</dd>
          <dt>Owner</dt><dd>${v.owner || '—'}</dd><dt>Portfolios</dt><dd>${v.portfolios.map((p) => html`<span class="chip">${p.name}</span>`)}</dd>
          <dt>Notes</dt><dd>${v.notes || '—'}</dd></dl></div></div>
      </div>
      <div class="card"><div class="card-h"><h2>Top open findings</h2><button class="btn sm" data-goto="findings">All findings →</button></div>
        <div class="card-b">${top.length ? top.map(findingCard) : html`<div class="empty small">No open findings.</div>`}</div></div>`);
      tabEl().querySelector('[data-goto]').onclick = () => { tab = 'findings'; shell(); };
      bindFindings();
    },

    map() {
      render(tabEl(), html`<div class="card"><div class="card-h"><h2>Supply chain map</h2><span class="hint">Hover a node for details</span></div>
        <div class="card-b map-wrap">${supplyMap(v, P)}
        <div class="legend"><span><i style="border:2px solid var(--critical);background:transparent"></i>Flagged (strong match)</span>
          <span><i style="border:2px dashed var(--serious);background:transparent"></i>Potential match</span><span><i style="border:1px solid var(--border-strong)"></i>Clear</span></div>
        <p class="help" style="margin-top:10px">Suppliers come from first-tier subaward reports on this company's prime contracts (FSRS via USAspending.gov). Commercial-only suppliers are not visible in federal data — request a supplier list, SBOM or HBOM for critical buys.</p></div></div>`);
    },

    customers() {
      const c = P.customers || {}; const fed = P.federal || {};
      render(tabEl(), html`
      <div class="grid g-2" style="margin-bottom:16px">
        <div class="card"><div class="card-h"><h2>Government agencies</h2><span class="hint">Prime obligations</span></div>
          <div class="card-b">${barH((c.agencies || []).slice(0, 10).map((x, i) => ({ label: x.name, value: x.amount, color: `var(--s${(i % 8) + 1})` })), { format: fmtMoney, labelW: 230, ariaLabel: 'Obligations by agency' })}</div></div>
        <div class="card"><div class="card-h"><h2>Sub-agencies / commands</h2></div>
          <div class="card-b">${barH((c.subAgencies || []).slice(0, 10).map((x) => ({ label: x.name, value: x.amount })), { format: fmtMoney, labelW: 230, ariaLabel: 'Obligations by sub-agency' })}</div></div>
      </div>
      <div class="grid g-2" style="margin-bottom:16px">
        <div class="card"><div class="card-h"><h2>Prime contractors it supplies (as a subcontractor)</h2></div><div class="card-b table-wrap">
          ${(c.primes || []).length ? html`<table><thead><tr><th>Prime contractor</th><th>Agency</th><th class="num">Subaward $</th><th class="num">Count</th><th>Screening</th></tr></thead>
            <tbody>${c.primes.map((p) => html`<tr><td>${p.name}</td><td class="small">${p.agency || '—'}</td><td class="num">${fmtMoney(p.amount)}</td><td class="num">${p.count}</td><td>${statusBadge(p.status)}</td></tr>`)}</tbody></table>`
            : html`<div class="empty small">No subawards to this company reported.</div>`}</div></div>
        <div class="card"><div class="card-h"><h2>What they sell to government</h2></div><div class="card-b">
          <h3 style="margin-bottom:6px">NAICS</h3>${barH((fed.naics || []).slice(0, 5).map((n) => ({ label: `${n.code} ${n.name || ''}`, value: n.amount })), { format: fmtMoney, labelW: 260, ariaLabel: 'By NAICS' })}
          <h3 style="margin:12px 0 6px">Product/Service codes</h3>${barH((fed.psc || []).slice(0, 5).map((n) => ({ label: `${n.code} ${n.name || ''}`, value: n.amount })), { format: fmtMoney, labelW: 260, ariaLabel: 'By PSC' })}</div></div>
      </div>
      <div class="card"><div class="card-h"><h2>Largest prime awards</h2></div><div class="card-b table-wrap">
        ${(fed.topAwards || []).length ? html`<table><thead><tr><th>Award</th><th>Agency</th><th>Description</th><th>Start</th><th class="num">Amount</th></tr></thead>
          <tbody>${fed.topAwards.slice(0, 15).map((w) => html`<tr><td class="mono">${w.url ? html`<a href="${w.url}" target="_blank" rel="noopener noreferrer">${w.id}</a>` : w.id}</td>
            <td class="small">${w.subAgency || w.agency}</td><td class="small">${w.description || '—'}</td><td class="nowrap">${fmtDate(w.start)}</td><td class="num">${fmtMoney(w.amount)}</td></tr>`)}</tbody></table>`
          : html`<div class="empty small">No awards found.</div>`}</div></div>`);
    },

    suppliers() {
      const s = P.suppliers || []; const total = s.reduce((t, x) => t + (x.amount || 0), 0);
      render(tabEl(), html`<div class="card"><div class="card-h"><h2>Reported sub-tier suppliers</h2>
        <span class="hint">${s.length} suppliers · ${fmtMoney(total)} · ${P.federal?.subawardCoverage?.primeAwardsExpanded || 0} prime awards expanded</span></div>
        <div class="card-b table-wrap">${s.length ? html`<table><thead><tr><th>Supplier</th><th>Country</th><th>What they supply</th><th class="num">Subaward $</th><th class="num">Share</th><th class="num">#</th><th>Screening</th></tr></thead>
          <tbody>${s.map((x) => html`<tr><td><strong>${x.name}</strong>${(x.hits || []).length ? html`<div class="small">${x.hits.slice(0, 3).map((h) => html`<span class="chip" data-tip="${`${h.entryName} — ${Math.round(h.score * 100)}% (${h.strength})`}">${h.listName}</span>`)}</div>` : ''}</td>
            <td>${x.country ? countryName(x.country) : html`<span class="muted">Not reported</span>`}</td><td class="small">${(x.descriptions || []).join('; ') || '—'}</td>
            <td class="num">${fmtMoney(x.amount)}</td><td class="num">${total ? Math.round((x.amount / total) * 100) : 0}%</td><td class="num">${x.count}</td><td>${statusBadge(x.status)}</td></tr>`)}</tbody></table>`
          : html`<div class="empty"><h3>No sub-tier suppliers reported</h3><p>Either the company has no prime awards with subcontracts above the FFATA reporting threshold, or its subcontracts were not reported.</p></div>`}</div></div>`);
    },

    ownership() {
      const o = P.ownership || {}; const e = P.entity || {}; const g = o.gleif;
      const node = (label, x) => (x ? html`<dt>${label}</dt><dd>${x.name} ${x.country ? html`<span class="chip">${countryName(x.country)}</span>` : ''} ${x.lei ? html`<span class="mono small">LEI ${x.lei}</span>` : ''}</dd>` : '');
      render(tabEl(), html`<div class="grid g-2">
        <div class="card"><div class="card-h"><h2>Corporate ownership</h2></div><div class="card-b"><dl class="kv">
          ${node('Immediate parent (SAM)', o.immediateParent)}${node('Ultimate parent (SAM)', o.ultimateParent)}
          ${node('Direct parent (GLEIF)', g?.directParent)}${node('Ultimate parent (GLEIF)', g?.ultimateParent)}
          ${g?.ultimateException ? html`<dt>GLEIF exception</dt><dd>${g.ultimateException}</dd>` : ''}
          ${!o.immediateParent && !o.ultimateParent && !g?.directParent && !g?.ultimateParent ? html`<dt>Parents</dt><dd class="muted">None reported — entity appears to be independently owned, or ownership is not disclosed in public data.</dd>` : ''}
          ${g?.children?.length ? html`<dt>Subsidiaries (GLEIF)</dt><dd>${g.children.slice(0, 12).map((c) => html`<span class="chip">${c.name}${c.country ? ` (${c.country})` : ''}</span>`)}</dd>` : ''}
        </dl>
        <h3 style="margin:14px 0 6px">Parent screening</h3>
        ${(P.screening?.parents || []).length ? P.screening.parents.map((p) => html`<div class="small" style="margin-bottom:6px"><strong>${p.name}</strong> (${p.role}) — ${statusBadge(p.hits.some((h) => h.strength === 'strong') ? 'flagged' : p.hits.length ? 'potential' : 'clear')}</div>`) : html`<div class="small muted">No parent entities to screen.</div>`}
        </div></div>
        <div class="card"><div class="card-h"><h2>Identifiers & registrations</h2></div><div class="card-b"><dl class="kv">
          <dt>UEI (SAM)</dt><dd class="mono">${e.uei || '—'}</dd><dt>CAGE</dt><dd class="mono">${e.cage || '—'}</dd>
          <dt>LEI</dt><dd class="mono">${e.lei || '—'}</dd><dt>SEC CIK</dt><dd class="mono">${e.cik || '—'}</dd>
          <dt>Incorporated</dt><dd>${[e.incorporationState, e.incorporationCountry].filter(Boolean).join(', ') || '—'}</dd>
          <dt>Website</dt><dd>${e.website || '—'}</dd>
          <dt>Former names</dt><dd>${(e.formerNames || []).join('; ') || '—'}</dd>
          <dt>Alternate names</dt><dd>${(e.alternateNames || []).join('; ') || '—'}</dd>
        </dl>
        <h3 style="margin:14px 0 6px">Vendor screening</h3>
        ${(P.screening?.entity?.hits || []).length ? P.screening.entity.hits.map((h) => html`<div class="small" style="margin-bottom:4px">${statusBadge(h.strength === 'strong' ? 'flagged' : 'potential')} ${h.listName} — “${h.entryName}” (${Math.round(h.score * 100)}%)</div>`)
          : html`<div class="small">${statusBadge('clear')} No matches on ${(P.screening?.listsChecked || []).join(', ') || 'configured lists'}</div>`}
        ${(P.screening?.errors || []).length ? html`<div class="alert warn small" style="margin-top:8px">${P.screening.errors.join('; ')}</div>` : ''}
        </div></div></div>`);
    },

    findings() {
      const state = { sev: '', cat: '', disp: 'active' };
      const draw = () => {
        const list = a.findings.filter((f) => (!state.sev || f.severity === state.sev) && (!state.cat || f.category === state.cat)
          && (state.disp === 'all' || (state.disp === 'active' ? ['open', 'mitigating'].includes(f.disposition) : f.disposition === state.disp)));
        render(tabEl().querySelector('#flist'), list.length ? html`${list.map(findingCard)}` : html`<div class="empty small">No findings match these filters.</div>`);
        bindFindings();
      };
      render(tabEl(), html`<div class="card"><div class="card-b">
        <div class="row" style="margin-bottom:12px">
          <select id="fs" aria-label="Severity"><option value="">All severities</option>${['critical', 'high', 'medium', 'low', 'info'].map((s) => html`<option>${s}</option>`)}</select>
          <select id="fc" aria-label="Category"><option value="">All categories</option>${meta.categories.map((c) => html`<option value="${c.id}">${c.name}</option>`)}</select>
          <select id="fd" aria-label="Disposition"><option value="active">Open & mitigating</option><option value="all">All dispositions</option>${meta.dispositions.map((d) => html`<option value="${d}">${d}</option>`)}</select>
        </div><div id="flist"></div></div></div>`);
      tabEl().querySelector('#fs').onchange = (e) => { state.sev = e.target.value; draw(); };
      tabEl().querySelector('#fc').onchange = (e) => { state.cat = e.target.value; draw(); };
      tabEl().querySelector('#fd').onchange = (e) => { state.disp = e.target.value; draw(); };
      draw();
    },

    ai() {
      const ai = a.ai;
      const DEC = { proceed: ['low', 'Proceed'], 'proceed-with-conditions': ['moderate', 'Proceed with conditions'], escalate: ['high', 'Escalate'], 'do-not-proceed': ['critical', 'Do not proceed'] };
      render(tabEl(), html`<div class="grid g-3">
        <div class="span-2">${ai ? html`
          <div class="card" style="margin-bottom:16px"><div class="card-h"><h2>AI analyst assessment</h2><span class="hint">${ai.model} · ${fmtDateTime(ai.generatedAt)} · confidence ${ai.confidence}</span></div>
            <div class="card-b"><div style="margin-bottom:10px">Recommendation: <span class="badge t-${DEC[ai.decision]?.[0]}">${DEC[ai.decision]?.[1] || ai.decision}</span></div>
              <p>${ai.executiveSummary}</p><p class="small"><strong>Rationale:</strong> ${ai.decisionRationale}</p></div></div>
          <div class="card" style="margin-bottom:16px"><div class="card-h"><h2>Key risks</h2></div><div class="card-b">${ai.keyRisks.map((r) => html`<div class="finding sev-${r.severity}"><div class="fh"><strong>${r.title}</strong>${sevBadge(r.severity)}</div><div class="small" style="margin-top:4px">${r.explanation}</div></div>`)}</div></div>
          <div class="card" style="margin-bottom:16px"><div class="card-h"><h2>Recommended mitigations</h2></div><div class="card-b table-wrap"><table><thead><tr><th>Action</th><th>Owner</th><th>When</th><th>Reference</th></tr></thead>
            <tbody>${ai.mitigations.map((m) => html`<tr><td>${m.action}</td><td class="nowrap">${m.owner}</td><td class="nowrap">${m.timing}</td><td class="small">${m.reference}</td></tr>`)}</tbody></table></div></div>
          <div class="grid g-2"><div class="card"><div class="card-h"><h2>Questions for the vendor</h2></div><div class="card-b"><ol style="margin:0;padding-left:18px">${ai.vendorQuestions.map((q) => html`<li style="margin-bottom:6px">${q}</li>`)}</ol></div></div>
            <div class="card"><div class="card-h"><h2>Data gaps</h2></div><div class="card-b"><ul style="margin:0;padding-left:18px">${ai.dataGaps.map((q) => html`<li style="margin-bottom:6px">${q}</li>`)}</ul></div></div></div>`
          : html`<div class="card"><div class="empty"><h3>No AI analysis for this assessment</h3><p>The AI analyst (Claude) writes an executive summary, decision recommendation, mitigation plan and vendor questionnaire grounded in the assessment data. It never changes the score.</p></div></div>`}
          <div class="actions" style="margin-top:12px"><button class="btn primary" id="gen">${ai ? 'Regenerate analysis' : 'Generate AI analysis'}</button></div>
        </div>
        <div class="card"><div class="card-h"><h2>Ask the analyst</h2></div><div class="card-b">
          <div class="chat" id="chat"><div class="msg assistant small">Ask about this vendor — e.g. “What would I need to verify before award?” or “Draft a §889 representation request.”</div></div>
          <form id="ask" style="margin-top:10px;display:flex;gap:6px"><input id="qq" placeholder="Ask a question…" aria-label="Question"><button class="btn primary">Ask</button></form></div></div>
      </div>`);
      tabEl().querySelector('#gen').onclick = async (ev) => {
        ev.target.disabled = true; ev.target.innerHTML = '<span class="spinner"></span> Analyzing…';
        try { a.ai = await api.post(`/api/assessments/${a.id}/ai`); VIEWS.ai(); } catch (e) { toast(e.message, 'error'); ev.target.disabled = false; ev.target.textContent = 'Generate AI analysis'; }
      };
      chatBox(tabEl(), { vendorId: v.id });
    },

    history() {
      const pts = [...history].reverse().map((h) => ({ label: fmtDate(h.created_at), value: h.score, tip: `${fmtDateTime(h.created_at)}: ${h.score} (${h.tier})` }));
      render(tabEl(), html`<div class="grid g-2">
        <div class="card"><div class="card-h"><h2>Score history</h2></div><div class="card-b">${line(pts, { bands: true, height: 200, ariaLabel: 'Score history' })}
          <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Date</th><th>Mode</th><th>Tier</th><th class="num">Score</th></tr></thead>
          <tbody>${history.map((h) => html`<tr><td>${fmtDateTime(h.created_at)}</td><td>${h.mode}</td><td>${tierBadge(h.tier)}</td><td class="num">${h.score}</td></tr>`)}</tbody></table></div></div></div>
        <div class="card"><div class="card-h"><h2>Data sources for latest assessment</h2></div><div class="card-b table-wrap"><table>
          <thead><tr><th>Source</th><th>Status</th><th class="num">Time</th></tr></thead>
          <tbody>${a.sources.map((s) => html`<tr><td>${s.label}${s.detail ? html`<div class="small muted">${s.detail}</div>` : ''}</td>
            <td><span class="badge ${s.status === 'ok' ? 't-low' : s.status === 'error' ? 't-critical' : 't-none'}">${s.status}</span></td><td class="num">${s.ms != null ? `${s.ms} ms` : ''}</td></tr>`)}</tbody></table>
          <p class="help">Lists screened: ${(P.screening?.listsChecked || []).join(', ')}. Configure keys and the CSL dataset on <a href="#/sources">Data Sources</a>.</p></div></div></div>`);
    },
  };

  function findingCard(f) {
    const done = ['mitigated', 'accepted', 'false-positive'].includes(f.disposition);
    return html`<div class="finding sev-${f.severity} ${done ? 'resolved' : ''}">
      <div class="fh"><div><strong>${f.title}</strong><div class="small muted">${meta.categories.find((c) => c.id === f.category)?.name} · ${f.partyRole}: ${f.party}</div></div>${sevBadge(f.severity)}</div>
      <div style="margin-top:6px">${f.detail}</div>
      ${f.recommendation ? html`<div class="rec"><strong>Recommended action:</strong> ${f.recommendation}</div>` : ''}
      <div class="meta">${f.refs?.length ? html`References: ${f.refs.join(' · ')}` : ''}
        ${f.evidence?.length ? html` · Evidence: ${f.evidence.map((ev, i) => html`${i ? ', ' : ''}${ev.url ? html`<a href="${ev.url}" target="_blank" rel="noopener noreferrer">${ev.source || 'link'}</a>` : ev.source}`)}` : ''}</div>
      <div class="row no-print" style="margin-top:8px;align-items:center">
        <select data-disp="${f.key}" aria-label="Disposition" style="max-width:200px">${meta.dispositions.map((d) => html`<option value="${d}" ${raw(f.disposition === d ? 'selected' : '')}>${d}</option>`)}</select>
        <input data-note="${f.key}" placeholder="Adjudication note (optional)" value="${f.dispositionNote || ''}" aria-label="Note">
      </div></div>`;
  }
  function bindFindings() {
    tabEl().querySelectorAll('[data-disp]').forEach((sel) => sel.onchange = async () => {
      const key = sel.dataset.disp; const note = tabEl().querySelector(`[data-note="${CSS.escape(key)}"]`)?.value || '';
      await api.put(`/api/vendors/${id}/findings/${encodeURIComponent(key)}`, { disposition: sel.value, note });
      const f = a.findings.find((x) => x.key === key); f.disposition = sel.value; f.dispositionNote = note;
      toast(`Finding marked ${sel.value}`);
    });
    tabEl().querySelectorAll('[data-note]').forEach((inp) => inp.onchange = async () => {
      const key = inp.dataset.note; const f = a.findings.find((x) => x.key === key);
      await api.put(`/api/vendors/${id}/findings/${encodeURIComponent(key)}`, { disposition: f.disposition, note: inp.value }); f.dispositionNote = inp.value; toast('Note saved');
    });
  }
  shell();
}

const tierFor = (s) => (s >= 75 ? 'critical' : s >= 50 ? 'high' : s >= 25 ? 'moderate' : 'low');

export function chatBox(root, scope) {
  const hist = [];
  const box = root.querySelector('#chat');
  root.querySelector('#ask').onsubmit = async (e) => {
    e.preventDefault();
    const inp = root.querySelector('#qq'); const q = inp.value.trim(); if (!q) return;
    inp.value = '';
    box.insertAdjacentHTML('beforeend', html`<div class="msg user">${q}</div>`.s);
    box.insertAdjacentHTML('beforeend', '<div class="msg assistant" data-pending><span class="spinner"></span></div>');
    box.scrollTop = box.scrollHeight;
    const pending = box.querySelector('[data-pending]');
    try {
      const r = await api.post('/api/chat', { ...scope, question: q, history: hist });
      hist.push({ role: 'user', content: q }, { role: 'assistant', content: r.answer });
      pending.removeAttribute('data-pending'); pending.innerHTML = md(r.answer).s;
    } catch (err) { pending.removeAttribute('data-pending'); pending.textContent = err.message; }
    box.scrollTop = box.scrollHeight;
  };
}

/** Three-column SVG: suppliers (downstream) → vendor (+ owners) → customers (upstream). */
function supplyMap(v, P) {
  const W = 1040, nodeW = 250, nodeH = 40, gapY = 12, colX = [10, (W - nodeW) / 2, W - nodeW - 10];
  const MAX = 12;
  const sup = [...(P.suppliers || [])].sort((a, b) => (b.status !== 'clear') - (a.status !== 'clear') || b.amount - a.amount);
  const cust = [...(P.customers?.agencies || []).map((x) => ({ ...x, kind: 'agency', status: 'clear' })), ...(P.customers?.primes || []).map((x) => ({ ...x, kind: 'prime' }))];
  const owners = [];
  const o = P.ownership || {};
  for (const [role, x] of [['Ultimate parent', o.ultimateParent || o.gleif?.ultimateParent], ['Immediate parent', o.immediateParent || o.gleif?.directParent]]) {
    if (x?.name && !owners.some((w) => w.name === x.name)) {
      const hits = (P.screening?.parents || []).find((p) => p.name === x.name)?.hits || [];
      owners.push({ ...x, role, status: hits.some((h) => h.strength === 'strong') ? 'flagged' : hits.length ? 'potential' : 'clear' });
    }
  }
  const supShown = sup.slice(0, MAX), custShown = cust.slice(0, MAX);
  const rows = Math.max(supShown.length + (sup.length > MAX), custShown.length + (cust.length > MAX), owners.length + 1, 3);
  const H = 40 + rows * (nodeH + gapY);
  const yFor = (i, n) => 40 + ((rows - n) / 2 + i) * (nodeH + gapY);
  const vStatus = (P.screening?.entity?.hits || []).some((h) => h.strength === 'strong') ? 'flagged' : (P.screening?.entity?.hits || []).length ? 'potential' : '';
  const center = { x: colX[1], y: yFor(owners.length, owners.length + 1) };
  const node = (x, y, title, subtitle, cls, tip) => `<g class="node ${cls}" data-tip="${esc(tip)}" tabindex="0"><rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="8"/>
    <text x="${x + 12}" y="${y + 17}" font-weight="600">${esc(title.length > 34 ? `${title.slice(0, 33)}…` : title)}</text><text x="${x + 12}" y="${y + 32}" style="fill:var(--muted);font-size:11px">${esc(subtitle)}</text></g>`;
  const edge = (x1, y1, x2, y2, w, color) => `<path class="edge" d="M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}" stroke-width="${w}" ${color ? `style="stroke:${color}"` : ''}/>`;
  const supMax = Math.max(1, ...supShown.map((s) => s.amount)), custMax = Math.max(1, ...custShown.map((s) => s.amount));
  let svg = `<text class="col-label" x="${colX[0]}" y="20">Suppliers · downstream (${sup.length})</text><text class="col-label" x="${colX[1]}" y="20">Company & owners</text><text class="col-label" x="${colX[2]}" y="20">Customers · upstream (${cust.length})</text>`;
  const statusColor = (s) => (s === 'flagged' ? 'var(--critical)' : s === 'potential' ? 'var(--serious)' : null);
  supShown.forEach((s, i) => {
    const y = yFor(i, supShown.length + (sup.length > MAX));
    svg += edge(colX[0] + nodeW, y + nodeH / 2, center.x, center.y + nodeH / 2, 1 + (s.amount / supMax) * 5, statusColor(s.status));
    svg += node(colX[0], y, s.name, `${fmtMoney(s.amount)} · ${s.country ? countryName(s.country) : 'country n/a'}`, s.status === 'clear' ? '' : s.status,
      `${s.name}\n${fmtMoney(s.amount)} across ${s.count} subawards\n${s.status === 'clear' ? 'No screening matches' : (s.hits || []).map((h) => `${h.listName} (${h.strength})`).join('\n')}`);
  });
  if (sup.length > MAX) svg += `<text x="${colX[0] + 12}" y="${yFor(supShown.length, supShown.length + 1) + 24}" style="fill:var(--muted)">+ ${sup.length - MAX} more suppliers</text>`;
  if (!sup.length) svg += `<text x="${colX[0]}" y="${center.y + 24}" style="fill:var(--muted)">No reported suppliers</text>`;
  owners.forEach((w, i) => {
    const y = yFor(i, owners.length + 1);
    svg += `<path class="edge" d="M${colX[1] + nodeW / 2},${y + nodeH} L${colX[1] + nodeW / 2},${y + nodeH + gapY}" stroke-width="2" ${statusColor(w.status) ? `style="stroke:${statusColor(w.status)}"` : ''}/>`;
    svg += node(colX[1], y, w.name, `${w.role}${w.country ? ` · ${countryName(w.country)}` : ''}`, w.status === 'clear' ? '' : w.status, `${w.role}: ${w.name}${w.country ? ` (${w.country})` : ''}`);
  });
  custShown.forEach((c, i) => {
    const y = yFor(i, custShown.length + (cust.length > MAX));
    svg += edge(center.x + nodeW, center.y + nodeH / 2, colX[2], y + nodeH / 2, 1 + (c.amount / custMax) * 5, statusColor(c.status));
    svg += node(colX[2], y, c.name, `${c.kind === 'agency' ? 'Agency' : 'Prime contractor'} · ${fmtMoney(c.amount)}`, c.status === 'clear' ? '' : c.status, `${c.name}\n${fmtMoney(c.amount)}`);
  });
  if (cust.length > MAX) svg += `<text x="${colX[2] + 12}" y="${yFor(custShown.length, custShown.length + 1) + 24}" style="fill:var(--muted)">+ ${cust.length - MAX} more customers</text>`;
  svg += node(center.x, center.y, P.entity?.legalName || v.name, `${P.entity?.vertical || 'Vendor under assessment'}`, `center ${vStatus}`, v.name);
  return raw(`<svg class="map" viewBox="0 0 ${W} ${H}" style="min-width:820px;width:100%" role="img" aria-label="Supply chain map">${svg}</svg>`);
}
