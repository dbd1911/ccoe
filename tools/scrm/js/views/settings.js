import { api, download } from '../api.js';
import { html, raw, render, toast, fmtDateTime, modal, INFO_ICON, ALERT_ICON } from '../ui.js';
import { refreshModePill } from '../app.js';

const mb = (b) => (b == null ? '—' : b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(1)} MB`);

export default async function settings(main) {
  const [s, audit, st] = await Promise.all([api.get('/api/settings'), api.get('/api/audit?limit=100'), api.get('/api/storage')]);
  const secret = (k, help) => html`<div class="field"><label class="f" for="${k}">${s[k].label}</label>
    <input id="${k}" type="password" autocomplete="off" spellcheck="false" placeholder="${s[k].configured ? `Saved (${s[k].hint}) — paste a new key to replace` : 'Paste key here'}">
    <div class="help">${help}</div></div>`;
  const text = (k, help, type = 'text') => html`<div class="field"><label class="f" for="${k}">${s[k].label}</label>
    <input id="${k}" type="${type}" value="${s[k].value}"><div class="help">${help}</div></div>`;

  render(main, html`
    <div class="page-head"><div><h1>Settings</h1><div class="sub">Everything here is saved in <strong>this browser only</strong>. Keys never leave your machine except to call the service they belong to.</div></div>
      <div class="actions"><button class="btn primary" id="save">Save settings</button></div></div>

    <div class="grid g-2" style="margin-bottom:16px">
      <div class="card"><div class="card-h"><h2>1 · AI analyst (GenAI.mil / Gemini)</h2><span id="keybadge">${s.llm_api_key.configured ? html`<span class="badge t-low">Key saved</span>` : html`<span class="badge t-moderate">Key needed</span>`}</span></div><div class="card-b">
        ${secret('llm_api_key', 'Your personal GenAI.mil API key. Paste it, select Save, then Test connection. That is all the setup the AI needs.')}
        <label class="small" style="display:block;margin:-4px 0 12px"><input type="checkbox" id="remember_keys" ${raw(s.remember_keys.value !== 'false' ? 'checked' : '')}> Remember keys on this computer (unchecked = forget when the browser closes)</label>
        <details><summary class="small" style="cursor:pointer">Endpoint and model (pre-set for GenAI.mil)</summary><div style="margin-top:10px">
          ${text('llm_endpoint', 'OpenAI-compatible chat-completions URL. GenAI.mil: https://api.genai.mil/v1/chat/completions · Google Gemini API: https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')}
          ${text('llm_model', 'e.g. gemini-2.5-flash or gemini-2.5-pro')}</div></details>
        <div class="actions" style="margin-top:12px"><button class="btn" id="test">Test connection</button><span id="testout" class="small"></span></div>
        <p class="help" style="margin-top:10px">Assessment data (public records plus your notes on the vendor) is sent to this AI service. Use only a service authorized for your data.</p>
      </div></div>
      <div class="card"><div class="card-h"><h2>2 · Data source keys (optional)</h2></div><div class="card-b">
        ${secret('sam_api_key', 'Free: sign in at sam.gov → Profile → Account Details → Public API Key. Adds registration status, corporate parents and exclusion (debarment) checks.')}
        ${secret('csl_api_key', 'Optional live screening search (developer.trade.gov). Not needed if you load the screening list file on Data Sources.')}
        ${secret('opensanctions_api_key', 'Optional: global sanctions, PEP and debarment data.')}
        <button class="btn sm danger" id="forget">Forget all saved keys in this browser</button></div></div>
    </div>

    <div class="grid g-2" style="margin-bottom:16px">
      <div class="card"><div class="card-h"><h2>3 · Check what this network can reach</h2></div><div class="card-b">
        <p class="small">The tool calls public sources straight from your browser. Firewalls, proxies and cross-origin (CORS) rules can block some of them. Run this once on a new network.</p>
        <button class="btn" id="conn">Run connection check</button><div id="connout" style="margin-top:10px"></div></div></div>
      <div class="card"><div class="card-h"><h2>Data mode & assessment parameters</h2></div><div class="card-b">
        <label style="display:block;margin-bottom:6px"><input type="radio" name="mode" value="live" ${raw(s.mode.value === 'live' ? 'checked' : '')}> <strong>Live public data</strong></label>
        <label style="display:block;margin-bottom:10px"><input type="radio" name="mode" value="demo" ${raw(s.mode.value === 'demo' ? 'checked' : '')}> <strong>Demo data</strong> — fictional companies for training</label>
        <div class="row">${text('lookback_years', 'Fiscal years of award history.', 'number')}${text('max_prime_awards', 'Awards expanded for suppliers.', 'number')}${text('stale_days', 'Re-assess after (days).', 'number')}</div>
        <div class="row"><label class="small"><input type="checkbox" id="enable_media" ${raw(s.enable_media.value !== 'false' ? 'checked' : '')}> Adverse media (GDELT)</label>
          <label class="small"><input type="checkbox" id="enable_kev" ${raw(s.enable_kev.value !== 'false' ? 'checked' : '')}> CISA KEV vulnerabilities</label></div>
        <button class="btn sm" id="seed" style="margin-top:8px">Load demo portfolio</button></div></div>
    </div>

    <div class="card" style="margin-bottom:16px"><div class="card-h"><h2>Your data: backup & team sharing</h2>
      <span class="hint">${st.persistent ? `Stored in this browser · ${mb(st.usage?.used)} used` : 'Browser storage unavailable'}</span></div><div class="card-b">
      ${!st.persistent ? html`<div class="alert critical">${ALERT_ICON}<div>This browser is blocking local storage (private window or policy). Work is lost when the tab closes. Export before leaving.</div></div>` : ''}
      ${st.counts.vendors && (!st.lastExport) ? html`<div class="alert warn">${INFO_ICON}<div>Your vendor register has never been backed up. Browser data can be cleared by IT policy or a profile reset. Download a backup regularly.</div></div>` : ''}
      <p class="small">${st.counts.vendors} vendors · ${st.counts.portfolios} portfolios · ${st.counts.assessments} assessments · last backup ${st.lastExport ? fmtDateTime(st.lastExport) : 'never'} · published team workspace ${st.lastShared ? `loaded (${fmtDateTime(st.lastShared)})` : 'not loaded'}</p>
      <div class="grid g-3">
        <div><h3>Back up</h3><p class="small muted">Everything, including full assessment detail. Keep it on a share drive. Never contains API keys.</p><button class="btn" id="exp-full">Download full backup</button></div>
        <div><h3>Restore / merge</h3><p class="small muted">Import a backup or a teammate's export. Vendors are matched by UEI or name; newer data wins.</p><label class="btn" for="imp">Import workspace file</label><input type="file" id="imp" accept=".json,application/json" hidden></div>
        <div><h3>Publish to the CCOE site</h3><p class="small muted">Download a compact team file and commit it as <code>data/manual/scrm-workspace.json</code>. Everyone who opens the tool then gets it automatically.</p>
          <div class="actions"><button class="btn" id="exp-sum">Download team file</button><button class="btn" id="shared">Reload published file</button></div></div>
      </div>
      <div style="margin-top:14px"><button class="btn sm danger" id="reset">Erase all data in this browser…</button></div></div></div>

    <div class="card"><div class="card-h"><h2>Activity log (this browser)</h2><span class="hint">Last 100 events</span></div><div class="card-b table-wrap" style="max-height:420px;overflow:auto"><table>
      <thead><tr><th>Time</th><th>Action</th><th>Detail</th></tr></thead><tbody>${audit.map((a) => html`<tr><td class="nowrap">${fmtDateTime(a.ts)}</td><td class="mono">${a.action}</td><td class="small mono" style="overflow-wrap:anywhere">${a.detail}</td></tr>`)}</tbody></table></div></div>`);

  const $ = (q) => main.querySelector(q);
  const collect = () => {
    const body = { mode: $('input[name=mode]:checked').value, enable_media: String($('#enable_media').checked), enable_kev: String($('#enable_kev').checked), remember_keys: $('#remember_keys').checked };
    for (const k of ['llm_endpoint', 'llm_model', 'lookback_years', 'max_prime_awards', 'stale_days']) body[k] = $(`#${k}`).value;
    for (const k of ['llm_api_key', 'sam_api_key', 'csl_api_key', 'opensanctions_api_key']) { const v = $(`#${k}`).value.trim(); if (v) body[k] = v; }
    return body;
  };
  const save = async (quiet) => { await api.put('/api/settings', collect()); refreshModePill(); if (!quiet) { toast('Settings saved'); settings(main); } };
  $('#save').onclick = () => save().catch((e) => toast(e.message, 'error'));
  $('#test').onclick = async (e) => {
    e.target.disabled = true; render($('#testout'), html`<span class="spinner"></span> Contacting AI service…`);
    try { await save(true); const r = await api.post('/api/llm/test'); render($('#testout'), html`<span class="badge t-low">Connected</span> ${r.model} replied in ${(r.ms / 1000).toFixed(1)}s`); render($('#keybadge'), html`<span class="badge t-low">Key saved</span>`); $('#llm_api_key').value = ''; }
    catch (err) { render($('#testout'), html`<span class="badge t-critical">Failed</span> ${err.message}`); }
    finally { e.target.disabled = false; }
  };
  $('#conn').onclick = async (e) => {
    e.target.disabled = true; render($('#connout'), html`<span class="spinner"></span> Checking…`);
    try {
      await save(true);
      const out = await api.post('/api/connectivity');
      render($('#connout'), html`<table><tbody>${out.map((x) => html`<tr><td>${x.label}</td><td>${x.ok ? html`<span class="badge t-low">Reachable</span>` : html`<span class="badge t-moderate">Not available</span>`}</td><td class="small muted">${x.ok ? `${x.ms} ms` : x.error}</td></tr>`)}</tbody></table>
        <p class="help">Unavailable sources are skipped during assessments and shown as such on each report. The screening list can always be loaded from a file on Data Sources.</p>`);
    } catch (err) { toast(err.message, 'error'); } finally { e.target.disabled = false; }
  };
  $('#forget').onclick = async () => { await api.post('/api/settings/forget-keys'); toast('Keys removed from this browser'); refreshModePill(); settings(main); };
  $('#exp-full').onclick = () => download('/api/workspace/export?kind=full').then(() => settings(main));
  $('#exp-sum').onclick = () => download('/api/workspace/export?kind=summary');
  $('#imp').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const r = await api.post('/api/workspace/import', JSON.parse(await f.text())); toast(`Imported: ${r.added} new, ${r.updated} updated vendors`); settings(main); }
    catch (err) { toast(err.message, 'error'); }
  };
  $('#shared').onclick = async () => {
    try { const r = await api.post('/api/workspace/load-shared'); toast(r.loaded ? `Published workspace loaded (${r.added} new, ${r.updated} updated)` : r.reason); settings(main); }
    catch (err) { toast(err.message, 'error'); }
  };
  $('#reset').onclick = () => modal({ title: 'Erase all data in this browser', confirm: 'Erase everything',
    body: html`<p>Deletes every vendor, portfolio, assessment and finding disposition stored in this browser. API keys are kept. Download a backup first if you may need it.</p>`,
    onConfirm: async () => { await api.post('/api/workspace/reset'); toast('Browser data erased'); location.hash = '#/dashboard'; } });
  $('#seed').onclick = () => modal({ title: 'Load demo portfolio', body: html`<p>Creates a portfolio of 8 fictional vendors with assessment history and switches to demo data mode. Your existing vendors are not changed.</p>`, confirm: 'Load demo',
    onConfirm: async () => { await api.post('/api/demo/seed'); toast('Demo portfolio loaded'); refreshModePill(); location.hash = '#/dashboard'; } });
}
