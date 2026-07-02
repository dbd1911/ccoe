/* ============================================================
   CCoE Operational Hub — data hydration layer
   Renders content from data/manual/*.json (human-edited) and
   data/auto/*.json (refreshed by GitHub Actions) into the same
   markup the pages already use. If a data file is missing or
   fetch fails (e.g. opening the HTML directly from disk), the
   static HTML already in the page remains as the fallback —
   nothing breaks and the design never changes.
   ============================================================ */

(function () {
  'use strict';

  function getJSON(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' → HTTP ' + r.status);
      return r.json();
    });
  }

  // Escape untrusted (external feed) strings. Manual repo-owned JSON may
  // intentionally contain simple markup (<b>…</b>) and is rendered as-is.
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(iso) { // 2026-06-05 → 05 JUN 2026
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return esc(iso || '');
    var M = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    var p = iso.slice(0, 10).split('-');
    return p[2] + ' ' + M[+p[1] - 1] + ' ' + p[0];
  }

  var BADGE = { crit: 'b-crit', warn: 'b-warn', info: 'b-info', ok: 'b-ok', mute: 'b-mute', gold: 'b-gold', cui: 'b-cui' };
  var SEV_BADGE = { 'KEV': 'b-crit', 'CAT I': 'b-crit', 'CAT II': 'b-warn', 'Medium': 'b-gold', 'Low': 'b-mute' };
  var STATUS = {
    overdue: { dot: 'd-crit', label: 'Overdue' },
    atrisk:  { dot: 'd-warn', label: 'At Risk' },
    ontrack: { dot: 'd-ok',   label: 'On Track' },
    review:  { dot: 'd-info', label: 'Closure Review' }
  };

  /* ---------------- Home page: hero stats / metrics / donut / bars ------ */
  function hydrateHome() {
    var heroWrap = document.querySelector('.hero-stats-inner');
    if (!heroWrap) return; // not on this page

    getJSON('data/manual/site-metrics.json').then(function (m) {
      // Hero counters
      if (m.hero_stats && heroWrap.children.length === m.hero_stats.length) {
        m.hero_stats.forEach(function (s, i) {
          var cell = heroWrap.children[i];
          var n = cell.querySelector('.n'), l = cell.querySelector('.l');
          if (n) {
            n.dataset.count = s.value;
            // The page's count-up animation runs ~1.4s; settle on the JSON
            // value after it finishes so the two never fight.
            setTimeout(function () { n.textContent = s.value; }, 1600);
          }
          if (l) l.textContent = s.label;
        });
      }
      // Metrics snapshot
      var snap = document.getElementById('metricsSnapshot');
      if (snap && m.metrics_snapshot) {
        snap.innerHTML = m.metrics_snapshot.map(function (x) {
          var deltaColor = x.delta_tone ? ' style="color:var(--' + esc(x.delta_tone) + ')"' : '';
          return '<div class="metric m-' + esc(x.tone) + '"><div class="n">' + esc(x.value) +
                 '</div><div class="l">' + esc(x.label) + '</div><div class="delta"' + deltaColor + '>' +
                 esc(x.delta) + '</div></div>';
        }).join('');
      }
      // ATO donut
      var donut = document.getElementById('atoDonut');
      if (donut && m.ato_donut) {
        var segs = m.ato_donut.segments, total = segs.reduce(function (s, x) { return s + x.value; }, 0), acc = 0;
        var stops = segs.map(function (x) {
          var a = acc / total * 360; acc += x.value; var b = acc / total * 360;
          return x.color + ' ' + a + 'deg ' + b + 'deg';
        });
        donut.style.background = 'conic-gradient(' + stops.join(',') + ')';
        donut.setAttribute('aria-label', 'Authorization mix: ' +
          segs.map(function (x) { return x.value + ' ' + x.label; }).join(', '));
        var c = donut.querySelector('.donut-center');
        if (c) c.textContent = m.ato_donut.center;
        var legend = donut.parentElement.querySelector('.legend');
        if (legend) legend.innerHTML = segs.map(function (x) {
          return '<li><span class="sw" style="background:' + x.color + '"></span>' + esc(x.label) +
                 ' <span class="lv">' + x.value + '</span></li>';
        }).join('');
      }
      // POA&M severity bars
      var bars = document.getElementById('poamBars');
      if (bars && m.poam_severity_bars) {
        var F = { crit: 'f-crit', warn: 'f-warn', gold: 'f-gold', ok: 'f-ok' };
        bars.innerHTML = m.poam_severity_bars.map(function (b) {
          return '<div class="bar-row"><span>' + esc(b.label) + '</span><div class="bar-track">' +
                 '<div class="bar-fill ' + (F[b.tone] || 'f-ok') + '" style="width:' + esc(b.width) +
                 '" data-w="' + esc(b.width) + '"></div></div><span class="v">' + esc(b.value) + '</span></div>';
        }).join('');
      }
    }).catch(function (e) { console.warn('[live-data] site-metrics:', e.message); });

    // Ticker — manual items plus (optionally) the newest CISA KEV entry.
    var ticker = document.getElementById('ticker');
    if (ticker) {
      getJSON('data/manual/ticker.json').then(function (t) {
        var render = function (items) {
          ticker.innerHTML = items.map(function (i) {
            return '<span><b>' + esc(i.tag) + ':</b> ' + i.text + '</span>';
          }).join('');
          ticker.innerHTML += ticker.innerHTML; // seamless loop
        };
        if (t.auto_kev_item) {
          getJSON('data/auto/kev.json').then(function (k) {
            var items = t.items.slice();
            if (k.recent && k.recent.length) {
              var v = k.recent[0];
              items.unshift({ tag: 'KEV', text: esc(v.cveID) + ' (' + esc(v.vendorProject) + ' ' +
                esc(v.product) + ') added to CISA KEV ' + fmtDate(v.dateAdded) +
                ' — remediation due ' + fmtDate(v.dueDate) + '. See Threat Intel.' });
            }
            render(items);
          }).catch(function () { render(t.items); });
        } else {
          render(t.items);
        }
      }).catch(function (e) { console.warn('[live-data] ticker:', e.message); });
    }
  }

  /* ---------------- Vulnerability & POA&M page -------------------------- */
  function hydratePoam() {
    var tbody = document.querySelector('#poamTable tbody');
    if (!tbody) return;
    getJSON('data/manual/poam.json').then(function (d) {
      tbody.innerHTML = d.items.map(function (r) {
        var st = STATUS[r.status] || STATUS.ontrack;
        return '<tr data-cat="' + esc(r.status) + '">' +
          '<td class="mono">' + esc(r.id) + '</td>' +
          '<td>' + esc(r.system) + '</td>' +
          '<td>' + esc(r.summary) + '</td>' +
          '<td><span class="badge ' + (SEV_BADGE[r.severity] || 'b-mute') + '">' + esc(r.severity) + '</span></td>' +
          '<td class="mono" data-val="' + (+r.age || 0) + '">' + (+r.age || 0) + '</td>' +
          '<td class="mono">' + esc(r.due) + '</td>' +
          '<td><span class="dot ' + st.dot + '"></span>' + st.label + '</td></tr>';
      }).join('');
      var count = document.getElementById('poamCount');
      if (count) count.textContent = d.items.length + ' item' + (d.items.length === 1 ? '' : 's') + ' shown';
    }).catch(function (e) { console.warn('[live-data] poam:', e.message); });
  }

  /* ---------------- Threat Intel page ----------------------------------- */
  function hydrateThreatIntel() {
    var alertsGrid = document.getElementById('weekAlerts');
    if (alertsGrid) {
      getJSON('data/manual/threat-week.json').then(function (d) {
        var kicker = document.getElementById('weekKicker');
        if (kicker && d.kicker) kicker.textContent = d.kicker;
        var meta = document.getElementById('weekVersion');
        if (meta && d.week_label) meta.innerHTML = '<b>' + esc(d.week_label) + '</b>';
        var eff = document.getElementById('weekEffective');
        if (eff && d.effective) eff.innerHTML = '<b>' + esc(d.effective) + '</b>';

        alertsGrid.innerHTML = d.alerts.map(function (a) {
          return '<div class="card' + (a.card_tone ? ' card-' + esc(a.card_tone) : '') + ' reveal in">' +
            '<span class="badge ' + (BADGE[a.tone] || 'b-info') + '">' + esc(a.badge) + '</span>' +
            '<h3>' + esc(a.title) + '</h3>' +
            '<p><b>What:</b> ' + a.what + '</p>' +
            '<p><b>Mission impact:</b> ' + a.impact + '</p>' +
            '<p><b>What to do now:</b> ' + a.action + '</p></div>';
        }).join('');

        var kevBody = document.getElementById('kevMapBody');
        if (kevBody && d.kev_map) {
          kevBody.innerHTML = d.kev_map.map(function (r) {
            var due = fmtDate(r.due);
            return '<tr><td class="formula">' + esc(r.cve) + '</td>' +
              '<td data-val="' + esc(r.added.replace(/-/g, '')) + '">' + fmtDate(r.added) + '</td>' +
              '<td>' + esc(r.systems) + '</td>' +
              '<td data-val="' + esc(r.due.replace(/-/g, '')) + '">' + (r.due_bold ? '<b>' + due + '</b>' : due) + '</td>' +
              '<td><span class="badge ' + (BADGE[r.status_tone] || 'b-mute') + '">' + esc(r.status) + '</span></td></tr>';
          }).join('');
        }
      }).catch(function (e) { console.warn('[live-data] threat-week:', e.message); });
    }

    /* ------ Live external feeds (auto-updated by GitHub Actions) ------- */
    if (!document.getElementById('feedKev')) return;

    getJSON('data/auto/meta.json').then(function (m) {
      var el = document.getElementById('feedUpdated');
      if (el && m._updated) el.textContent = 'LAST AUTOMATIC REFRESH: ' + m._updated.replace('T', ' ').replace('Z', ' UTC');
    }).catch(function () {});

    getJSON('data/auto/kev.json').then(function (k) {
      var note = document.getElementById('feedKevNote');
      if (note) note.textContent = 'Catalog v' + (k.catalogVersion || '—') + ' · ' + (k.total || '—') +
        ' total entries · released ' + fmtDate((k.dateReleased || '').slice(0, 10));
      document.getElementById('feedKev').innerHTML = (k.recent || []).map(function (v) {
        return '<tr><td class="formula"><a href="https://nvd.nist.gov/vuln/detail/' + esc(v.cveID) + '" target="_blank" rel="noopener">' + esc(v.cveID) + '</a></td>' +
          '<td>' + esc(v.vendorProject) + ' ' + esc(v.product) + '</td>' +
          '<td>' + esc(v.vulnerabilityName) + '</td>' +
          '<td class="mono" data-val="' + esc((v.dateAdded || '').replace(/-/g, '')) + '">' + fmtDate(v.dateAdded) + '</td>' +
          '<td class="mono">' + fmtDate(v.dueDate) + '</td>' +
          '<td>' + (v.knownRansomwareCampaignUse === 'Known' ? '<span class="badge b-crit">Ransomware</span>' : '<span class="badge b-mute">—</span>') + '</td></tr>';
      }).join('');
    }).catch(function (e) { feedFail('feedKev', 6, e); });

    getJSON('data/auto/cves.json').then(function (c) {
      var note = document.getElementById('feedCveNote');
      if (note) note.textContent = (c.total_in_window || 0) + ' CRITICAL CVEs published in the last ' + (c.window_days || 7) + ' days (NVD)';
      document.getElementById('feedCves').innerHTML = (c.items || []).map(function (v) {
        return '<tr><td class="formula"><a href="https://nvd.nist.gov/vuln/detail/' + esc(v.id) + '" target="_blank" rel="noopener">' + esc(v.id) + '</a></td>' +
          '<td class="mono" data-val="' + (v.score || 0) + '"><span class="badge ' + ((v.score || 0) >= 9.8 ? 'b-crit' : 'b-warn') + '">' + esc(v.score) + '</span></td>' +
          '<td>' + esc(v.description) + '</td>' +
          '<td class="mono">' + fmtDate(v.published) + '</td></tr>';
      }).join('');
    }).catch(function (e) { feedFail('feedCves', 4, e); });

    getJSON('data/auto/mskb.json').then(function (m) {
      var note = document.getElementById('feedMsNote');
      if (note) note.textContent = esc(m.release_title || m.release_id) + ' · ' + (m.cve_count || 0) +
        ' CVEs addressed · released ' + fmtDate((m.release_date || '').slice(0, 10));
      var kbRows = (m.kbs || []).map(function (k) {
        return '<tr><td class="formula"><a href="' + esc(k.url) + '" target="_blank" rel="noopener">' + esc(k.kb) + '</a></td>' +
          '<td>Security update — ' + esc(m.release_id) + ' release</td></tr>';
      }).join('');
      document.getElementById('feedMs').innerHTML = kbRows;
      var likely = document.getElementById('feedMsLikely');
      if (likely) likely.innerHTML = (m.exploitation_more_likely || []).map(function (v) {
        return '<li><a href="https://msrc.microsoft.com/update-guide/en-US/vulnerability/' + esc(v.cve) + '" target="_blank" rel="noopener">' +
          '<span><b>' + esc(v.cve) + '</b> — ' + esc(v.title) + '</span><span class="meta">EXPLOITATION MORE LIKELY</span></a></li>';
      }).join('') || '<li><a><span>None flagged in this release.</span></a></li>';
    }).catch(function (e) { feedFail('feedMs', 2, e); });

    getJSON('data/auto/linuxkb.json').then(function (l) {
      document.getElementById('feedUbuntu').innerHTML = (l.ubuntu || []).map(function (n) {
        return '<tr><td class="formula"><a href="' + esc(n.url) + '" target="_blank" rel="noopener">' + esc(n.id) + '</a></td>' +
          '<td>' + esc(n.title) + '</td>' +
          '<td class="mono">' + esc((n.cves || []).join(', ')) + '</td>' +
          '<td class="mono">' + fmtDate(n.published) + '</td></tr>';
      }).join('');
      document.getElementById('feedRedhat').innerHTML = (l.redhat || []).map(function (c) {
        return '<tr><td class="formula"><a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.cve) + '</a></td>' +
          '<td><span class="badge ' + (String(c.severity).toLowerCase() === 'critical' ? 'b-crit' : String(c.severity).toLowerCase() === 'important' ? 'b-warn' : 'b-mute') + '">' + esc(c.severity || '—') + '</span></td>' +
          '<td>' + esc(c.description) + '</td>' +
          '<td class="mono">' + fmtDate(c.public_date) + '</td></tr>';
      }).join('');
    }).catch(function (e) { feedFail('feedUbuntu', 4, e); feedFail('feedRedhat', 4, e); });

    getJSON('data/auto/nessus.json').then(function (n) {
      document.getElementById('feedNessus').innerHTML = (n.items || []).map(function (p) {
        return '<tr><td class="formula">' + esc(p.id || '—') + '</td>' +
          '<td><a href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.title) + '</a></td>' +
          '<td class="mono">' + esc(p.published) + '</td></tr>';
      }).join('');
    }).catch(function (e) { feedFail('feedNessus', 3, e); });

    function feedFail(id, cols, e) {
      console.warn('[live-data] feed:', e.message);
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<tr><td colspan="' + cols + '" class="dim">Feed data not available yet — it will populate on the next scheduled refresh (see data/auto/).</td></tr>';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    hydrateHome();
    hydratePoam();
    hydrateThreatIntel();
  });
})();
