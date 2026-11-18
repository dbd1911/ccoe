import { initTooltips, render, html, toast, $$ } from './ui.js';
import { api } from './api.js';
import dashboard from './views/dashboard.js';
import vendors from './views/vendors.js';
import vendor from './views/vendor.js';
import assess from './views/assess.js';
import portfolios from './views/portfolios.js';
import screening from './views/screening.js';
import sources from './views/sources.js';
import methodology from './views/methodology.js';
import settings from './views/settings.js';
import report from './views/report.js';

const routes = [
  [/^\/?$/, dashboard, 'dashboard'], [/^\/dashboard$/, dashboard, 'dashboard'],
  [/^\/vendors$/, vendors, 'vendors'], [/^\/vendors\/(\d+)$/, vendor, 'vendors'],
  [/^\/assess$/, assess, 'assess'], [/^\/portfolios$/, portfolios, 'portfolios'],
  [/^\/screening$/, screening, 'screening'], [/^\/sources$/, sources, 'sources'],
  [/^\/methodology$/, methodology, 'methodology'], [/^\/settings$/, settings, 'settings'],
  [/^\/report\/(\d+)$/, report, 'vendors'],
];

let navToken = 0;
async function route() {
  const [path, qs] = (location.hash.slice(1) || '/dashboard').split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const main = document.getElementById('main');
  const hit = routes.find(([re]) => re.test(path));
  $$('#nav a').forEach((a) => a.classList.toggle('active', !!hit && a.dataset.nav === hit[2]));
  if (!hit) { render(main, html`<div class="empty"><h3>Page not found</h3><a href="#/dashboard">Go to dashboard</a></div>`); return; }
  const token = ++navToken;
  render(main, html`<div class="empty"><span class="spinner"></span></div>`);
  try {
    await hit[1](main, path.match(hit[0]).slice(1), query, () => token === navToken);
  } catch (e) {
    console.error(e);
    if (token === navToken) render(main, html`<div class="alert critical">Failed to load: ${e.message}</div>`);
  }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

export async function refreshModePill() {
  try {
    const h = await api.get('/api/health');
    render(document.getElementById('mode-pill'), html`
      <div><span class="dot" style="background:${h.mode === 'demo' ? 'var(--warning)' : 'var(--good)'}"></span>${h.mode === 'demo' ? 'Demo data mode' : 'Live public data'}</div>
      <div style="margin-top:4px"><span class="dot" style="background:${h.ai ? 'var(--good)' : 'var(--axis)'}"></span>AI analyst ${h.ai ? 'enabled' : 'not configured'}</div>`);
  } catch { /* ignore */ }
}

window.addEventListener('hashchange', route);
window.addEventListener('unhandledrejection', (e) => toast(e.reason?.message || 'Unexpected error', 'error'));
initTooltips();
refreshModePill();
route();
