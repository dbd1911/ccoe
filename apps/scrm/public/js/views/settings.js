import { api } from '../api.js';
import { html, raw, render, toast, fmtDateTime, modal } from '../ui.js';
import { refreshModePill } from '../app.js';

export default async function settings(main) {
  const [s, audit] = await Promise.all([api.get('/api/settings'), api.get('/api/audit?limit=100')]);
  const secret = (k, help) => html`<div class="field"><label class="f" for="${k}">${s[k].label}</label>
    <input id="${k}" type="password" autocomplete="off" placeholder="${s[k].configured ? '•••••••• configured — leave blank to keep' : 'Not configured'}" ${raw(s[k].fromEnv ? 'disabled' : '')}>
    <div class="help">${s[k].fromEnv ? 'Set by environment variable (read-only here). ' : ''}${help}</div></div>`;
  const text = (k, help, type = 'text') => html`<div class="field"><label class="f" for="${k}">${s[k].label}</label>
    <input id="${k}" type="${type}" value="${s[k].value}" ${raw(s[k].fromEnv ? 'disabled' : '')}><div class="help">${help}</div></div>`;
  render(main, html`
    <div class="page-head"><div><h1>Settings</h1><div class="sub">API keys are stored server-side and never returned to the browser.</div></div>
      <div class="actions"><button class="btn primary" id="save">Save settings</button></div></div>
    <div class="grid g-2" style="margin-bottom:16px">
      <div class="card"><div class="card-h"><h2>Data mode</h2></div><div class="card-b">
        <label style="display:block;margin-bottom:8px"><input type="radio" name="mode" value="live" ${raw(s.mode.value === 'live' ? 'checked' : '')}> <strong>Live public data</strong> — query SAM.gov, USAspending.gov, GLEIF, SEC EDGAR, GDELT and CISA in real time.</label>
        <label style="display:block"><input type="radio" name="mode" value="demo" ${raw(s.mode.value === 'demo' ? 'checked' : '')}> <strong>Demo data</strong> — fictional companies for training and offline evaluation. Screening lists still apply.</label>
        <div class="actions" style="margin-top:14px"><button class="btn" id="seed">Load demo portfolio</button></div></div></div>
      <div class="card"><div class="card-h"><h2>AI analyst (Claude)</h2></div><div class="card-b">
        ${secret('anthropic_api_key', 'Enables narrative assessments, mitigation plans, vendor questionnaires and the “Ask the analyst” chat. Assessment data is sent to the Anthropic API — confirm this is permitted for your environment.')}
        ${text('ai_model', 'Default: claude-opus-5-5.')}</div></div>
    </div>
    <div class="grid g-2" style="margin-bottom:16px">
      <div class="card"><div class="card-h"><h2>Data source keys</h2></div><div class="card-b">
        ${secret('sam_api_key', 'Free: sign in at sam.gov → Profile → Account Details → Public API Key. Enables registration, hierarchy and exclusions checks.')}
        ${secret('csl_api_key', 'Optional: developer.trade.gov subscription key for live CSL search. Without it, the downloaded CSL file is used.')}
        ${secret('opensanctions_api_key', 'Optional: global sanctions, PEP and debarment data.')}
        ${text('sec_user_agent', 'SEC requires a descriptive User-Agent with a contact email for automated access.')}</div></div>
      <div class="card"><div class="card-h"><h2>Assessment parameters</h2></div><div class="card-b">
        ${text('lookback_years', 'Fiscal years of federal award history to analyze.', 'number')}
        ${text('max_prime_awards', 'Largest prime awards expanded to find subcontractors (more = slower, deeper).', 'number')}
        ${text('stale_days', 'Continuous-monitoring threshold for re-assessment.', 'number')}
        <div class="row"><label class="small"><input type="checkbox" id="enable_media" ${raw(s.enable_media.value !== 'false' ? 'checked' : '')}> Adverse media (GDELT)</label>
          <label class="small"><input type="checkbox" id="enable_kev" ${raw(s.enable_kev.value !== 'false' ? 'checked' : '')}> CISA KEV product vulnerabilities</label></div></div></div>
    </div>
    <div class="card"><div class="card-h"><h2>Audit log</h2><span class="hint">Last 100 events</span></div><div class="card-b table-wrap" style="max-height:420px;overflow:auto"><table>
      <thead><tr><th>Time</th><th>Action</th><th>Detail</th></tr></thead><tbody>${audit.map((a) => html`<tr><td class="nowrap">${fmtDateTime(a.ts)}</td><td class="mono">${a.action}</td><td class="small mono" style="overflow-wrap:anywhere">${a.detail}</td></tr>`)}</tbody></table></div></div>`);

  main.querySelector('#save').onclick = async () => {
    const body = { mode: main.querySelector('input[name=mode]:checked').value, enable_media: String(main.querySelector('#enable_media').checked), enable_kev: String(main.querySelector('#enable_kev').checked) };
    for (const k of ['ai_model', 'sec_user_agent', 'lookback_years', 'max_prime_awards', 'stale_days']) if (!s[k].fromEnv) body[k] = main.querySelector(`#${k}`).value;
    for (const k of ['anthropic_api_key', 'sam_api_key', 'csl_api_key', 'opensanctions_api_key']) { const v = main.querySelector(`#${k}`).value.trim(); if (v && !s[k].fromEnv) body[k] = v; }
    try { await api.put('/api/settings', body); toast('Settings saved'); refreshModePill(); settings(main); } catch (e) { toast(e.message, 'error'); }
  };
  main.querySelector('#seed').onclick = () => modal({ title: 'Load demo portfolio', body: html`<p>Creates a portfolio of 8 fictional vendors with assessment history and switches to demo data mode. Your existing vendors are not changed.</p>`, confirm: 'Load demo',
    onConfirm: async () => { await api.post('/api/demo/seed'); toast('Demo portfolio loaded'); refreshModePill(); location.hash = '#/dashboard'; } });
}
