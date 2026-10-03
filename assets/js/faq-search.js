/* ============================================================
   CCoE FAQ & Knowledge Base — search engine
   Loads the FAQ dataset (data/manual/faq-*.json) and the full
   site index (data/manual/pages.json), builds a term index at
   runtime, and exposes window.FaqSearch.

   Ranking: phrase hit > term-prefix hits > raw substring > site
   pages. Answers carry HTML links already; Answers results render
   with <em> highlight on matched terms.
   ============================================================ */
(function () {
  'use strict';

  var FILES = [
    'data/manual/faq-site-01.json',
    'data/manual/faq-rmf-02.json',
    'data/manual/faq-incident-03.json',
    'data/manual/faq-workforce-04.json',
    'data/manual/faq-workforce-05.json',
    'data/manual/faq-general-06.json'
  ];

  var CAT_LABEL = {
    tools: 'Tools & Navigation', rmf: 'RMF & Authorization', risk: 'Risk Management',
    poam: 'POA&M & Vulnerabilities', incident: 'Incident & Threats', cui: 'CUI & Handling',
    stig: 'STIG & Scanning', cloud: 'Cloud & FedRAMP', policy: 'Policies & SOPs',
    compliance: 'Compliance & Inspection', governance: 'Governance & Roles',
    workforce: 'Workforce & Training', acquisition: 'Acquisition & Contracts'
  };

  // Terms that should not match on their own
  var STOP = { the:1, a:1, an:1, of:1, to:1, for:1, is:1, are:1, and:1, or:1, on:1, in:1, do:1,
    does:1, did:1, how:1, what:1, when:1, where:1, who:1, why:1, which:1, i:1, my:1, me:1, we:1,
    our:1, it:1, its:1, if:1, can:1, get:1, go:1, at:1, be:1, was:1, will:1, with:1, from:1,
    that:1, this:1, there:1, have:1, has:1, need:1, want:1, find:1, should:1, would:1, could:1,
    about:1, into:1, their:1, them:1, not:1, no:1, yes:1, but:1, so:1, as:1, by:1, up:1, out:1 };

  function stripHtml(s) { return String(s).replace(/<[^>]*>/g, ' '); }

  function norm(s) {
    return String(s).toLowerCase()
      .replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&nbsp;/g, ' ')
      .replace(/[^a-z0-9&\-' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function expand(t) {
    var m = { poams:'poam', poam:'poam', poa:'poam', atos:'ato', cves:'cve', cvss:'cvss',
      searching:'search', searches:'search', searched:'search', scans:'scan', scanned:'scan',
      scanning:'scan', incidents:'incident', controls:'control', templates:'template',
      policies:'policy', agents:'agent', tools:'tool', questions:'question', answers:'answer',
      links:'link', linked:'link', located:'locate', located:'locate', locate:'locate',
      accessing:'access', accessed:'access', passwords:'password', expirations:'expiration',
      expiring:'expire', expires:'expire', categorized:'categorize', categorization:'categorize',
      authorizations:'authorization', authorizing:'authorize', assessments:'assessment',
      assessors:'assessor', assessments:'assessment', checklists:'checklist', stigs:'stig',
      emails:'email', emailed:'email', mailing:'email' };
    return m[t] || t;
  }

  function terms(q) {
    var out = [];
    norm(q).split(' ').forEach(function (t) {
      t = t.replace(/\.$/, '');
      if (!t || STOP[t]) return;
      if (t.length > 5 && t.slice(-3) === 'ing') t = t.slice(0, -3); // scanning -> scan
      else if (t.length > 4 && t.slice(-2) === 'es') t = t.slice(0, -2); // templates -> templat? no: handled by expand
      else if (t.length > 3 && t.slice(-1) === 's' && t.slice(-2) !== 'ss') t = t.slice(0, -1);
      out.push(expand(t));
    });
    return out;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Highlight matched terms in a plain-text string, protecting existing HTML */
  function highlight(htmlStr, tset) {
    return htmlStr.replace(/(<[^>]+>)|([^<]+)/g, function (all, tag, text) {
      if (tag) return tag;
      var decoded = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
      var escaped = decoded.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var parts = escaped.split(/(\b(?:[A-Za-z][A-Za-z0-9&\-']*)\b)/);
      return parts.map(function (p) {
        var w = p.toLowerCase();
        if (w && tset[w]) return '<em>' + p + '</em>';
        return p;
      }).join('');
    });
  }

  var state = { faqs: [], index: [], pages: [], ready: false, loading: null };

  function loadJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.json();
    });
  }

  function buildIndex() {
    state.faqs.forEach(function (f) {
      var fields = [
        [norm(f.q), 6],
        [norm(stripHtml(f.a)), 2],
        [norm(f.k), 5],
        [norm(f.cat), 3]
      ];
      state.index.push({ f: f, fields: fields });
    });
    state.pages.forEach(function (p) {
      p.kw = norm((p.k || '') + ' ' + (p.title || '') + ' ' + (p.s || '') + ' ' + (p.h || '').replace(/\|/g, ' '));
    });
  }

  /* Score a faq against query tokens */
  function scoreFaq(entry, qt, phrase) {
    var score = 0;
    entry.fields.forEach(function (fd) {
      var text = fd[0], w = fd[1];
      if (phrase.length > 3 && text.indexOf(phrase) >= 0) score += w * 4;
      qt.forEach(function (t) {
        if (text === t) { score += w * 6; return; }
        if (text.indexOf(t) === 0 || new RegExp(' ' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' ').test(' ' + text + ' ')) score += w * 3;
        else if (text.indexOf(t) >= 0) score += w;
      });
    });
    // boost: question-token matches count double when every token is present in q+k
    return score;
  }

  /* Results are built with for-loops returning plain arrays — never VM/host-realm natives */
  function mapResults(arr, fn) {
    var out = [];
    for (var i = 0; i < arr.length; i++) out.push(fn(arr[i], i));
    return out;
  }

  function searchFaqs(q, cat) {
    var qt = terms(q);
    var phrase = norm(q);
    var tset = {};
    qt.forEach(function (t) { tset[t] = 1; });
    var results = [];
    state.index.forEach(function (entry) {
      if (cat && cat !== 'all' && entry.f.cat !== cat) return;
      var s = scoreFaq(entry, qt, phrase);
      if (s > 0) results.push({ entry: entry, s: s });
    });
    results.sort(function (a, b) { return b.s - a.s; });
    return mapResults(results.slice(0, 12), function (r) {
      var f = r.entry.f;
      return { id: f.id, cat: f.cat, catLabel: CAT_LABEL[f.cat] || f.cat,
        q: highlight(f.q, tset), a: f.a, src: f.src };
    });
  }

  function scorePage(p, qt, phrase) {
    var s = 0, hitTitle = null;
    var title = norm(p.title), sTxt = norm(p.s), hTxt = norm((p.h || '').replace(/\|/g, ' '));
    if (phrase.length > 3) {
      if (title.indexOf(phrase) >= 0) s += 10;
      if (p.kw.indexOf(phrase) >= 0) s += 8;
    }
    qt.forEach(function (t) {
      var tw = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (title === t || title.indexOf(' ' + t + ' ') >= 0) s += 8;
      else if (title.indexOf(t) >= 0) s += 5;
      if (hTxt.indexOf(t) >= 0) s += 3;
      if (sTxt.indexOf(t) >= 0) s += 2;
      if (new RegExp('(^| )' + tw + '( |$)').test(p.kw)) s += 3;
      else if (p.kw.indexOf(t) >= 0) s += 1;
      if (!hitTitle) {
        var m = p.h ? p.h.split('|').filter(function (h) { return h.toLowerCase().indexOf(t) >= 0; }) : [];
        if (m.length) hitTitle = m[0];
      }
    });
    return { s: s, hitTitle: hitTitle };
  }

  function searchSite(q, cat) {
    var qt = terms(q);
    var phrase = norm(q);
    var results = [];
    state.pages.forEach(function (p) {
      if (cat && cat !== 'all' && p.cat !== cat) return;
      var r = scorePage(p, qt, phrase);
      if (r.s >= 6) results.push({ p: p, s: r.s, hitTitle: r.hitTitle });
    });
    results.sort(function (a, b) { return b.s - a.s; });
    var tset = {}; qt.forEach(function (t) { tset[t] = 1; });
    return mapResults(results.slice(0, 10), function (r) {
      var p = r.p;
      return { url: p.url, title: highlight(escapeHtml(p.title), tset),
        s: escapeHtml(p.s), h: r.hitTitle ? escapeHtml(r.hitTitle) : null };
    });
  }

  function search(q, opts) {
    opts = opts || {};
    var cat = opts.cat || 'all';
    var mode = opts.mode || 'both';
    var out = { faqs: [], pages: [], totalFaqs: state.faqs.length, totalPages: state.pages.length };
    if (!q || !q.trim()) return out;
    out.faqs = (mode === 'site') ? [] : searchFaqs(q, cat);
    out.pages = (mode === 'faqs') ? [] : searchSite(q, cat);
    return out;
  }

  function emit(name, detail) {
    try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) { /* non-DOM environment */ }
  }

  function ensureLoaded() {
    if (state.ready) return Promise.resolve();
    if (state.loading) return state.loading;
    state.loading = Promise.all(FILES.map(loadJson))
      .then(function (arrs) {
        arrs.forEach(function (arr) { state.faqs = state.faqs.concat(arr); });
        return loadJson('data/manual/pages.json');
      })
      .then(function (p) {
        state.pages = p.pages || [];
        buildIndex();
        state.ready = true;
        emit('faqsearch:ready', { faqs: state.faqs.length, pages: state.pages.length });
        return true;
      })
      .catch(function (err) {
        console.error('FAQ engine failed to load data:', err);
        emit('faqsearch:error', { message: String(err) });
        return false;
      });
    return state.loading;
  }

  window.FaqSearch = {
    search: function (q, opts) { return ensureLoaded().then(function () { return search(q, opts); }); },
    ready: ensureLoaded,
    stats: function () { return { faqs: state.faqs.length, pages: state.pages.length, ready: state.ready }; },
    catLabel: CAT_LABEL
  };
})();