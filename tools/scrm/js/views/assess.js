import { api } from '../api.js';
import { html, raw, render, fmtMoney, tierBadge, CRIT_LABEL, toast, INFO_ICON } from '../ui.js';

export default async function assess(main, _p, query) {
  const [portfolios, health] = await Promise.all([api.get('/api/portfolios'), api.get('/api/health')]);
  let tab = query.tab === 'bulk' ? 'bulk' : 'single';
  const draw = () => {
    render(main, html`
      <div class="page-head"><div><h1>New assessment</h1><div class="sub">Look up a company in federal records, or import a list of vendors for batch assessment.</div></div></div>
      ${health.mode === 'demo' ? html`<div class="alert warn">${INFO_ICON}<div><strong>Demo data mode.</strong> Lookups use the fictional demo dataset (any name is still screened against the built-in prohibition lists). Switch to live public data in <a href="#/settings">Settings</a>.</div></div>` : ''}
      <div class="tabs" role="tablist">
        <button data-t="single" class="${tab === 'single' ? 'active' : ''}">Single company</button>
        <button data-t="bulk" class="${tab === 'bulk' ? 'active' : ''}">Bulk list / CSV import</button>
      </div><div id="pane"></div>`);
    main.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t; draw(); });
    tab === 'single' ? single(main.querySelector('#pane'), portfolios) : bulk(main.querySelector('#pane'), portfolios, query.job);
  };
  draw();
}

function critSelect(id, val = 'moderate') {
  return html`<select id="${id}">${Object.entries(CRIT_LABEL).map(([k, l]) => html`<option value="${k}" ${raw(k === val ? 'selected' : '')}>${l}</option>`)}</select>`;
}

function single(el, portfolios) {
  let picked = null;
  render(el, html`<div class="grid g-3">
    <div class="card span-2"><div class="card-h"><h2>1 · Find the company</h2></div><div class="card-b">
      <form id="sf" class="row" style="align-items:flex-end">
        <div style="flex:3"><label class="f" for="sq">Company name or UEI</label><input id="sq" placeholder="e.g. Northwind Avionics, or a 12-character UEI" autocomplete="off"></div>
        <div style="flex:0"><button class="btn primary">Search</button></div></form>
      <div id="results" style="margin-top:12px"></div>
      <p class="help">Searches USAspending.gov recipients and SAM.gov registrations (when a SAM key is configured). Can't find it? Enter the details manually below — the assessment will still screen the name and resolve what it can.</p>
    </div></div>
    <div class="card"><div class="card-h"><h2>2 · Relationship context</h2></div><div class="card-b">
      <div class="field"><label class="f" for="nm">Company name</label><input id="nm" required></div>
      <div class="row"><div class="field"><label class="f" for="ue">UEI</label><input id="ue" maxlength="12"></div><div class="field"><label class="f" for="cg">CAGE</label><input id="cg" maxlength="5"></div></div>
      <div class="field"><label class="f" for="cr">Mission criticality</label>${critSelect('cr')}<div class="help">How severe would loss or compromise of this vendor be to your mission?</div></div>
      <div class="field"><label class="f" for="sp">Expected annual spend (USD)</label><input id="sp" type="number" min="0" placeholder="0"></div>
      <div class="field"><label class="f" for="cf">Contract / requirement</label><input id="cf" placeholder="e.g. RFQ 70QS-26-Q-0012"></div>
      <div class="field"><label class="f" for="pf">Add to portfolio</label><select id="pf"><option value="">— none —</option>${portfolios.map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select></div>
      <label class="small"><input type="checkbox" id="ai" checked> Include AI analyst narrative (if configured)</label>
      <div style="margin-top:14px"><button class="btn primary" id="go" style="width:100%;justify-content:center">Run assessment</button></div>
      <ul class="steps" id="steps" style="margin-top:12px"></ul>
    </div></div></div>`);

  const results = el.querySelector('#results');
  el.querySelector('#sf').onsubmit = async (e) => {
    e.preventDefault();
    const q = el.querySelector('#sq').value.trim(); if (!q) return;
    render(results, html`<span class="spinner"></span> Searching federal records…`);
    try {
      const r = await api.get(`/api/search?q=${encodeURIComponent(q)}`);
      render(results, html`${r.errors.length ? html`<div class="alert warn small">${r.errors.join(' · ')}</div>` : ''}
        ${r.results.length ? html`<div class="table-wrap"><table><thead><tr><th>Name</th><th>UEI</th><th>Location</th><th class="num">Federal $</th><th>Source</th><th></th></tr></thead>
          <tbody>${r.results.map((x, i) => html`<tr><td><strong>${x.name}</strong></td><td class="mono">${x.uei || '—'}</td><td>${[x.state, x.country].filter(Boolean).join(', ') || '—'}</td>
            <td class="num">${x.amount != null ? fmtMoney(x.amount) : '—'}</td><td><span class="chip">${x.source}</span>${x.level === 'P' ? html`<span class="chip" data-tip="Parent recipient">parent</span>` : ''}</td>
            <td><button class="btn sm" data-pick="${i}">Select</button></td></tr>`)}</tbody></table></div>`
          : html`<div class="empty small">No matches. Enter the company details manually →</div>`}`);
      results.querySelectorAll('[data-pick]').forEach((b) => b.onclick = () => {
        picked = r.results[Number(b.dataset.pick)];
        el.querySelector('#nm').value = picked.name; el.querySelector('#ue').value = picked.uei || ''; el.querySelector('#cg').value = picked.cage || '';
        results.querySelectorAll('tr').forEach((tr) => tr.style.background = ''); b.closest('tr').style.background = 'var(--accent-soft)';
      });
      if (!r.results.length) el.querySelector('#nm').value = q;
    } catch (err) { render(results, html`<div class="alert critical">${err.message}</div>`); }
  };
  el.querySelector('#go').onclick = async (e) => {
    const name = el.querySelector('#nm').value.trim();
    if (!name) { toast('Enter or select a company name', 'error'); return; }
    e.target.disabled = true;
    const steps = el.querySelector('#steps');
    const labels = ['Resolving identity (SAM.gov / USAspending)', 'Federal awards, agencies & subawards', 'Ownership (GLEIF), SEC EDGAR, media, CISA KEV', 'Screening vendor, owners, suppliers & customers', 'Scoring & findings'];
    let i = 0;
    const tick = () => { render(steps, html`${labels.map((l, j) => html`<li>${j < i ? '✓' : j === i ? raw('<span class="spinner"></span>') : '○'} <span class="${j > i ? 'muted' : ''}">${l}</span></li>`)}`); };
    tick(); const timer = setInterval(() => { if (i < labels.length - 1) { i++; tick(); } }, 1800);
    try {
      const body = { name, uei: el.querySelector('#ue').value.trim() || undefined, cage: el.querySelector('#cg').value.trim() || undefined,
        criticality: el.querySelector('#cr').value, annual_spend: el.querySelector('#sp').value, contract_ref: el.querySelector('#cf').value,
        portfolioIds: el.querySelector('#pf').value ? [el.querySelector('#pf').value] : [] };
      const { id } = await api.post('/api/vendors', body);
      await api.post(`/api/vendors/${id}/assess`, { ai: el.querySelector('#ai').checked });
      clearInterval(timer); toast('Assessment complete');
      location.hash = `#/vendors/${id}`;
    } catch (err) { clearInterval(timer); toast(err.message, 'error'); e.target.disabled = false; render(steps, ''); }
  };
}

function parseList(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const split = (l) => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; } else cur += ch; } out.push(cur.trim()); return out; };
  const first = split(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = first.some((h) => ['name', 'vendor', 'company', 'uei'].includes(h));
  if (!hasHeader) return lines.map((l) => { const [name, uei] = split(l); return { name, uei: /^[A-Z0-9]{12}$/i.test(uei || '') ? uei : undefined }; });
  const idx = (...names) => first.findIndex((h) => names.includes(h));
  const iN = idx('name', 'vendor', 'company', 'vendor name', 'company name'), iU = idx('uei', 'uei sam'), iC = idx('criticality'), iS = idx('annual_spend', 'spend', 'annual spend'), iR = idx('contract', 'contract_ref', 'contract ref');
  return lines.slice(1).map(split).map((c) => ({ name: c[iN], uei: iU >= 0 ? c[iU] : undefined, criticality: iC >= 0 ? c[iC]?.toLowerCase() : undefined,
    annual_spend: iS >= 0 ? Number(String(c[iS]).replace(/[$,]/g, '')) || 0 : undefined, contract_ref: iR >= 0 ? c[iR] : undefined })).filter((x) => x.name);
}

function bulk(el, portfolios, jobId) {
  render(el, html`<div class="grid g-2">
    <div class="card"><div class="card-h"><h2>Vendor list</h2></div><div class="card-b">
      <div class="field"><label class="f" for="list">Paste names (one per line), “name, UEI”, or a CSV with headers</label>
        <textarea id="list" rows="12" placeholder="name,uei,criticality,annual_spend,contract_ref&#10;Northwind Avionics Inc.,NWA7KLM2Q9X4,mission-critical,42000000,FA8625-22-C-0417&#10;Helix Data Systems LLC&#10;Kestrel Industrial Components Inc."></textarea></div>
      <div class="field"><label class="f" for="file">…or upload a CSV / text file</label><input type="file" id="file" accept=".csv,.txt,text/csv,text/plain"></div>
      <div class="row">
        <div class="field"><label class="f" for="pf">Portfolio</label><select id="pf"><option value="">— none —</option>${portfolios.map((p) => html`<option value="${p.id}">${p.name}</option>`)}<option value="new">+ Create new…</option></select></div>
        <div class="field"><label class="f" for="pn">New portfolio name</label><input id="pn" placeholder="e.g. FY27 Network Modernization"></div></div>
      <label class="small"><input type="checkbox" id="ai"> Generate AI narrative for each vendor (slower; uses API credits)</label>
      <div class="actions" style="margin-top:12px"><span id="cnt" class="small muted"></span><button class="btn primary" id="go">Start batch assessment</button></div>
      <p class="help">Recognized CSV columns: name, uei, criticality (low | moderate | high | mission-critical), annual_spend, contract_ref. Up to 500 vendors per batch; vendors already in your register are re-assessed, not duplicated.</p>
    </div></div>
    <div class="card"><div class="card-h"><h2>Progress</h2></div><div class="card-b" id="prog"><div class="empty small">No batch running.</div></div></div></div>`);
  const ta = el.querySelector('#list');
  const count = () => { el.querySelector('#cnt').textContent = `${parseList(ta.value).length} vendor(s) detected`; };
  ta.oninput = count;
  el.querySelector('#file').onchange = async (e) => { const f = e.target.files[0]; if (f) { ta.value = await f.text(); count(); } };
  el.querySelector('#go').onclick = async () => {
    const entries = parseList(ta.value);
    if (!entries.length) { toast('Add at least one vendor', 'error'); return; }
    let portfolioId = el.querySelector('#pf').value; let newPortfolioName;
    if (portfolioId === 'new') { portfolioId = ''; newPortfolioName = el.querySelector('#pn').value.trim(); if (!newPortfolioName) { toast('Enter a portfolio name', 'error'); return; } }
    const r = await api.post('/api/bulk', { entries, portfolioId: portfolioId || undefined, newPortfolioName, ai: el.querySelector('#ai').checked });
    poll(el.querySelector('#prog'), r.jobId);
  };
  if (jobId) poll(el.querySelector('#prog'), jobId);
}

async function poll(el, jobId) {
  const j = await api.get(`/api/jobs/${jobId}`);
  const pct = Math.round((j.done / j.total) * 100);
  render(el, html`<div class="small" style="margin-bottom:6px">Job #${j.id} · ${j.done} of ${j.total} complete · ${j.status}</div>
    <div class="progress"><div style="width:${pct}%"></div></div>
    <div class="table-wrap" style="margin-top:12px;max-height:480px;overflow:auto"><table><thead><tr><th>Vendor</th><th>Status</th><th>Result</th></tr></thead><tbody>
    ${j.items.map((it) => html`<tr><td>${it.vendorId ? html`<a href="#/vendors/${it.vendorId}">${it.name}</a>` : it.name}</td>
      <td class="small">${it.status === 'running' ? html`<span class="spinner"></span> ${it.step || ''}` : it.status}</td>
      <td>${it.status === 'done' ? html`${tierBadge(it.tier)} <strong>${it.score}</strong>` : it.status === 'error' ? html`<span class="small" style="color:var(--critical-ink)">${it.error}</span>` : ''}</td></tr>`)}
    </tbody></table></div>
    ${j.status === 'complete' ? html`<div class="actions" style="margin-top:10px"><a class="btn primary" href="#/dashboard">View dashboard</a><a class="btn" href="#/vendors">View vendors</a></div>` : ''}`);
  if (j.status !== 'complete' && document.body.contains(el)) setTimeout(() => poll(el, jobId), 1500);
}
