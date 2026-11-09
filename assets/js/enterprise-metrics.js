/* ============================================================
   Enterprise RMF metrics + Cyber Task Order (CTO) dashboard
   Source: data/manual/metrics.json → latest snapshot's
           "enterprise" and "cyberTaskOrders" blocks.
   Containers (add any of these to a page; each is optional):
     [data-ent-hero]        home-page hero band (4 headline numbers)
     [data-ent-highlights]  home-page "Portfolio Health at a Glance"
     [data-ent-dashboard]   full enterprise metrics (RMF Operations)
     [data-cto-dashboard]   Cyber Task Order KPI/KRI dashboard
     [data-ent-date]        "As of" line
   Preview with illustrative data: open the page with ?demo=1
   (reads data/manual/metrics.sample.json — never real data).
   null = not available; 0 = confirmed zero.
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- schema ---------- */
  var ENT_BUCKETS = {
    workflowsInQueue: ['NIPR', 'SIPR'],
    workflowsByStage: ['ISO/PM', 'ISSM', 'AO'],
    authorizationStatus: ['Not Authorized', 'Valid', 'Expired'],
    expiringAuthorizations: ['0-60', '61-90', '91-120', '121-150', '151-180'],
    systemsByOverallRisk: ['Unassigned', 'Very Low', 'Low', 'Moderate', 'High', 'Very High'],
    controlCompliance: ['Compliant', 'Non-Compliant', 'Not Applicable', 'Unassessed'],
    expiredPoams: ['1-89', '>=90'],
    expiringPoams: ['0-30', '31-60', '61-90']
  };
  var VULN_LEVELS = ['Low', 'Moderate', 'High', 'Very High'];
  var CTO_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
  var ENT_KEYS = ['totalSystems', 'vulnerabilityTrend', 'overduePoamLeaderboard'].concat(Object.keys(ENT_BUCKETS));
  var CTO_KEYS = ['slaTargetPercent', 'status', 'completedOnTime', 'monthly', 'lateTasks'];

  var known = function (v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0; };
  var isDate = function (v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v; };
  var isMonth = function (v) { return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v); };
  function fail(m) { throw Error(m); }
  function onlyKeys(obj, allowed, where) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) fail(where + ' must be an object');
    Object.keys(obj).forEach(function (k) { if (allowed.indexOf(k) < 0) fail('Unsupported field "' + k + '" in ' + where); });
  }
  function count(v, where) { if (v !== null && !known(v)) fail(where + ' must be a nonnegative number or null'); }

  function validateEnterprise(e) {
    if (e === undefined) return;
    onlyKeys(e, ENT_KEYS, 'enterprise');
    count(e.totalSystems, 'enterprise.totalSystems');
    Object.keys(ENT_BUCKETS).forEach(function (k) {
      if (e[k] === undefined) return;
      onlyKeys(e[k], ENT_BUCKETS[k], 'enterprise.' + k);
      Object.keys(e[k]).forEach(function (b) { count(e[k][b], 'enterprise.' + k + '.' + b); });
    });
    if (e.vulnerabilityTrend !== undefined) {
      if (!Array.isArray(e.vulnerabilityTrend)) fail('vulnerabilityTrend must be a list');
      var seen = {};
      e.vulnerabilityTrend.forEach(function (r) {
        onlyKeys(r, ['month'].concat(VULN_LEVELS), 'vulnerabilityTrend entry');
        if (!isMonth(r.month) || seen[r.month]) fail('vulnerabilityTrend months must be unique YYYY-MM');
        seen[r.month] = 1;
        VULN_LEVELS.forEach(function (l) { count(r[l] === undefined ? null : r[l], 'vulnerabilityTrend ' + r.month + ' ' + l); });
      });
    }
    if (e.overduePoamLeaderboard !== undefined) {
      if (!Array.isArray(e.overduePoamLeaderboard)) fail('overduePoamLeaderboard must be a list');
      var names = {};
      e.overduePoamLeaderboard.forEach(function (r) {
        onlyKeys(r, ['system', 'overdue'], 'overduePoamLeaderboard entry');
        if (!r.system || typeof r.system !== 'string' || names[r.system]) fail('Leaderboard systems need unique names');
        names[r.system] = 1;
        if (!known(r.overdue)) fail('Leaderboard overdue counts must be numbers');
      });
    }
  }

  function validateCto(c) {
    if (c === undefined) return;
    onlyKeys(c, CTO_KEYS, 'cyberTaskOrders');
    count(c.slaTargetPercent === undefined ? null : c.slaTargetPercent, 'slaTargetPercent');
    if (known(c.slaTargetPercent) && c.slaTargetPercent > 100) fail('slaTargetPercent cannot exceed 100');
    if (c.status !== undefined) {
      onlyKeys(c.status, ['open', 'late', 'completed'], 'cyberTaskOrders.status');
      Object.keys(c.status).forEach(function (k) { count(c.status[k], 'cyberTaskOrders.status.' + k); });
    }
    count(c.completedOnTime === undefined ? null : c.completedOnTime, 'completedOnTime');
    if (known(c.completedOnTime) && c.status && known(c.status.completed) && c.completedOnTime > c.status.completed) fail('completedOnTime cannot exceed status.completed');
    if (c.monthly !== undefined) {
      if (!Array.isArray(c.monthly)) fail('cyberTaskOrders.monthly must be a list');
      var seen = {};
      c.monthly.forEach(function (r) {
        onlyKeys(r, ['month', 'open', 'late', 'completed', 'assigned'], 'cyberTaskOrders.monthly entry');
        if (!isMonth(r.month) || seen[r.month]) fail('CTO months must be unique YYYY-MM');
        seen[r.month] = 1;
        ['open', 'late', 'completed', 'assigned'].forEach(function (k) { count(r[k] === undefined ? null : r[k], 'CTO ' + r.month + ' ' + k); });
      });
    }
    if (c.lateTasks !== undefined) {
      if (!Array.isArray(c.lateTasks)) fail('cyberTaskOrders.lateTasks must be a list');
      var ids = {};
      c.lateTasks.forEach(function (t) {
        onlyKeys(t, ['id', 'title', 'severity', 'dueDate'], 'lateTasks entry');
        if (!t.id || typeof t.id !== 'string' || ids[t.id]) fail('Late tasks need unique ids');
        ids[t.id] = 1;
        if (t.title !== undefined && typeof t.title !== 'string') fail('Late task title must be text');
        if (CTO_SEVERITIES.indexOf(t.severity) < 0) fail('Late task severity must be one of ' + CTO_SEVERITIES.join(', '));
        if (!isDate(t.dueDate)) fail('Late task dueDate must be YYYY-MM-DD');
      });
    }
  }

  function validate(data) {
    if (!data || !Array.isArray(data.snapshots)) fail('Invalid snapshot format');
    data.snapshots.forEach(function (s) { validateEnterprise(s.enterprise); validateCto(s.cyberTaskOrders); });
    return data;
  }

  /* ---------- calculations ---------- */
  function sum(obj) {
    if (!obj) return null;
    var vals = Object.keys(obj).map(function (k) { return obj[k]; });
    if (!vals.length || vals.some(function (v) { return !known(v); })) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0);
  }
  var pct = function (n, d) { return known(n) && known(d) && d > 0 ? 100 * n / d : null; };
  var daysBetween = function (a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); };

  /* Cyber Task Order KPIs / KRIs.
     status.open = active tasks NOT yet past due; status.late = active tasks past due.
     Total active = open + late. */
  function ctoKpis(c, reportingDate) {
    c = c || {};
    var st = c.status || {};
    var active = known(st.open) && known(st.late) ? st.open + st.late : null;
    var late = (c.lateTasks || []).map(function (t) { return Object.assign({}, t, { daysOverdue: daysBetween(t.dueDate, reportingDate) }); });
    var aging = late.length ? late.reduce(function (n, t) { return n + Math.max(0, t.daysOverdue); }, 0) / late.length : null;
    var months = (c.monthly || []).slice().sort(function (a, b) { return a.month.localeCompare(b.month); });
    var last = months[months.length - 1];
    var velocity = last && known(last.completed) && known(last.assigned)
      ? { month: last.month, completed: last.completed, assigned: last.assigned, net: last.completed - last.assigned, ratio: last.assigned ? last.completed / last.assigned : null }
      : null;
    return {
      slaRate: pct(c.completedOnTime, st.completed),
      slaTarget: known(c.slaTargetPercent) ? c.slaTargetPercent : null,
      overdueRatio: pct(st.late, active),
      active: active,
      backlogAgingDays: aging,
      lateListComplete: known(st.late) ? late.length === st.late : false,
      lateCritical: late.filter(function (t) { return t.severity === 'Critical'; }).length,
      lateTasks: late,
      velocity: velocity,
      months: months
    };
  }

  var api = { validate: validate, validateEnterprise: validateEnterprise, validateCto: validateCto, ctoKpis: ctoKpis, sum: sum, pct: pct };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------- rendering helpers ---------- */
  var esc = function (v) { return String(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (v) { return known(v) ? Math.round(v).toLocaleString() : 'N/A'; };
  var fmtPct = function (v) { return v === null || v === undefined ? 'N/A' : v.toFixed(1) + '%'; };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var monthLabel = function (m) { var p = m.split('-'); return MON[+p[1] - 1] + ' ' + p[0].slice(2); };
  var C = { ok: '#2E7D32', info: '#1D5B8E', crit: '#B3261E', warn: '#B45309', gold: '#C9A227', olive: '#4B5320', mute: '#9AA39D' };
  /* Ordinal severity = one hue (red), light → dark. */
  var SEV4 = ['#E3A29C', '#D06A60', '#B3261E', '#6F1510'];
  var SEV5 = ['#EDC2BD', '#E3A29C', '#D06A60', '#B3261E', '#6F1510'];

  function fill(sel, html) { document.querySelectorAll(sel).forEach(function (el) { el.innerHTML = html; }); }
  function na(note) { return '<p class="dim ent-na">' + esc(note || 'Not available — no data reported for this period.') + '</p>'; }

  function metric(label, value, cls, delta) {
    return '<div class="metric ' + (cls || '') + '"><div class="n">' + value + '</div><div class="l">' + esc(label) + '</div>' + (delta ? '<div class="delta">' + delta + '</div>' : '') + '</div>';
  }

  /* SVG donut with 2px gaps between segments + legend with value and share. */
  function donut(rows, centerLabel) {
    var total = rows.reduce(function (n, r) { return n + (known(r.v) ? r.v : 0); }, 0);
    if (!rows.every(function (r) { return known(r.v); }) || !total) return null;
    var R = 56, CIRC = 2 * Math.PI * R, off = 0, gap = rows.filter(function (r) { return r.v > 0; }).length > 1 ? 2 : 0;
    var arcs = rows.map(function (r) {
      var len = CIRC * r.v / total, seg = '';
      if (r.v > 0) seg = '<circle r="' + R + '" cx="75" cy="75" fill="none" stroke="' + r.c + '" stroke-width="22" stroke-dasharray="' + Math.max(0, len - gap) + ' ' + (CIRC - Math.max(0, len - gap)) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 75 75)"><title>' + esc(r.k + ': ' + fmt(r.v) + ' (' + fmtPct(100 * r.v / total) + ')') + '</title></circle>';
      off += len; return seg;
    }).join('');
    return '<div class="donut-wrap"><svg class="ent-donut" viewBox="0 0 150 150" role="img" aria-label="' + esc(rows.map(function (r) { return r.k + ' ' + r.v; }).join(', ')) + '">' + arcs +
      '<text x="75" y="74" text-anchor="middle" class="ent-donut-n">' + fmt(total) + '</text><text x="75" y="92" text-anchor="middle" class="ent-donut-l">' + esc(centerLabel) + '</text></svg>' +
      '<ul class="legend" style="flex:1;min-width:180px">' + rows.map(function (r) {
        return '<li><span class="sw" style="background:' + r.c + '"></span>' + esc(r.k) + '<span class="lv">' + fmt(r.v) + ' · ' + fmtPct(100 * r.v / total) + '</span></li>';
      }).join('') + '</ul></div>';
  }

  /* Horizontal bars using the site's .bar-row component. */
  function bars(rows) {
    if (!rows.every(function (r) { return known(r.v); })) return null;
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    return '<div class="ent-bars">' + rows.map(function (r) {
      return '<div class="bar-row" title="' + esc(r.k + ': ' + fmt(r.v)) + '"><span>' + esc(r.k) + '</span><div class="bar-track"><div class="bar-fill" style="width:' + (100 * r.v / max).toFixed(1) + '%;background:' + r.c + '"></div></div><span class="v">' + fmt(r.v) + '</span></div>';
    }).join('') + '</div>';
  }

  /* Column chart: stacked (default) or grouped. series = [{k, c}], rows = [{label, values:{k:v}}]. */
  function columns(rows, series, opts) {
    opts = opts || {};
    var W = 640, H = 240, L = 44, B = 28, T = 10, plotH = H - B - T, plotW = W - L - 8;
    var totals = rows.map(function (r) { return opts.grouped ? Math.max.apply(null, series.map(function (s) { return r.values[s.k] || 0; })) : series.reduce(function (n, s) { return n + (r.values[s.k] || 0); }, 0); });
    var max = Math.max.apply(null, totals.concat([1]));
    var step = Math.pow(10, Math.floor(Math.log10(max))), nice = Math.ceil(max / step) * step;
    var slot = plotW / rows.length, bw = Math.min(opts.grouped ? 16 : 30, slot * 0.6 / (opts.grouped ? series.length : 1));
    var y = function (v) { return T + plotH - plotH * v / nice; };
    var grid = [0, 0.5, 1].map(function (f) { var v = nice * f; return '<line x1="' + L + '" x2="' + (W - 8) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="ent-grid"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="ent-axis">' + fmt(v) + '</text>'; }).join('');
    var marks = rows.map(function (r, i) {
      var cx = L + slot * i + slot / 2, acc = 0, out = '';
      series.forEach(function (s, j) {
        var v = r.values[s.k];
        if (!known(v) || v === 0) return;
        var x, top, h;
        if (opts.grouped) { x = cx - (bw * series.length + 2 * (series.length - 1)) / 2 + j * (bw + 2); top = y(v); h = y(0) - top; }
        else { x = cx - bw / 2; top = y(acc + v); h = y(acc) - top - (acc > 0 ? 2 : 0); acc += v; }
        out += '<rect x="' + x.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" fill="' + s.c + '" rx="1.5"><title>' + esc(r.label + ' — ' + s.k + ': ' + fmt(v)) + '</title></rect>';
      });
      return out + '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle" class="ent-axis">' + esc(r.label) + '</text>';
    }).join('');
    var legend = '<ul class="legend ent-legend-row">' + series.map(function (s) { return '<li><span class="sw" style="background:' + s.c + '"></span>' + esc(s.k) + '</li>'; }).join('') + '</ul>';
    return legend + '<svg class="ent-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'Chart') + '; exact values in the table below">' + grid + marks + '</svg>';
  }

  function dataTable(headers, rows, summary) {
    return '<details class="ent-details"><summary>' + esc(summary || 'View data table') + '</summary><div class="table-wrap"><table><thead><tr>' +
      headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></details>';
  }

  function panel(title, sub, body, cls) {
    return '<div class="card ent-panel ' + (cls || '') + '"><h3>' + esc(title) + '</h3>' + (sub ? '<p class="ent-sub">' + sub + '</p>' : '') + body + '</div>';
  }
  function rowsOf(obj, keys, colors) { return keys.map(function (k, i) { return { k: k, v: obj ? obj[k] : null, c: colors[i] }; }); }

  /* ---------- enterprise views ---------- */
  function heroBand(e) {
    var ex = sum(e.expiredPoams);
    var stat = function (n, l) { return '<div class="hero-stat"><div class="n">' + n + '</div><div class="l">' + esc(l) + '</div></div>'; };
    return stat(fmt(e.totalSystems), 'Total systems') +
      stat(fmt(e.workflowsInQueue && e.workflowsInQueue.NIPR), 'NIPR workflows in queue') +
      stat(fmt(e.workflowsInQueue && e.workflowsInQueue.SIPR), 'SIPR workflows in queue') +
      stat(fmt(ex), 'Expired POA&Ms');
  }

  function authRows(e) { return rowsOf(e.authorizationStatus, ENT_BUCKETS.authorizationStatus, [C.warn, C.ok, C.crit]); }

  function expiredPoamBlock(e) {
    var p = e.expiredPoams || {};
    return '<div class="grid g2 ent-tight">' +
      metric('Expired 1–89 days', fmt(p['1-89']), 'm-warn') +
      metric('Expired ≥ 90 days', fmt(p['>=90']), 'm-crit') + '</div>' +
      '<p class="ent-sub" style="margin-top:12px">POA&amp;M items past their scheduled completion date, by days past due.</p>';
  }

  function highlights(e) {
    var auth = donut(authRows(e), 'systems');
    return '<div class="grid g4">' +
      metric('Total systems', fmt(e.totalSystems)) +
      metric('NIPR workflows in queue', fmt(e.workflowsInQueue && e.workflowsInQueue.NIPR), 'm-info') +
      metric('SIPR workflows in queue', fmt(e.workflowsInQueue && e.workflowsInQueue.SIPR), 'm-info') +
      metric('Expired POA&Ms', fmt(sum(e.expiredPoams)), 'm-crit') + '</div>' +
      '<div class="grid g2" style="margin-top:18px">' +
      panel('Authorization Status', 'Not Authorized · Valid · Expired', auth || na()) +
      panel('Expired POA&Ms', '', expiredPoamBlock(e)) + '</div>' +
      '<p style="margin-top:16px"><a class="btn btn-gold" href="rmf-operations.html#enterprise-metrics">View full enterprise metrics →</a></p>';
  }

  function dashboard(e) {
    var stageRows = rowsOf(e.workflowsByStage, ENT_BUCKETS.workflowsByStage, [C.olive, C.info, C.gold]);
    var expRows = rowsOf(e.expiringAuthorizations, ENT_BUCKETS.expiringAuthorizations, [C.crit, C.warn, C.gold, C.info, C.olive]);
    var riskRows = rowsOf(e.systemsByOverallRisk, ENT_BUCKETS.systemsByOverallRisk, [C.mute].concat(SEV5));
    var compRows = rowsOf(e.controlCompliance, ENT_BUCKETS.controlCompliance, [C.ok, C.crit, C.mute, C.gold]);
    var cc = e.controlCompliance || {};
    var compliancePct = pct(cc.Compliant, known(cc.Compliant) && known(cc['Non-Compliant']) ? cc.Compliant + cc['Non-Compliant'] : null);
    var expPoamRows = rowsOf(e.expiringPoams, ENT_BUCKETS.expiringPoams, [C.crit, C.warn, C.gold]);
    var auth = authRows(e);
    var authTotal = sum(e.authorizationStatus);

    /* Vulnerability 12-month trend */
    var trend = (e.vulnerabilityTrend || []).slice().sort(function (a, b) { return a.month.localeCompare(b.month); }).slice(-12);
    var vulnSeries = VULN_LEVELS.map(function (k, i) { return { k: k, c: SEV4[i] }; });
    var vulnHtml = trend.length
      ? columns(trend.map(function (r) { return { label: monthLabel(r.month), values: r }; }), vulnSeries, { label: 'Open vulnerabilities by severity, last 12 months' }) +
        dataTable(['Month'].concat(VULN_LEVELS).concat(['Total']), trend.map(function (r) { var t = VULN_LEVELS.every(function (l) { return known(r[l]); }) ? VULN_LEVELS.reduce(function (n, l) { return n + r[l]; }, 0) : null; return [monthLabel(r.month)].concat(VULN_LEVELS.map(function (l) { return fmt(r[l]); })).concat([fmt(t)]); }))
      : na('No monthly vulnerability counts reported yet.');
    var vulnDelta = '';
    if (trend.length > 1) {
      var tot = function (r) { return VULN_LEVELS.every(function (l) { return known(r[l]); }) ? VULN_LEVELS.reduce(function (n, l) { return n + r[l]; }, 0) : null; };
      var a = tot(trend[0]), b = tot(trend[trend.length - 1]);
      if (known(a) && known(b)) vulnDelta = '<span class="badge ' + (b <= a ? 'b-ok' : 'b-crit') + '">' + (b <= a ? '▼ ' : '▲ ') + fmt(Math.abs(b - a)) + ' since ' + esc(monthLabel(trend[0].month)) + '</span>';
    }

    /* Leaderboard */
    var lb = (e.overduePoamLeaderboard || []).slice().sort(function (a, b) { return b.overdue - a.overdue || a.system.localeCompare(b.system); }).slice(0, 10);
    var lbMax = Math.max.apply(null, lb.map(function (r) { return r.overdue; }).concat([1]));
    var lbHtml = lb.length
      ? '<ol class="ent-leader">' + lb.map(function (r, i) {
          return '<li><span class="rk">' + (i + 1) + '</span><span class="nm">' + esc(r.system) + '</span><span class="bar-track"><span class="bar-fill" style="display:block;width:' + (100 * r.overdue / lbMax).toFixed(1) + '%;background:' + (i < 3 ? C.crit : C.warn) + '"></span></span><span class="v">' + fmt(r.overdue) + '</span></li>';
        }).join('') + '</ol>'
      : na('No systems reported.');

    return '' +
      /* Row 1 — headline numbers */
      '<div class="grid g4">' +
        metric('Total systems', fmt(e.totalSystems)) +
        metric('NIPR workflows in queue', fmt(e.workflowsInQueue && e.workflowsInQueue.NIPR), 'm-info') +
        metric('SIPR workflows in queue', fmt(e.workflowsInQueue && e.workflowsInQueue.SIPR), 'm-info') +
        metric('Valid authorizations', fmt(e.authorizationStatus && e.authorizationStatus.Valid), 'm-ok', authTotal ? fmtPct(pct(e.authorizationStatus.Valid, authTotal)) + ' of systems' : '') +
      '</div>' +
      /* Row 2 — authorization */
      '<h3 class="ent-group">Authorization</h3><div class="grid g2">' +
        panel('Authorization Status', 'Not Authorized · Valid · Expired', donut(auth, 'systems') || na()) +
        panel('Expiring Authorizations', 'Valid ATOs by days until expiration', bars(expRows) || na()) +
      '</div>' +
      /* Row 3 — workflow + risk */
      '<h3 class="ent-group">Workflow &amp; Risk</h3><div class="grid g2">' +
        panel('Workflows by Stage', 'Where packages are waiting: ISO/PM → ISSM → AO', bars(stageRows) || na()) +
        panel('Systems by Overall Risk', 'Overall risk rating per system', bars(riskRows) || na()) +
      '</div>' +
      /* Row 4 — controls + vulns */
      '<h3 class="ent-group">Controls &amp; Vulnerabilities</h3><div class="grid g2 ent-uneven">' +
        panel('Control Compliance', compliancePct === null ? 'Control assessment results across all systems' : '<b>' + fmtPct(compliancePct) + '</b> compliant of assessed, applicable controls', donut(compRows, 'controls') || na()) +
        panel('Vulnerability Trend', '12-month trend of open vulnerabilities by severity ' + vulnDelta, vulnHtml) +
      '</div>' +
      /* Row 5 — POA&M */
      '<h3 class="ent-group">POA&amp;M Health</h3><div class="grid g3">' +
        panel('Expired POA&Ms', '', expiredPoamBlock(e), 'card-crit') +
        panel('Expiring POA&Ms', 'Due in the next 90 days', bars(expPoamRows) || na()) +
        panel('Leaderboard: Top Systems — Overdue POA&Ms', 'Ranked by overdue items; top 10 shown', lbHtml) +
      '</div>';
  }

  /* ---------- CTO dashboard ---------- */
  var CTO_COLORS = { Completed: C.ok, Open: C.info, Late: C.crit };
  var SEV_BADGE = { Critical: 'b-crit', High: 'b-warn', Medium: 'b-gold', Low: 'b-mute' };

  function ctoDashboard(c, reportingDate) {
    var k = ctoKpis(c, reportingDate), st = c.status || {};
    var slaCls = k.slaRate === null ? '' : (k.slaTarget !== null && k.slaRate < k.slaTarget ? 'm-crit' : 'm-ok');
    var ratioCls = k.overdueRatio === null ? '' : k.overdueRatio >= 25 ? 'm-crit' : k.overdueRatio >= 10 ? 'm-warn' : 'm-ok';

    var callouts = '<div class="grid g3 ent-callouts">' +
      (known(st.late) || k.lateTasks.length
        ? metric('Late critical tasks', fmt(k.lateCritical), k.lateCritical ? 'm-crit' : 'm-ok', k.lateCritical ? 'Immediate leadership attention' : 'No critical tasks late')
        : metric('Late critical tasks', 'N/A', '', 'Count of late tasks rated Critical')) +
      metric('SLA compliance rate', fmtPct(k.slaRate), slaCls, k.slaTarget !== null ? 'Target ' + k.slaTarget + '% · completed on time ÷ total completed' : 'Completed on time ÷ total completed') +
      metric('Overdue risk ratio', fmtPct(k.overdueRatio), ratioCls, known(st.late) && known(k.active) ? fmt(st.late) + ' late of ' + fmt(k.active) + ' active tasks' : 'Late ÷ total active') +
      '</div>';

    var v = k.velocity;
    var kpiStrip = '<div class="grid g2" style="margin-top:18px">' +
      metric('Backlog aging', k.backlogAgingDays === null ? 'N/A' : k.backlogAgingDays.toFixed(1) + '<span style="font-size:18px"> days</span>', k.backlogAgingDays === null ? '' : k.backlogAgingDays > 30 ? 'm-crit' : k.backlogAgingDays > 7 ? 'm-warn' : 'm-ok',
        'Average days past deadline for late tasks' + (k.lateTasks.length && !k.lateListComplete ? ' · based on ' + k.lateTasks.length + ' listed' : '')) +
      metric('Completion velocity', v ? fmt(v.completed) + '<span style="font-size:18px"> / ' + fmt(v.assigned) + '</span>' : 'N/A', v ? (v.net >= 0 ? 'm-ok' : 'm-warn') : '',
        v ? 'Completed vs. new assigned · ' + esc(monthLabel(v.month)) + ' · ' + (v.net >= 0 ? 'keeping pace (+' + v.net + ')' : 'backlog growing (' + v.net + ')') : 'Completed vs. new tasks assigned per month') +
      '</div>';

    var snap = donut([{ k: 'Completed', v: st.completed, c: CTO_COLORS.Completed }, { k: 'Open', v: st.open, c: CTO_COLORS.Open }, { k: 'Late', v: st.late, c: CTO_COLORS.Late }], 'tasks');
    var series = [{ k: 'Completed', c: CTO_COLORS.Completed }, { k: 'Open', c: CTO_COLORS.Open }, { k: 'Late', c: CTO_COLORS.Late }];
    var m = k.months.slice(-12);
    var trend = m.length
      ? columns(m.map(function (r) { return { label: monthLabel(r.month), values: { Completed: r.completed, Open: r.open, Late: r.late } }; }), series, { label: 'CTO status by month' }) +
        dataTable(['Month', 'Completed', 'Open', 'Late', 'New assigned'], m.map(function (r) { return [monthLabel(r.month), fmt(r.completed), fmt(r.open), fmt(r.late), fmt(r.assigned)]; }))
      : na('No monthly CTO history reported yet.');
    var vel = m.length
      ? columns(m.map(function (r) { return { label: monthLabel(r.month), values: { Completed: r.completed, 'New assigned': r.assigned } }; }), [{ k: 'Completed', c: C.ok }, { k: 'New assigned', c: C.info }], { grouped: true, label: 'Tasks completed versus new tasks assigned by month' })
      : na('No monthly CTO history reported yet.');

    var chips = '<div class="chip-row" data-cto-filter><button class="chip active" data-sev="all">All</button>' + CTO_SEVERITIES.map(function (s) { return '<button class="chip" data-sev="' + s + '">' + s + '</button>'; }).join('') + '</div>';
    var aging = k.lateTasks.length
      ? chips + '<div class="table-wrap"><table class="ent-aging"><thead><tr>' +
          '<th class="sortable" data-key="id">Task order</th><th class="sortable" data-key="title">Title</th><th class="sortable" data-key="sev">Severity</th><th class="sortable" data-key="due">Due date</th><th class="sortable" data-key="days" data-dir="desc">Days overdue</th>' +
          '</tr></thead><tbody></tbody></table></div>' +
          (k.lateListComplete ? '' : '<p class="ent-sub" style="margin-top:8px">List contains ' + k.lateTasks.length + ' of ' + fmt(st.late) + ' late tasks.</p>')
      : na(known(st.late) && st.late === 0 ? 'No late task orders. Keep it that way.' : 'No late task orders listed.');

    return callouts + kpiStrip +
      '<div class="grid g2 ent-uneven" style="margin-top:18px">' +
        panel('The Snapshot', 'Current distribution of Open, Late and Completed task orders', snap || na()) +
        panel('The Trend', 'Status month over month — is the red “Late” band growing?', trend) +
      '</div>' +
      '<div class="grid g2" style="margin-top:18px">' +
        panel('Completion Velocity', 'Completed vs. new tasks assigned per month. Assignment outpacing completion compounds Open and Late.', vel) +
        panel('The Aging Table', 'Late task orders — filter by severity, sort by any column. Oldest, highest-risk items first.', aging, 'card-crit') +
      '</div>';
  }

  function wireAgingTable(scope, tasks) {
    var tbl = scope.querySelector('table.ent-aging'); if (!tbl) return;
    var sevRank = function (s) { return CTO_SEVERITIES.indexOf(s); };
    var state = { key: 'days', dir: 'desc', sev: 'all' };
    function render() {
      var rows = tasks.filter(function (t) { return state.sev === 'all' || t.severity === state.sev; }).slice().sort(function (a, b) {
        var r;
        if (state.key === 'days') r = a.daysOverdue - b.daysOverdue || sevRank(b.severity) - sevRank(a.severity);
        else if (state.key === 'sev') r = sevRank(b.severity) - sevRank(a.severity) || a.daysOverdue - b.daysOverdue;
        else if (state.key === 'due') r = a.dueDate.localeCompare(b.dueDate);
        else r = String(a[state.key] || '').localeCompare(String(b[state.key] || ''));
        return state.dir === 'asc' ? r : -r;
      });
      tbl.querySelector('tbody').innerHTML = rows.length ? rows.map(function (t) {
        var d = Math.max(0, t.daysOverdue);
        return '<tr><td class="mono">' + esc(t.id) + '</td><td>' + esc(t.title || '') + '</td><td><span class="badge ' + SEV_BADGE[t.severity] + '">' + esc(t.severity) + '</span></td><td class="mono">' + esc(t.dueDate) + '</td><td class="mono"><b style="color:' + (d > 30 ? C.crit : d > 7 ? C.warn : 'inherit') + '">' + d + '</b></td></tr>';
      }).join('') : '<tr><td colspan="5">No late tasks at this severity.</td></tr>';
      tbl.querySelectorAll('th').forEach(function (th) { th.dataset.dir = th.dataset.key === state.key ? state.dir : ''; th.setAttribute('aria-sort', th.dataset.key === state.key ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none'); });
    }
    tbl.querySelectorAll('th[data-key]').forEach(function (th) {
      th.tabIndex = 0;
      var go = function () { state.dir = state.key === th.dataset.key && state.dir === 'desc' ? 'asc' : 'desc'; state.key = th.dataset.key; render(); };
      th.addEventListener('click', go);
      th.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
    });
    scope.querySelectorAll('[data-cto-filter] .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        scope.querySelectorAll('[data-cto-filter] .chip').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); state.sev = b.dataset.sev; render();
      });
    });
    render();
  }

  async function hydrate() {
    var targets = '[data-ent-hero],[data-ent-highlights],[data-ent-dashboard],[data-cto-dashboard]';
    if (!document.querySelector(targets)) return;
    var demo = /[?&]demo=1\b/.test(location.search);
    var src = demo ? 'data/manual/metrics.sample.json' : 'data/manual/metrics.json';
    try {
      var res = await fetch(src, { cache: 'no-store' });
      if (!res.ok) throw Error('Metrics unavailable');
      var data = validate(await res.json());
      var snaps = data.snapshots.slice().sort(function (a, b) { return a.reportingDate.localeCompare(b.reportingDate); });
      var s = snaps[snaps.length - 1];
      if (!s) return;
      var e = s.enterprise || {}, c = s.cyberTaskOrders || {};
      fill('[data-ent-date]', (demo || data.sampleData === true ? '<span class="badge b-warn">Illustrative sample data — not real</span> ' : '') + 'As of ' + esc(s.reportingDate));
      fill('[data-ent-hero]', heroBand(e));
      fill('[data-ent-highlights]', highlights(e));
      fill('[data-ent-dashboard]', dashboard(e));
      document.querySelectorAll('[data-cto-dashboard]').forEach(function (el) {
        el.innerHTML = ctoDashboard(c, s.reportingDate);
        wireAgingTable(el, ctoKpis(c, s.reportingDate).lateTasks);
      });
      if (demo) document.querySelectorAll('a[href*="#enterprise-metrics"]').forEach(function (a) { if (a.getAttribute('href').indexOf('demo=1') < 0) a.setAttribute('href', a.getAttribute('href').replace('#', '?demo=1#')); });
    } catch (err) {
      console.error(err);
      fill('[data-ent-date]', 'Reporting data unavailable — check the metrics file.');
    }
  }
  document.addEventListener('DOMContentLoaded', hydrate);
})(typeof window === 'undefined' ? globalThis : window);
