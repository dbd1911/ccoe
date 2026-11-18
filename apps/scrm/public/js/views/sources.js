import { api, getMeta } from '../api.js';
import { html, raw, render, toast, fmtNum } from '../ui.js';

const STATUS = { ready: ['low', 'Automated · ready'], configured: ['low', 'Automated · configured'], 'needs-key': ['moderate', 'Automated · needs API key'],
  'needs-data': ['moderate', 'Automated · load dataset'], reference: ['none', 'Reference / manual'] };

export default async function sources(main) {
  const [d, meta] = await Promise.all([api.get('/api/sources'), getMeta()]);
  const qs = Object.entries(d.questions);
  render(main, html`
    <div class="page-head"><div><h1>Data sources</h1><div class="sub">Where public supply chain risk information comes from, what each source answers, and how this application uses it.</div></div>
      <div class="actions"><a class="btn" href="#/settings">Configure API keys</a></div></div>

    <div class="card" style="margin-bottom:16px"><div class="card-h"><h2>Coverage matrix — which source answers which question</h2></div>
      <div class="card-b table-wrap"><table><thead><tr><th>Source</th>${qs.map(([k, q]) => html`<th style="white-space:normal;min-width:84px" data-tip="${q}">${k}</th>`)}</tr></thead>
      <tbody>${d.sources.map((s) => html`<tr><td class="nowrap"><strong>${s.name}</strong>${s.automated ? '' : html` <span class="chip">manual</span>`}</td>
        ${qs.map(([k]) => html`<td style="text-align:center">${s.answers.includes(k) ? raw(`<span aria-label="yes" style="color:var(--${s.automated ? 'good-ink' : 'muted'});font-weight:700">●</span>`) : ''}</td>`)}</tr>`)}</tbody></table>
      <div class="help">${qs.map(([k, q]) => html`<strong>${k}</strong>: ${q}. `)}</div></div></div>

    <div class="grid g-2" style="margin-bottom:16px">
      <div class="card"><div class="card-h"><h2>Consolidated Screening List (local copy)</h2></div><div class="card-b">
        <p><strong>${fmtNum(d.csl.entries)}</strong> entries loaded${d.csl.entries ? '' : ' — screening is limited to built-in statutory lists until you load the CSL'}.</p>
        ${d.csl.bySource.length ? html`<ul class="list-plain small">${d.csl.bySource.map((b) => html`<li>${b.source} — ${fmtNum(b.n)}</li>`)}</ul>` : ''}
        <div class="actions" style="margin-top:10px"><button class="btn primary" id="refresh">Download latest from trade.gov</button>
          <label class="btn" for="upload">Import JSON file</label><input type="file" id="upload" accept=".json,application/json" hidden></div>
        <p class="help">The bulk file (no key required) is at <code>data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.json</code>. On air-gapped or restricted networks, download it elsewhere and import it here. Refresh at least weekly.</p>
      </div></div>
      <div class="card"><div class="card-h"><h2>Built-in statutory prohibition lists</h2><span class="hint">Curated as of ${meta.watchlistAsOf}</span></div><div class="card-b">
        <ul class="list-plain small">${Object.entries(meta.lists).map(([, l]) => html`<li><strong>${l.name}</strong> — ${l.authority}<div class="muted">${l.effect}</div></li>`)}</ul>
        <p class="help">${meta.watchEntityCount} entities with aliases. These are procurement prohibitions that the CSL does not fully cover. Review quarterly against the authoritative sources.</p></div></div>
    </div>

    <div class="grid g-2">${d.sources.map((s) => { const st = STATUS[s.status] || STATUS.reference; return html`
      <div class="card"><div class="card-h"><h2>${s.name}</h2><span class="badge t-${st[0]}">${st[1]}</span></div><div class="card-b">
        <p>${s.provides}</p>
        <dl class="kv small"><dt>Owner</dt><dd>${s.owner}</dd><dt>Access</dt><dd>${s.key}</dd><dt>Cost</dt><dd>${s.cost}</dd>
          ${s.limits ? html`<dt>Limitations</dt><dd>${s.limits}</dd>` : ''}<dt>Link</dt><dd><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.url}</a></dd></dl></div></div>`; })}</div>`);

  main.querySelector('#refresh').onclick = async (e) => {
    e.target.disabled = true; e.target.innerHTML = '<span class="spinner"></span> Downloading…';
    try { const r = await api.post('/api/screening/refresh'); toast(`Loaded ${fmtNum(r.entries)} screening entries`); sources(main); }
    catch (err) { toast(`Download failed: ${err.message}. Import the file manually instead.`, 'error'); e.target.disabled = false; e.target.textContent = 'Download latest from trade.gov'; }
  };
  main.querySelector('#upload').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const r = await api.post('/api/screening/import', JSON.parse(await f.text())); toast(`Imported ${fmtNum(r.entries)} entries`); sources(main); }
    catch (err) { toast(err.message, 'error'); }
  };
}
