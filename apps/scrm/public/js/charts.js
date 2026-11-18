// Dependency-free SVG charts. Thin marks, recessive grid, hover tooltips via data-tip,
// labels in text ink (never series color). Every chart has a text equivalent nearby.
import { html, raw, esc } from './ui.js';

/** Horizontal bar chart. items: [{label, value, color?, tip?, href?}] */
export function barH(items, { width = 560, barH = 16, gap = 12, labelW = 190, format = (v) => v, max, valueW = 70, ariaLabel = 'Bar chart' } = {}) {
  if (!items.length) return html`<div class="empty small">No data</div>`;
  const m = max ?? Math.max(...items.map((i) => i.value), 1);
  const plotW = width - labelW - valueW;
  const h = items.length * (barH + gap) + 4;
  const rows = items.map((it, i) => {
    const y = i * (barH + gap) + 2;
    const w = Math.max(it.value > 0 ? 3 : 0, (it.value / m) * plotW);
    const label = it.label.length > 30 ? `${it.label.slice(0, 29)}…` : it.label;
    const tip = it.tip || `${it.label}: ${format(it.value)}`;
    return `<g>
      <text x="${labelW - 8}" y="${y + barH / 2 + 4}" text-anchor="end">${esc(label)}</text>
      <rect class="mark" x="${labelW}" y="${y}" width="${w}" height="${barH}" rx="3" fill="${it.color || 'var(--s1)'}"></rect>
      <text x="${labelW + w + 6}" y="${y + barH / 2 + 4}" style="fill:var(--ink)">${esc(format(it.value))}</text>
      <rect class="hit" x="0" y="${y - gap / 2}" width="${width}" height="${barH + gap}" data-tip="${esc(tip)}"><title>${esc(tip)}</title></rect>
    </g>`;
  }).join('');
  return raw(`<svg class="chart" viewBox="0 0 ${width} ${h}" role="img" aria-label="${esc(ariaLabel)}">
    <line x1="${labelW}" x2="${labelW}" y1="0" y2="${h}" stroke="var(--axis)"/>${rows}</svg>`);
}

/** Single-series line chart. points: [{label, value, tip?}] */
export function line(points, { width = 560, height = 200, yMax = 100, format = (v) => v, ariaLabel = 'Line chart', bands = false } = {}) {
  if (!points.length) return html`<div class="empty small">No history yet</div>`;
  const pad = { l: yMax === 100 ? 34 : 52, r: 14, t: 10, b: 26 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const x = (i) => pad.l + (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v) => pad.t + H - (v / yMax) * H;
  const ticks = yMax === 100 ? [0, 25, 50, 75, 100] : [0, 1, 2, 3].map((i) => (yMax / 3) * i);
  const bandsSvg = bands ? [[0, 25, 'var(--good)'], [25, 50, 'var(--warning)'], [50, 75, 'var(--serious)'], [75, 100, 'var(--critical)']]
    .map(([a, b, c]) => `<rect x="${pad.l}" y="${y(b)}" width="${W}" height="${y(a) - y(b)}" fill="${c}" opacity=".07"/>`).join('') : '';
  const grid = ticks.map((t) => `<line class="gridline" x1="${pad.l}" x2="${pad.l + W}" y1="${y(t)}" y2="${y(t)}"/><text x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end">${esc(yMax === 100 ? t : format(t))}</text>`).join('');
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const step = Math.max(1, Math.ceil(points.length / 8));
  const xl = points.map((p, i) => (i % step === 0 || i === points.length - 1 ? `<text x="${x(i)}" y="${height - 6}" text-anchor="middle">${esc(p.label)}</text>` : '')).join('');
  const colW = points.length > 1 ? W / (points.length - 1) : W;
  const dots = points.map((p, i) => {
    const tip = p.tip || `${p.label}: ${format(p.value)}`;
    return `<g><rect class="hit" x="${x(i) - colW / 2}" y="${pad.t}" width="${colW}" height="${H}" data-tip="${esc(tip)}"/>
      <circle cx="${x(i)}" cy="${y(p.value)}" r="4" fill="var(--s1)" stroke="var(--surface)" stroke-width="2" pointer-events="none"/></g>`;
  }).join('');
  return raw(`<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(ariaLabel)}">${bandsSvg}${grid}
    <path d="${path}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>${dots}${xl}</svg>`);
}

/** One horizontal segmented bar (e.g. tier distribution) with 2px surface gaps. */
export function segmented(segs, { height = 18, ariaLabel = 'Distribution' } = {}) {
  const total = segs.reduce((t, s) => t + s.value, 0);
  if (!total) return html`<div class="empty small">No assessed vendors</div>`;
  const parts = segs.filter((s) => s.value).map((s) =>
    `<div style="flex:${s.value};background:${s.color};height:${height}px;border-radius:4px" data-tip="${esc(`${s.label}: ${s.value}`)}"></div>`).join('');
  return raw(`<div role="img" aria-label="${esc(ariaLabel)}" style="display:flex;gap:2px">${parts}</div>`);
}

/** Small inline sparkline for tables. */
export function spark(values, { width = 90, height = 24 } = {}) {
  if (values.length < 2) return '';
  const max = 100;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`).join(' ');
  return raw(`<svg width="${width}" height="${height}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--s1)" stroke-width="1.5"/></svg>`);
}
