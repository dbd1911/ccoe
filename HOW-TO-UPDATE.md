# How to Update This Site

The hub is a static site (GitHub Pages compatible). After the June 2026 overhaul,
routine content lives in JSON files — you almost never touch HTML.

## 1. Data you edit by hand — `data/manual/`

Edit the file, commit, done. The pages fetch these at load time; the HTML that is
already in each page acts as the fallback if a fetch ever fails.

| File | Drives | Typical edit |
|---|---|---|
| `site-metrics.json` | Home page hero counters, metrics snapshot, ATO donut, POA&M severity bars — plus the live dashboard on `tools-dashboards.html` and the leadership tiles on `governance.html` | Monthly metrics roll |
| `ticker.json` | Home page CYBER ALERTS ticker | Add/remove alert lines. With `"auto_kev_item": true` the newest CISA KEV entry is inserted automatically as the first item |
| `poam.json` | Open POA&M table on `vulnerability-poam.html` | Add/close findings. `status`: `overdue` \| `atrisk` \| `ontrack` \| `review` |
| `calendar.json` | Month grid events, hard milestones (with `.ics` downloads), ATO expiration table on `assessment-calendar.html` | Add events as `"YYYY-MM-DD": [["e-type","Label"]]`. Event types: `e-ato`, `e-asmt`, `e-mil`, `e-trn`, `e-blk` |
| `threat-week.json` | Weekly alert cards, KEV→portfolio map on `threat-intel.html` | Monday-morning weekly refresh |

Notes:
* Milestones in `calendar.json` need a unique `slug` — the workflow builds
  `assets/downloads/calendar/<slug>.ics` from it automatically. Pushing a
  `calendar.json` change triggers the rebuild; no manual step.
* Manual JSON may contain simple inline markup (`<b>…</b>`) where the original
  page used it; automatic feed data is always escaped.

## 2. Data that updates itself — `data/auto/`

`.github/workflows/update-data.yml` runs twice daily (and on demand via the
**Run workflow** button in the Actions tab). It executes `scripts/update_feeds.py`,
which pulls from the official public sources — no API keys needed:

| File | Source |
|---|---|
| `kev.json` | CISA Known Exploited Vulnerabilities catalog |
| `cves.json` | NVD API 2.0 — CRITICAL CVEs from the last 7 days |
| `mskb.json` | MSRC CVRF v3.0 — latest Microsoft monthly security release (KB list + "exploitation more likely" CVEs) |
| `linuxkb.json` | Ubuntu Security Notices API + Red Hat Security Data API |
| `nessus.json` | Tenable newest Nessus plugins RSS |

These render in the **Live External Feeds** section of `threat-intel.html`; the
newest KEV entry also feeds the home-page ticker. Each feed is independent — if
one source is down, the previous data stays in place and everything else updates.

The `data/auto/` files currently in the repo are **seeded placeholders** so the
site works out of the box; the first workflow run replaces them with live data.

Requirement: repo **Settings → Actions → General → Workflow permissions** must be
"Read and write permissions" so the bot can commit refreshed data.

## 3. Downloads

* ACMA: `assets/downloads/acma/` — the governing DACM policy PDF and the nomination
  memo template linked from `acma.html`.
* Policies: `assets/downloads/policies/` — the 14 library documents linked from
  `policies.html`. To revise one: edit/replace the docx, bump the version in the
  filename, and update the card's link, VER, EFF, and SUPERSEDES line.
* Templates: `assets/downloads/templates/` (docx/xlsx/pptx, blank + gold standard)
* Tabletop playbooks: `assets/downloads/tabletops/` (individual docx + `TTX-Playbooks-All.zip` —
  rebuild the zip if you edit a playbook: `cd assets/downloads/tabletops && zip TTX-Playbooks-All.zip TTX-*.docx`)
* Workforce tools: `assets/downloads/tools/`
* Calendar files: `assets/downloads/calendar/` (generated — edit `calendar.json` instead)

To publish a new template version: drop the new file in the folder, update the
row in `templates.html` (filename, version, date).

## 4. Placeholders to replace for production

* All form/report buttons currently open a pre-addressed email to
  `cybersecurity.office@ccoe.example.mil` (contact, engineering ARB intake,
  AI & Automation intake, incident report). Search for that address and replace
  it with the real org box — it appears only in HTML `mailto:` links.
* Newsletter archive lives in `newsletters/` — copy an existing issue as the
  template for new weeks and add a row in `community.html`.

## 5. Local preview

Browsers block `fetch()` from `file://`, so use any static server:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Opening the HTML files directly still works — you just see the built-in fallback
content instead of the JSON-driven data.
