// UI helpers: safe HTML templating (everything escaped unless explicitly raw), formatting,
// toasts, modals and tooltips. All third-party data flows through esc().

export class Raw { constructor(s) { this.s = String(s); } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : v === false || v == null ? '' : esc(v));
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += val(vals[i]) + strings[i + 1];
  return new Raw(out);
}
export const render = (el, tpl) => { el.innerHTML = tpl instanceof Raw ? tpl.s : esc(tpl); };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const fmtMoney = (n, compact = true) => {
  if (n == null || isNaN(n)) return '—';
  if (!compact) return `$${Math.round(n).toLocaleString('en-US')}`;
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
};
export const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'));
const toDate = (s) => {
  const str = String(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(`${str}T12:00:00`);
  if (/^\d{4}-\d{2}-\d{2} \d/.test(str)) return new Date(`${str.replace(' ', 'T')}Z`); // SQLite UTC timestamps
  return new Date(str);
};
export const fmtDate = (s) => { if (!s) return '—'; const d = toDate(s); return isNaN(d) ? s : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); };
export const fmtDateTime = (s) => { if (!s) return '—'; const d = toDate(s); return isNaN(d) ? s : d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); };
export const daysSince = (s) => Math.floor((Date.now() - toDate(s)) / 86400000);

const ICONS = {
  low: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 11.2 3.3 8l1-1 2.2 2.2 5.2-5.2 1 1z"/></svg>',
  moderate: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.5"/></svg>',
  high: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 15 14H1zm-.7 4v4h1.4V6zm0 5v1.4h1.4V11z"/></svg>',
  critical: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1h6l4 4v6l-4 4H5l-4-4V5zm2.3 3v5h1.4V4zm0 6v1.6h1.4V10z"/></svg>',
};
export const TIER_LABEL = { low: 'Low', moderate: 'Moderate', high: 'High', critical: 'Critical' };
export const tierBadge = (t, suffix = '') => (t
  ? html`<span class="badge t-${t}">${raw(ICONS[t] || '')}${TIER_LABEL[t] || t}${suffix}</span>`
  : html`<span class="badge t-none">Not assessed</span>`);
const SEV_TIER = { critical: 'critical', high: 'high', medium: 'moderate', low: 'low', info: 'info' };
export const sevBadge = (s) => html`<span class="badge t-${SEV_TIER[s] || 'info'}">${raw(ICONS[SEV_TIER[s]] || '')}${s[0].toUpperCase() + s.slice(1)}</span>`;
export const statusBadge = (s) => {
  const m = { flagged: ['critical', 'Flagged'], potential: ['high', 'Potential match'], clear: ['low', 'Clear'] }[s] || ['none', s];
  return html`<span class="badge t-${m[0]}">${raw(ICONS[m[0]] || '')}${m[1]}</span>`;
};
export const tierColor = (t) => ({ low: 'var(--good)', moderate: 'var(--warning)', high: 'var(--serious)', critical: 'var(--critical)' }[t] || 'var(--axis)');
export const tierOf = (s) => (s >= 75 ? 'critical' : s >= 50 ? 'high' : s >= 25 ? 'moderate' : 'low');
export const CRIT_LABEL = { low: 'Low', moderate: 'Moderate', high: 'High', 'mission-critical': 'Mission-critical' };
export const STATUS_LABEL = { 'under-review': 'Under review', approved: 'Approved', conditional: 'Conditional', rejected: 'Rejected', offboarded: 'Offboarded' };

export function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  const host = document.getElementById('toasts');
  host.appendChild(t);
  setTimeout(() => host.removeChild(t), type === 'error' ? 7000 : 3500);
}

export function modal({ title, body, confirm = 'Save', cancel = 'Cancel', onConfirm, wide = false }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = html`<div class="modal" role="dialog" aria-modal="true" aria-label="${title}" ${raw(wide ? 'style="width:min(900px,100%)"' : '')}>
    <div class="mh"><h2>${title}</h2><button class="btn ghost sm" data-x aria-label="Close">✕</button></div>
    <div class="mb">${body}</div>
    <div class="mf">${cancel ? html`<button class="btn" data-x>${cancel}</button>` : ''}${confirm ? html`<button class="btn primary" data-ok>${confirm}</button>` : ''}</div></div>`.s;
  const close = () => { if (back.parentNode) back.parentNode.removeChild(back); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-x]')) close(); });
  back.querySelector('[data-ok]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    try { if ((await onConfirm?.(back)) !== false) close(); } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; }
  });
  document.body.appendChild(back);
  back.querySelector('input,select,textarea,button[data-ok]')?.focus();
  return { el: back, close };
}

// Global tooltip: any element with data-tip shows it on hover/focus.
export function initTooltips() {
  const tip = document.getElementById('tooltip');
  const place = (x, y) => {
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, x + 12))}px`;
    tip.style.top = `${y - h - 12 < 8 ? y + 16 : y - h - 12}px`;
  };
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest?.('[data-tip]'); if (!el) return;
    tip.textContent = el.getAttribute('data-tip'); tip.hidden = false; place(e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', (e) => { if (!tip.hidden) place(e.clientX, e.clientY); });
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget?.closest?.('[data-tip]')) tip.hidden = true; });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest?.('[data-tip]'); if (!el) return;
    const b = el.getBoundingClientRect();
    tip.textContent = el.getAttribute('data-tip'); tip.hidden = false; place(b.left + b.width / 2, b.top);
  });
  document.addEventListener('focusout', () => { tip.hidden = true; });
}

/** Very small Markdown renderer for AI answers (escapes first, then formats). */
export function md(text) {
  const lines = esc(text).split('\n');
  let out = '', inList = false;
  for (let l of lines) {
    l = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
    const li = l.match(/^\s*[-*•]\s+(.*)/) || l.match(/^\s*\d+\.\s+(.*)/);
    if (li) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${li[1]}</li>`; continue; }
    if (inList) { out += '</ul>'; inList = false; }
    const hd = l.match(/^#{1,4}\s+(.*)/);
    if (hd) out += `<p><strong>${hd[1]}</strong></p>`; else if (l.trim()) out += `<p>${l}</p>`;
  }
  if (inList) out += '</ul>';
  return raw(out);
}

export const ALERT_ICON = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 1 21h22zm-1 7h2v6h-2zm0 8h2v2h-2z"/></svg>');
export const INFO_ICON = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z"/></svg>');
