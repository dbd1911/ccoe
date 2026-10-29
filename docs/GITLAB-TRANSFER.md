# Transfer the October 29 changes to the .mil copy

This release keeps page paths and `assets/js/main.js` (shared top-level navigation, dropdowns, header and footer) unchanged. It adds no top-level menu items. New links are inside existing page content. Your separate .mil repository was not accessed or modified.

## Transfer safely

1. Save a commit or backup of your current GitLab copy. Use a temporary integration branch.
2. Compare the GitHub changes against baseline commit `be7d57fb2f34f0ff74c85bebe1e3ae958d693d9a`. Apply this release's diff, or copy just the sections below. Do not mirror the whole repository over your .mil copy.
3. For every modified HTML file, retain your .mil-specific external links. Use a three-way merge if the copies have diverged. Do not resolve conflicts by replacing the entire .mil page with the GitHub page. Review `href`, `src` and form action changes before publishing. The only intentional site-owned email destination is `usarmy.orlando.cpe-st3.mbx.cybersecurity-office@army.mil`.
4. Add the new metrics script and JSON together. Add `assets/js/metrics.js` to the six consuming pages. Keep existing script paths relative. Do not populate GitHub with operational data; fill in the .mil metrics file after transfer.
5. Run the tests, validate JSON and preview in GitLab before merging. The existing deployment configuration is unchanged. Keep your existing GitLab deployment configuration.

## Functional changes

| Files | Sections to merge |
|---|---|
| `assets/js/metrics.js`, `data/manual/metrics.json` | New shared summary renderer and append-only weekly reporting snapshots |
| `index.html`, `governance.html`, `tools-dashboards.html` | Replace static counters/summary charts; remove Tools worklist; add script and shared summary containers |
| `vulnerability-poam.html` | Replace SLA clock and finding table with aggregate cards, history and system totals; retain guidance |
| `assessment-calendar.html`, `data/manual/calendar.json` | ATO table now reads dated metrics; calendar events and milestones remain editable in calendar.json; current calendar month follows actual date |
| `assets/js/live-data.js` | Retain public feed/ticker loading; remove competing portfolio/finding loaders and exposure map |
| `data/manual/site-metrics.json`, `data/manual/poam.json` | Retired summary source and emptied finding source; transfer these changes so old findings are not left publicly downloadable |
| `rmf-operations.html`, `templates.html` | Move narratives to Templates; link from Implement; add task shortcuts and Incident Response blurb with existing report destination |
| `threat-intel.html`, `data/manual/threat-week.json`, two changed newsletters | Remove operational finding references and vulnerability-to-system exposure mapping; retain public feeds |
| `tools/cyber-range/index.html` | Replace local profiles/passwords with name/email session; retain course content files; one certificate per course/session, PNG and browser print/save PDF |
| `docs/METRICS-UPDATE.md`, `HOW-TO-UPDATE.md`, `tests/` | Maintenance instructions and regression checks |

All remaining changed files contain mailbox replacements (see complete inventory below). External policy POCs and learner-entered email fields are retained. Document content in binary downloads was not rewritten.

## Cyber Range behavior

All courses are available immediately; within each course, module knowledge checks and the assessment pass requirement remain. Learner details and progress use sessionStorage, with an in-memory fallback if storage is unavailable. Refresh retains the session where sessionStorage works. End session clears it; browser restore behavior is controlled by the browser. There is no cross-session duplicate-credit or identity verification.

Certificates freeze the first successful completion's training time. Foreground, recently active module/assessment time is counted, rounded down to whole minutes. Potential CPE is rounded down to half-hour increments (30 recorded minutes = 0.5 potential CPE); acceptance remains with the credentialing organization. A tier summary adds no duplicate course credit. Retakes do not add certificates or time to an already completed course. Print/save PDF uses the browser and has no PDF CDN dependency. The user downloads/prints and emails their own attachment; the site sends no mail. Old browser-local password profiles are no longer read, but existing stored browser data is not remotely erased.

## Checks

Run from the site root:

```
node tests/metrics.test.cjs
node tests/cyber-range.test.cjs
node -e "require('./assets/js/metrics.js').validate(require('./data/manual/metrics.json'))"
git diff --check
```

Preview over HTTP. Confirm page menus and .mil links; confirm unavailable initial metrics; enter a dated report and check totals, ranking and dates; use a test learner to check all tiers, refresh, completion, download/print and End session. No HTML render/browser test could be completed in the development environment: its browser could not reach the local preview server. JavaScript syntax and behavioral regression tests were run.

## Complete changed-file inventory

- `HOW-TO-UPDATE.md`
- `agent-catalog.html`
- `ai-automation.html`
- `assessment-calendar.html`
- `assets/js/live-data.js`
- `assets/js/metrics.js`
- `contact.html`
- `data/manual/calendar.json`
- `data/manual/faq-general-06.json`
- `data/manual/faq-incident-03.json`
- `data/manual/faq-rmf-02.json`
- `data/manual/faq-site-01.json`
- `data/manual/faq-workforce-04.json`
- `data/manual/faq-workforce-05.json`
- `data/manual/metrics.json`
- `data/manual/pages.json`
- `data/manual/poam.json`
- `data/manual/site-metrics.json`
- `data/manual/threat-week.json`
- `docs/2026-10-04-CCOE-WORKFORCE-OFFERING-INVENTORY.html`
- `docs/2026-10-04-CCOE-WORKFORCE-OFFERING-INVENTORY.md`
- `docs/GITLAB-TRANSFER.md`
- `docs/METRICS-UPDATE.md`
- `engineering.html`
- `faq.html`
- `governance.html`
- `incident-response.html`
- `index.html`
- `newsletters/2026-w23.html`
- `newsletters/2026-w24.html`
- `rmf-operations.html`
- `templates.html`
- `tests/cyber-range.test.cjs`
- `tests/metrics.test.cjs`
- `threat-intel.html`
- `tools-dashboards.html`
- `tools/cyber-range/index.html`
- `vulnerability-poam.html`
