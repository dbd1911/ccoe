import { api } from '../api.js';
import { html, render, fmtDate, toast, modal, tierBadge, tierOf } from '../ui.js';

export default async function portfolios(main) {
  const [list, vendors] = await Promise.all([api.get('/api/portfolios'), api.get('/api/vendors')]);
  const stats = (pid) => {
    const vs = vendors.filter((v) => v.portfolios.some((p) => p.id === pid));
    const sc = vs.filter((v) => v.latest).map((v) => v.latest.score);
    return { n: vs.length, avg: sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null,
      hi: vs.filter((v) => v.latest?.score >= 50).length, stops: vs.filter((v) => v.latest?.hardStops?.length).length, spend: vs.reduce((t, v) => t + (v.annual_spend || 0), 0) };
  };
  render(main, html`
    <div class="page-head"><div><h1>Portfolios</h1><div class="sub">Group vendors by program, contract vehicle, mission system or business line.</div></div>
      <div class="actions"><button class="btn primary" id="new">New portfolio</button></div></div>
    ${list.length ? html`<div class="grid g-3">${list.map((p) => { const s = stats(p.id); return html`
      <div class="card"><div class="card-h"><h2>${p.name}</h2>${s.avg != null ? tierBadge(tierOf(s.avg), ` · ${s.avg}`) : ''}</div>
        <div class="card-b"><p class="small muted">${p.description || 'No description'}</p>
          <dl class="kv"><dt>Vendors</dt><dd>${s.n}</dd><dt>High / critical</dt><dd>${s.hi}</dd><dt>Hard stops</dt><dd>${s.stops}</dd>
            <dt>Annual spend</dt><dd>$${Math.round(s.spend).toLocaleString('en-US')}</dd><dt>Created</dt><dd>${fmtDate(p.created_at)}</dd></dl>
          <div class="actions" style="margin-top:12px"><a class="btn sm primary" href="#/dashboard?portfolio=${p.id}">Dashboard</a><a class="btn sm" href="#/vendors?portfolio=${p.id}">Vendors</a>
            <a class="btn sm" href="/api/export/vendors.csv?portfolioId=${p.id}">CSV</a><button class="btn sm" data-rename="${p.id}">Rename</button><button class="btn sm danger" data-del="${p.id}">Delete</button></div></div></div>`; })}</div>`
      : html`<div class="card"><div class="empty"><h3>No portfolios yet</h3><p>Create one to track a set of vendors together, or import a list on <a href="#/assess?tab=bulk">New assessment</a>.</p></div></div>`}`);
  const form = (p = {}) => html`<div class="field"><label class="f" for="pn">Name</label><input id="pn" value="${p.name || ''}"></div>
    <div class="field"><label class="f" for="pd">Description</label><textarea id="pd" rows="3">${p.description || ''}</textarea></div>`;
  main.querySelector('#new').onclick = () => modal({ title: 'New portfolio', body: form(), confirm: 'Create',
    onConfirm: async (m) => { await api.post('/api/portfolios', { name: m.querySelector('#pn').value, description: m.querySelector('#pd').value }); toast('Portfolio created'); portfolios(main); } });
  main.querySelectorAll('[data-rename]').forEach((b) => b.onclick = () => { const p = list.find((x) => x.id === Number(b.dataset.rename));
    modal({ title: 'Edit portfolio', body: form(p), onConfirm: async (m) => { await api.put(`/api/portfolios/${p.id}`, { name: m.querySelector('#pn').value, description: m.querySelector('#pd').value }); portfolios(main); } }); });
  main.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => modal({ title: 'Delete portfolio', body: html`<p>Delete this portfolio? Vendors and their assessment history are kept.</p>`, confirm: 'Delete',
    onConfirm: async () => { await api.del(`/api/portfolios/${b.dataset.del}`); toast('Deleted'); portfolios(main); } }));
}
