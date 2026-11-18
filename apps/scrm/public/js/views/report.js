import { api, getMeta } from '../api.js';
import { html, render, fmtMoney, fmtDate, fmtDateTime, tierBadge, sevBadge, statusBadge, CRIT_LABEL, STATUS_LABEL } from '../ui.js';
import { barH } from '../charts.js';
import { countryName } from './dashboard.js';

export default async function report(main, [id]) {
  const [{ vendor: v, assessment: a }, meta] = await Promise.all([api.get(`/api/vendors/${id}`), getMeta()]);
  if (!a) { render(main, html`<div class="empty">No assessment to report. <a href="#/vendors/${id}">Back</a></div>`); return; }
  const P = a.profile; const e = P.entity || {};
  const open = a.findings.filter((f) => ['open', 'mitigating'].includes(f.disposition));
  render(main, html`
    <div class="actions no-print" style="margin-bottom:12px"><a class="btn" href="#/vendors/${id}">← Back</a><button class="btn primary" id="print">Print / save as PDF</button></div>
    <article class="report card">
      <div class="print-banner">UNCLASSIFIED // PUBLICLY AVAILABLE INFORMATION</div>
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
        <div><div class="small muted">Supply Chain Risk Assessment</div><h1>${e.legalName || v.name}</h1>
          <div class="small">${[e.uei && `UEI ${e.uei}`, e.cage && `CAGE ${e.cage}`, e.vertical, [e.city, e.state, e.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div></div>
        <div style="text-align:right"><div style="font-size:40px;font-weight:700;line-height:1">${a.score}</div>${tierBadge(a.tier)}<div class="small muted" style="margin-top:4px">Exposure ${a.exposure}</div></div>
      </div>
      <p class="small muted" style="margin-top:8px">Assessed ${fmtDateTime(a.createdAt)} · ${a.mode === 'demo' ? 'DEMO DATA (fictional)' : 'Live public data'} · Methodology v${a.methodologyVersion} · Mission criticality: ${CRIT_LABEL[v.criticality]} · Status: ${STATUS_LABEL[v.status]}</p>

      <h2>1. Summary</h2>
      ${a.hardStops.length ? html`<p><strong>Hard stops:</strong></p><ul>${a.hardStops.map((h) => html`<li>${h}</li>`)}</ul>` : html`<p>No statutory hard stops identified.</p>`}
      ${a.ai ? html`<p><strong>Analyst recommendation: ${a.ai.decision.replace(/-/g, ' ')}</strong> (confidence ${a.ai.confidence}).</p><p>${a.ai.executiveSummary}</p><p class="small">${a.ai.decisionRationale}</p>` : ''}
      <p>${open.length} open finding(s): ${['critical', 'high', 'medium', 'low'].map((s) => `${open.filter((f) => f.severity === s).length} ${s}`).join(', ')}.</p>

      <h2>2. Risk by category</h2>
      ${barH(a.categories.map((c) => ({ label: c.name, value: c.score, color: c.score >= 75 ? 'var(--critical)' : c.score >= 50 ? 'var(--serious)' : c.score >= 25 ? 'var(--warning)' : 'var(--good)' })), { max: 100, labelW: 250, format: (x) => `${x}` })}

      <h2>3. Company profile & ownership</h2>
      <dl class="kv"><dt>Legal name</dt><dd>${e.legalName}</dd><dt>Vertical / NAICS</dt><dd>${e.vertical || '—'} (${e.naicsPrimary || 'n/a'})</dd>
        <dt>SAM registration</dt><dd>${e.registration ? `${e.registration.status}, expires ${fmtDate(e.registration.expirationDate)}` : 'Not available'}</dd>
        <dt>Immediate parent</dt><dd>${(P.ownership?.immediateParent || P.ownership?.gleif?.directParent)?.name || 'None reported'}</dd>
        <dt>Ultimate parent</dt><dd>${(P.ownership?.ultimateParent || P.ownership?.gleif?.ultimateParent)?.name || 'None reported'}</dd>
        <dt>Identifiers</dt><dd>LEI ${e.lei || '—'} · CIK ${e.cik || '—'}</dd></dl>

      <h2>4. Government customers (upstream)</h2>
      <p>Total prime obligations in look-back period: <strong>${fmtMoney(P.federal?.totalObligated || 0)}</strong>.</p>
      <table><thead><tr><th>Agency</th><th class="num">Obligations</th></tr></thead><tbody>${(P.customers?.agencies || []).slice(0, 8).map((x) => html`<tr><td>${x.name}</td><td class="num">${fmtMoney(x.amount)}</td></tr>`)}</tbody></table>
      ${(P.customers?.primes || []).length ? html`<p style="margin-top:8px">Also a subcontractor to: ${P.customers.primes.map((p) => p.name).join('; ')}.</p>` : ''}

      <h2>5. Sub-tier suppliers (downstream)</h2>
      ${(P.suppliers || []).length ? html`<table><thead><tr><th>Supplier</th><th>Country</th><th class="num">Subaward $</th><th>Screening</th></tr></thead>
        <tbody>${P.suppliers.slice(0, 20).map((s) => html`<tr><td>${s.name}</td><td>${s.country ? countryName(s.country) : '—'}</td><td class="num">${fmtMoney(s.amount)}</td><td>${statusBadge(s.status)}</td></tr>`)}</tbody></table>` : html`<p>No sub-tier suppliers reported in federal subaward data.</p>`}

      <h2>6. Findings</h2>
      ${a.findings.map((f) => html`<div class="finding sev-${f.severity}"><div class="fh"><strong>${f.title}</strong>${sevBadge(f.severity)}</div>
        <div class="small">${f.detail}</div>${f.recommendation ? html`<div class="small" style="margin-top:4px"><em>Action:</em> ${f.recommendation}</div>` : ''}
        <div class="small muted">${meta.categories.find((c) => c.id === f.category)?.name} · Disposition: ${f.disposition}${f.dispositionNote ? ` — ${f.dispositionNote}` : ''} · ${(f.refs || []).join('; ')}</div></div>`)}

      ${a.ai ? html`<h2>7. Mitigation plan</h2><table><thead><tr><th>Action</th><th>Owner</th><th>When</th></tr></thead><tbody>${a.ai.mitigations.map((m) => html`<tr><td>${m.action}</td><td>${m.owner}</td><td>${m.timing}</td></tr>`)}</tbody></table>
        <h2>8. Due-diligence questions for the vendor</h2><ol>${a.ai.vendorQuestions.map((q) => html`<li>${q}</li>`)}</ol>` : ''}

      <h2>Sources & limitations</h2>
      <p class="small">${a.sources.map((s) => `${s.label}: ${s.status}`).join(' · ')}. Lists screened: ${(P.screening?.listsChecked || []).join(', ')}.</p>
      <p class="small">This assessment is compiled from publicly available information and automated name matching. Potential matches require analyst adjudication. It does not replace a responsibility determination (FAR 9.104), a FOCI determination (32 CFR 117) or legal review.</p>
      <div class="row small" style="margin-top:28px"><div>Analyst: ____________________ Date: ________</div><div>Reviewer: ____________________ Date: ________</div></div>
    </article>`);
  main.querySelector('#print').onclick = () => window.print();
}
