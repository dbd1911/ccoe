import { initTooltips, render, html, toast, $$ } from './ui.js';
import { api, download } from './api.js';
import * as store from './backend/store.js';
import { loadSiteConfig } from './backend/settings.js';
import { loadShared } from './backend/routes.js';
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
      <div style="margin-top:4px"><span class="dot" style="background:${h.ai ? 'var(--good)' : 'var(--axis)'}"></span>${h.ai ? 'AI analyst enabled' : html`<a href="#/settings" style="color:inherit">AI analyst: add API key</a>`}</div>`);
  } catch { /* ignore */ }
}

// Export links (href="/api/...") are generated in the browser and saved as files.
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href^="/api/"]'); if (!a) return;
  e.preventDefault();
  download(a.getAttribute('href')).catch((err) => toast(err.message, 'error'));
});

window.addEventListener('hashchange', route);
window.addEventListener('unhandledrejection', (e) => toast(e.reason?.message || 'Unexpected error', 'error'));
initTooltips();

(async () => {
  await Promise.all([store.open(), loadSiteConfig()]);
  if (!store.persistent) toast('This browser is not allowing local storage — your work will be lost when the tab closes. Use Settings → Export to save it.', 'error');
  try {
    const s = await loadShared();
    if (s.loaded) toast(`Loaded the published team workspace (${s.added} new, ${s.updated} updated vendors)`);
  } catch (e) { console.warn('Shared workspace not loaded', e); }
  refreshModePill();
  route();
})();
