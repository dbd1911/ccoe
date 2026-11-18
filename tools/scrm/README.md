# SCRM Sentinel: setup guide

SCRM Sentinel is a CCOE tool for vendor supply chain risk management, built on public data. It is a **static tool**. It runs entirely in the browser with no server and no database, so it works on GitLab Pages as soon as the site is published.

## Day one on GitLab

1. Copy the files listed in `docs/GITLAB-TRANSFER.md` (section *SCRM Sentinel*) and publish the site with the existing `pages` job. No build step and no CI changes are needed.
2. Open **Tools & Dashboards → Launch SCRM Sentinel**.
3. Go to **Settings**, paste your **GenAI.mil API key**, select **Test connection**, and confirm it shows *Connected*.
4. Optional: paste a free **SAM.gov public API key**. It adds registration, parent-company and debarment checks.
5. Select **Run connection check** to see which public sources your network allows.
6. Go to **Data Sources** and load the Consolidated Screening List (direct download, or save the file and import it).

The GenAI endpoint (`https://api.genai.mil/v1/chat/completions`) and model (`gemini-2.5-flash`) are preset in `config.json`. Change them there once for the whole site if they differ. Any OpenAI-compatible chat-completions endpoint works, including Google's Gemini API (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`).

## Where API keys live

* **Each user pastes their own key in the tool's Settings page.** It is stored in that user's browser only: in `localStorage` when *Remember keys on this computer* is ticked, otherwise in `sessionStorage` (cleared when the browser closes). The key is sent only to the AI endpoint, as an `Authorization: Bearer` header.
* **Never put a key in `config.json`, in an HTML file or anywhere else in the repository.** Anything committed to a Pages site can be downloaded by every visitor, and it stays in git history.
* Workspace exports and the published team file never contain keys (this is covered by an automated test).

## Where your data lives (no database)

| Layer | What | Where |
|---|---|---|
| Working copy | Vendor register, portfolios, assessments, finding dispositions, activity log | The browser's IndexedDB on your computer (hundreds of MB available). It survives reloads and restarts. |
| Backup | Everything, with full detail | **Settings → Download full backup** (a JSON file). Keep it on a share drive. Restore with *Import workspace file*. |
| Team baseline | Latest assessment per vendor (trimmed) plus score history, about 8 KB per vendor | **Settings → Download team file**, committed as `data/manual/scrm-workspace.json`. Every browser that opens the tool merges it in automatically when it changes. |

**Growth.** The team file holds only the latest assessment per vendor plus one small history point per re-assessment. At about 8 KB per vendor, 500 vendors is roughly 4 MB. Full detail stays in personal backups, not in the repository. If the file ever grows too large, export a fresh team file: it always contains just the current state.

**Caveats.** Browser storage belongs to one browser profile on one machine. Clearing site data, a roaming-profile reset or a different computer starts empty, apart from the published team file. Back up regularly; the tool warns you if you never have. Bulk assessments run only while the tab is open.

## Network requirements

The browser calls these hosts directly. Each must be reachable, and must allow cross-origin requests:

| Host | Used for | If blocked |
|---|---|---|
| `api.genai.mil` | AI analyst | AI features disabled; scoring still works |
| `api.usaspending.gov` | Customers, suppliers and federal awards | Core lookup unavailable; run the connection check |
| `api.sam.gov` | Registration and exclusions (needs key) | Those checks are skipped |
| `api.gleif.org` | Corporate ownership | Ownership from SAM only |
| `data.trade.gov` | Screening list download | Save the file and import it |
| `api.gdeltproject.org`, `www.cisa.gov` / `raw.githubusercontent.com` | Adverse media, exploited vulnerabilities | Those categories are skipped |

Sources that fail are skipped, and every report shows which ones they were. The built-in statutory lists (§889, FCC Covered List, §1260H, UFLPA, Kaspersky, drones, §5949) always work offline.

## Maintenance

* **Every quarter**, review `js/core/watchlists.js` against the FCC Covered List, the DoD §1260H list, the DHS UFLPA Entity List and FAR 52.204-23/25/27.
* **Every week**, reload the screening list on Data Sources.
* **Tests:** from the site root, run `node --test tests/scrm.test.mjs`.

## Files

```
tools/scrm/
  index.html, config.json, css/, img/
  js/app.js, ui.js, charts.js, api.js, views/   user interface
  js/backend/   routes (in-browser API), store (IndexedDB), settings (keys), llm (GenAI), pipeline, connectors/
  js/core/      risk engine, name matching, watchlists, source catalog, demo data (pure JS)
  DATA-SOURCES.md   which public source answers which question
data/manual/scrm-workspace.json   published team workspace (optional; starts empty)
tests/scrm.test.mjs
```
