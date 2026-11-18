import { api } from '../api.js';
import { html, render, statusBadge, toast } from '../ui.js';

export default async function screening(main) {
  render(main, html`
    <div class="page-head"><div><h1>Party screening</h1><div class="sub">Quickly screen any names — a proposed subcontractor, a parent company, a distributor — against restricted-party and prohibited-source lists.</div></div></div>
    <div class="grid g-3">
      <div class="card"><div class="card-b">
        <label class="f" for="names">Names to screen (one per line, up to 200)</label>
        <textarea id="names" rows="14" placeholder="Hangzhou Hikvision Digital Technology&#10;Acme Components LLC&#10;Kaspersky Lab"></textarea>
        <div class="actions" style="margin-top:10px"><button class="btn primary" id="go">Screen</button></div>
        <p class="help">Checks built-in statutory lists (NDAA §889, FCC Covered List, §1260H, UFLPA, Kaspersky, covered drones, §5949) plus the Consolidated Screening List and OpenSanctions when configured. Results are leads for adjudication, not determinations.</p>
      </div></div>
      <div class="card span-2"><div class="card-h"><h2>Results</h2></div><div class="card-b" id="out"><div class="empty small">Enter names and select Screen.</div></div></div>
    </div>`);
  main.querySelector('#go').onclick = async (e) => {
    const names = main.querySelector('#names').value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!names.length) return toast('Enter at least one name', 'error');
    e.target.disabled = true; render(main.querySelector('#out'), html`<span class="spinner"></span> Screening ${names.length} name(s)…`);
    try {
      const res = await api.post('/api/screening/check', { names });
      render(main.querySelector('#out'), html`<div class="table-wrap"><table><thead><tr><th>Name</th><th>Result</th><th>Matches</th></tr></thead><tbody>
        ${res.map((r) => { const st = r.hits.some((h) => h.strength === 'strong') ? 'flagged' : r.hits.length ? 'potential' : 'clear'; return html`<tr>
          <td><strong>${r.name}</strong><div class="small muted">Lists: ${r.checked.join(', ')}</div></td><td>${statusBadge(st)}</td>
          <td>${r.hits.length ? r.hits.map((h) => html`<div class="small" style="margin-bottom:4px"><strong>${h.listName}</strong> — “${h.entryName}”${h.matchedName && h.matchedName !== h.entryName ? ` (alias “${h.matchedName}”)` : ''} · ${Math.round(h.score * 100)}%${h.url ? html` · <a href="${h.url}" target="_blank" rel="noopener noreferrer">source</a>` : ''}</div>`) : html`<span class="small muted">No matches</span>`}
          ${r.errors.length ? html`<div class="small" style="color:var(--critical-ink)">${r.errors.join('; ')}</div>` : ''}</td></tr>`; })}</tbody></table></div>`);
    } catch (err) { toast(err.message, 'error'); } finally { e.target.disabled = false; }
  };
}
