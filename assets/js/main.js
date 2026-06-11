/* ============================================================
   CCoE Operational Hub — shared layout & utilities
   Header/footer are injected from this single source so all
   pages stay consistent and the site stays portable.
   ============================================================ */

const NAV = [
  { label: 'Home', href: 'index.html' },
  {
    label: 'Operations', items: [
      ['rmf-operations.html', 'RMF Operations Hub'],
      ['risk-management.html', 'Risk Management'],
      ['vulnerability-poam.html', 'Vulnerability & POA&M'],
      ['assessment-calendar.html', 'Assessment Calendar'],
      ['threat-intel.html', 'Threat Intelligence'],
      ['incident-response.html', 'Incident Response'],
    ]
  },
  {
    label: 'Library', items: [
      ['policies.html', 'Policies & SOPs'],
      ['templates.html', 'Templates & Job Aids'],
      ['faq.html', 'FAQ & Knowledge Base'],
    ]
  },
  {
    label: 'Workforce', items: [
      ['workforce.html', 'Workforce Development'],
      ['training.html', 'Training Academy'],
      ['community.html', 'Community & Office Hours'],
    ]
  },
  {
    label: 'Governance', items: [
      ['governance.html', 'Governance & Leadership'],
      ['acquisition.html', 'Acquisition & Contracts'],
      ['inspection-readiness.html', 'Inspection Readiness'],
    ]
  },
  {
    label: 'Tech', items: [
      ['engineering.html', 'Engineering & Secure Design'],
      ['tools-dashboards.html', 'Tools & Dashboards'],
      ['ai-automation.html', 'AI & Automation'],
    ]
  },
  { label: 'Contact', href: 'contact.html' },
];

function currentPage() {
  const p = location.pathname.split('/').pop();
  return p === '' ? 'index.html' : p;
}

function buildHeader() {
  const page = currentPage();
  let nav = '';
  NAV.forEach((g, i) => {
    if (g.href) {
      nav += `<a class="nav-link ${page === g.href ? 'active' : ''}" href="${g.href}">${g.label}</a>`;
    } else {
      const open = g.items.some(it => it[0] === page);
      nav += `<div class="nav-group" data-group="${i}">
        <button aria-expanded="false" aria-haspopup="true">${g.label}<span class="caret">▼</span></button>
        <div class="nav-menu" role="menu">
          <div class="menu-label">${g.label}</div>
          ${g.items.map(it => `<a role="menuitem" href="${it[0]}" class="${page === it[0] ? 'active' : ''}">${it[1]}</a>`).join('')}
        </div>
      </div>`;
    }
  });

  const header = document.createElement('div');
  header.innerHTML = `
  <div class="marking-banner">UNCLASSIFIED // DEMONSTRATION ENVIRONMENT — NO CUI OR CLASSIFIED DATA AUTHORIZED ON THIS HUB // <strong>CCoE-WEB v1.1</strong></div>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="index.html" aria-label="CCoE Home">
        <span class="brand-mark">CoE</span>
        <span class="brand-text">
          <span class="t1">Cybersecurity Center of Excellence</span>
          <span class="t2">Operational Hub · Army Cyber Portfolio</span>
        </span>
      </a>
      <button class="nav-toggle" aria-expanded="false" aria-controls="mainnav">MENU ☰</button>
      <nav class="main-nav" id="mainnav" aria-label="Global">${nav}
        <a class="report-incident-btn" href="incident-response.html#report">⚠ Report Incident</a>
      </nav>
    </div>
  </header>`;
  document.body.prepend(header);

  // Dropdown behavior
  document.querySelectorAll('.nav-group > button').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const grp = btn.parentElement;
      const isOpen = grp.classList.contains('open');
      document.querySelectorAll('.nav-group.open').forEach(g => { g.classList.remove('open'); g.querySelector('button').setAttribute('aria-expanded', 'false'); });
      if (!isOpen) { grp.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.nav-group.open').forEach(g => { g.classList.remove('open'); g.querySelector('button').setAttribute('aria-expanded', 'false'); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));
  });

  const toggle = document.querySelector('.nav-toggle');
  toggle.addEventListener('click', () => {
    const navEl = document.getElementById('mainnav');
    const open = navEl.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

function buildFooter() {
  const f = document.createElement('div');
  f.innerHTML = `
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <h4>CCoE Operational Hub</h4>
        <p>One daily question, answered for every role in the portfolio: <em>what do I need to know or do today?</em> Evidence-based management. Disciplined RMF execution. Clear risk ownership.</p>
      </div>
      <div>
        <h4>Operations</h4>
        <ul>
          <li><a href="rmf-operations.html">RMF Operations Hub</a></li>
          <li><a href="vulnerability-poam.html">Vulnerability & POA&M</a></li>
          <li><a href="assessment-calendar.html">Assessment Calendar</a></li>
          <li><a href="incident-response.html">Incident Response</a></li>
          <li><a href="threat-intel.html">Threat Intelligence</a></li>
        </ul>
      </div>
      <div>
        <h4>Resources</h4>
        <ul>
          <li><a href="templates.html">Templates & Job Aids</a></li>
          <li><a href="policies.html">Policies & SOPs</a></li>
          <li><a href="training.html">Training Academy</a></li>
          <li><a href="faq.html">FAQ & Glossary</a></li>
          <li><a href="tools-dashboards.html">Tools & Dashboards</a></li>
        </ul>
      </div>
      <div>
        <h4>Office</h4>
        <ul>
          <li><a href="governance.html">Governance & Leadership</a></li>
          <li><a href="community.html">Office Hours</a></li>
          <li><a href="contact.html">Contact the Cybersecurity Office</a></li>
          <li><a href="contact.html#ask-ciso">Ask the CISO</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-legal">
      <div class="wrap">
        <span>CCoE OPERATIONAL HUB · DOC v1.1 · REVIEW DUE 2026-12-01 · APPROVAL: CISO</span>
        <span>CAC/PKI AUTHENTICATION REQUIRED IN PRODUCTION · RBAC ENFORCED</span>
      </div>
    </div>
  </footer>
  <div class="marking-banner">UNCLASSIFIED // DEMONSTRATION ENVIRONMENT</div>`;
  document.body.append(f);
}

/* ---------- Shared utilities ---------- */

// Scroll reveal
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: .08 });
  els.forEach(e => io.observe(e));
}

// Sortable tables: add class="sortable" to <th>, data-sort-type="num|text" optional
function initSortableTables() {
  document.querySelectorAll('table').forEach(tbl => {
    tbl.querySelectorAll('th.sortable').forEach((th, idx) => {
      th.addEventListener('click', () => {
        const tbody = tbl.querySelector('tbody');
        const rows = [...tbody.querySelectorAll('tr')];
        const colIdx = [...th.parentElement.children].indexOf(th);
        const type = th.dataset.sortType || 'text';
        const dir = th.dataset.dir === 'asc' ? 'desc' : 'asc';
        tbl.querySelectorAll('th.sortable').forEach(h => delete h.dataset.dir);
        th.dataset.dir = dir;
        rows.sort((a, b) => {
          let av = a.children[colIdx].dataset.val ?? a.children[colIdx].textContent.trim();
          let bv = b.children[colIdx].dataset.val ?? b.children[colIdx].textContent.trim();
          if (type === 'num') { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; return dir === 'asc' ? av - bv : bv - av; }
          return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        });
        rows.forEach(r => tbody.appendChild(r));
      });
    });
  });
}

// Generic tabs: .tabs > .tab[data-tab], panels .tab-panel#id
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabbar => {
    tabbar.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const scope = tabbar.dataset.scope ? document.getElementById(tabbar.dataset.scope) : document;
        tabbar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        scope.querySelectorAll(`.tab-panel[data-group="${tabbar.dataset.group || 'default'}"]`).forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(tab.dataset.tab);
        if (panel) panel.classList.add('active');
      });
    });
  });
}

// Live text filter: input[data-filter-target="#listId"] filters children [data-search]
function initFilters() {
  document.querySelectorAll('[data-filter-target]').forEach(inp => {
    inp.addEventListener('input', () => {
      const q = inp.value.toLowerCase().trim();
      const target = document.querySelector(inp.dataset.filterTarget);
      let shown = 0;
      target.querySelectorAll('[data-search]').forEach(el => {
        const hit = el.dataset.search.toLowerCase().includes(q);
        el.classList.toggle('hidden', !hit);
        if (hit) shown++;
      });
      const note = document.querySelector(inp.dataset.countNote || '');
      if (note) note.textContent = `${shown} item${shown === 1 ? '' : 's'} shown`;
    });
  });
}

// Chip group filters: .chip[data-chip-value] filtering [data-cat] in target
function initChips() {
  document.querySelectorAll('[data-chip-target]').forEach(row => {
    row.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        row.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const val = chip.dataset.chipValue;
        const target = document.querySelector(row.dataset.chipTarget);
        let shown = 0;
        target.querySelectorAll('[data-cat]').forEach(el => {
          const hit = val === 'all' || el.dataset.cat.split(' ').includes(val);
          el.classList.toggle('hidden', !hit);
          if (hit) shown++;
        });
        const note = document.querySelector(row.dataset.countNote || '');
        if (note) note.textContent = `${shown} item${shown === 1 ? '' : 's'} shown`;
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  buildHeader();
  buildFooter();
  initReveal();
  initSortableTables();
  initTabs();
  initFilters();
  initChips();
});
