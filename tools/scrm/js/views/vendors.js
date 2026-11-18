import { api } from '../api.js';
import { html, raw, render, fmtMoney, fmtDate, tierBadge, CRIT_LABEL, STATUS_LABEL, toast, modal, daysSince } from '../ui.js';

export default async function vendors(main, _p, query) {
  const [rows, portfolios] = await Promise.all([api.get(`/api/vendors${query.portfolio ? `?portfolioId=${query.portfolio}` : ''}`), api.get('/api/portfolios')]);
  const state = { q: '', tier: query.tier || '', crit: '', status: '', sort: 'score', dir: -1, selected: new Set() };

  render(main, html`
    <div class="page-head">
      <div><h1>Vendors</h1><div class="sub">Your historical register of companies assessed or under contract.</div></div>
      <div class="actions">
        <select id="pf" style="width:auto"><option value="">All portfolios</option>
          ${portfolios.map((p) => html`<option value="${p.id}" ${raw(String(p.id) === query.portfolio ? 'selected' : '')}>${p.name}</option>`)}</select>
        <a class="btn" href="/api/export/vendors.csv${query.portfolio ? `?portfolioId=${query.portfolio}` : ''}">Export CSV</a>
        <a class="btn primary" href="#/assess">Add vendor</a>
      </div>
    </div>
    <div class="card">
      <div class="card-b">
        <div class="row" style="margin-bottom:12px">
          <input id="q" type="search" placeholder="Search name, UEI, vertical…" aria-label="Search vendors">
          <select id="tier" aria-label="Tier"><option value="">All tiers</option>${['critical', 'high', 'moderate', 'low', 'none'].map((t) => html`<option value="${t}" ${raw(state.tier === t ? 'selected' : '')}>${t === 'none' ? 'Not assessed' : t[0].toUpperCase() + t.slice(1)}</option>`)}</select>
          <select id="crit" aria-label="Criticality"><option value="">All criticality</option>${Object.entries(CRIT_LABEL).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select>
          <select id="status" aria-label="Status"><option value="">All statuses</option>${Object.entries(STATUS_LABEL).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select>
        </div>
        <div class="actions" id="bulkbar" style="margin-bottom:10px;display:none">
          <span id="selcount" class="small muted"></span>
          <button class="btn sm" id="addpf">Add to portfolio</button>
          <button class="btn sm" id="reassess">Re-assess selected</button>
          <button class="btn sm danger" id="delete">Delete</button>
        </div>
        <div class="table-wrap" id="tbl"></div>
      </div>
    </div>`);

  const sorters = {
    name: (v) => v.name.toLowerCase(), score: (v) => v.latest?.score ?? -1, exposure: (v) => v.latest?.exposure ?? -1,
    spend: (v) => v.annual_spend || 0, assessed: (v) => v.latest?.assessedAt || '', crit: (v) => Object.keys(CRIT_LABEL).indexOf(v.criticality),
  };
  const draw = () => {
    const q = state.q.toLowerCase();
    let list = rows.filter((v) => (!q || [v.name, v.uei, v.vertical, v.cage, v.contract_ref, ...(v.tags || [])].some((x) => String(x || '').toLowerCase().includes(q)))
      && (!state.tier || (state.tier === 'none' ? !v.latest : v.latest?.tier === state.tier))
      && (!state.crit || v.criticality === state.crit) && (!state.status || v.status === state.status));
    list = list.sort((a, b) => (sorters[state.sort](a) > sorters[state.sort](b) ? 1 : -1) * state.dir);
    const th = (k, label, cls = '') => html`<th class="sortable ${cls}" data-sort="${k}" aria-sort="${state.sort === k ? (state.dir > 0 ? 'ascending' : 'descending') : 'none'}">${label}${state.sort === k ? (state.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    render(main.querySelector('#tbl'), list.length ? html`<table>
      <thead><tr><th><input type="checkbox" id="all" aria-label="Select all"></th>${th('name', 'Vendor')}<th>Vertical</th>${th('crit', 'Criticality')}<th>Status</th><th>Tier</th>${th('score', 'Score', 'num')}${th('exposure', 'Exposure', 'num')}${th('spend', 'Annual spend', 'num')}<th class="num">Open crit/high</th>${th('assessed', 'Last assessed')}</tr></thead>
      <tbody>${list.map((v) => html`<tr class="click" data-id="${v.id}">
        <td><input type="checkbox" data-sel="${v.id}" ${raw(state.selected.has(v.id) ? 'checked' : '')} aria-label="Select ${v.name}"></td>
        <td><a href="#/vendors/${v.id}"><strong>${v.name}</strong></a><div class="small muted">${[v.uei, v.state, v.country].filter(Boolean).join(' · ')}</div>
          ${v.portfolios.map((p) => html`<span class="chip">${p.name}</span>`)}</td>
        <td class="small">${v.vertical || '—'}</td><td>${CRIT_LABEL[v.criticality]}</td><td>${STATUS_LABEL[v.status] || v.status}</td>
        <td>${tierBadge(v.latest?.tier)}${v.latest?.hardStops?.length ? html` <span class="badge t-critical" data-tip="${v.latest.hardStops.join('\n')}">Hard stop</span>` : ''}</td>
        <td class="num">${v.latest?.score ?? '—'}</td><td class="num">${v.latest?.exposure ?? '—'}</td><td class="num">${v.annual_spend ? fmtMoney(v.annual_spend) : '—'}</td>
        <td class="num">${v.latest ? `${v.latest.openCounts.critical} / ${v.latest.openCounts.high}` : '—'}</td>
        <td class="nowrap">${v.latest ? html`${fmtDate(v.latest.assessedAt)}${daysSince(v.latest.assessedAt) > 90 ? html` <span class="badge t-moderate">Stale</span>` : ''}` : '—'}</td></tr>`)}</tbody></table>
      <div class="small muted" style="margin-top:8px">${list.length} of ${rows.length} vendors</div>`
      : html`<div class="empty"><h3>No vendors match</h3><a href="#/assess">Assess a new vendor</a></div>`);
    main.querySelectorAll('th[data-sort]').forEach((t) => t.onclick = () => { const k = t.dataset.sort; state.dir = state.sort === k ? -state.dir : (k === 'name' ? 1 : -1); state.sort = k; draw(); });
    main.querySelectorAll('tr.click').forEach((tr) => tr.onclick = (e) => { if (!e.target.closest('a,input')) location.hash = `#/vendors/${tr.dataset.id}`; });
    main.querySelectorAll('[data-sel]').forEach((c) => c.onchange = () => { const id = Number(c.dataset.sel); c.checked ? state.selected.add(id) : state.selected.delete(id); bar(); });
    const all = main.querySelector('#all');
    if (all) all.onchange = () => { list.forEach((v) => (all.checked ? state.selected.add(v.id) : state.selected.delete(v.id))); draw(); bar(); };
  };
  const bar = () => {
    main.querySelector('#bulkbar').style.display = state.selected.size ? 'flex' : 'none';
    main.querySelector('#selcount').textContent = `${state.selected.size} selected`;
  };
  main.querySelector('#q').oninput = (e) => { state.q = e.target.value; draw(); };
  main.querySelector('#tier').onchange = (e) => { state.tier = e.target.value; draw(); };
  main.querySelector('#crit').onchange = (e) => { state.crit = e.target.value; draw(); };
  main.querySelector('#status').onchange = (e) => { state.status = e.target.value; draw(); };
  main.querySelector('#pf').onchange = (e) => { location.hash = `#/vendors${e.target.value ? `?portfolio=${e.target.value}` : ''}`; };
  main.querySelector('#addpf').onclick = () => modal({
    title: 'Add to portfolio',
    body: html`<label class="f" for="mp">Portfolio</label><select id="mp">${portfolios.map((p) => html`<option value="${p.id}">${p.name}</option>`)}<option value="new">+ New portfolio…</option></select>
      <div class="field" style="margin-top:10px"><label class="f" for="mn">New portfolio name</label><input id="mn" placeholder="e.g. FY27 Network Modernization"></div>`,
    confirm: 'Add',
    onConfirm: async (m) => {
      let id = m.querySelector('#mp').value;
      if (id === 'new' || !portfolios.length) { const name = m.querySelector('#mn').value.trim(); if (!name) throw new Error('Enter a portfolio name'); id = (await api.post('/api/portfolios', { name })).id; }
      await api.post(`/api/portfolios/${id}/vendors`, { vendorIds: [...state.selected] });
      toast(`Added ${state.selected.size} vendor(s) to portfolio`); vendors(main, [], query);
    },
  });
  main.querySelector('#reassess').onclick = async () => {
    const sel = rows.filter((v) => state.selected.has(v.id));
    const { jobId } = await api.post('/api/bulk', { entries: sel.map((v) => ({ name: v.name, uei: v.uei })) });
    toast(`Re-assessment job #${jobId} started for ${sel.length} vendor(s)`);
    location.hash = `#/assess?tab=bulk&job=${jobId}`;
  };
  main.querySelector('#delete').onclick = () => modal({
    title: 'Delete vendors', body: html`<p>Permanently delete ${state.selected.size} vendor(s) and their assessment history? This cannot be undone.</p>`, confirm: 'Delete',
    onConfirm: async () => { for (const id of state.selected) await api.del(`/api/vendors/${id}`); toast('Deleted'); vendors(main, [], query); },
  });
  draw();
}
