# SCRM Sentinel — AI-powered supply chain risk management

A web application for assessing whether a company you plan to do business with brings supply chain risk into a U.S. government organization. It uses **public data only**. It answers:

* **Who are they?** Legal identity, UEI/CAGE/LEI/CIK, SAM.gov registration, vertical (NAICS/SIC).
* **Who owns them?** Immediate and ultimate parents (SAM.gov, GLEIF), with foreign-ownership (FOCI) analysis.
* **Who do they sell to (upstream)?** Awarding agencies, sub-agencies and prime contractors (USAspending.gov).
* **Who do they buy from (downstream)?** First-tier subcontractors on their prime awards (FSRS subaward data).
* **Is anyone in that chain restricted?** Every party is screened against NDAA §889, the FCC Covered List, DoD §1260H, UFLPA, Kaspersky/ByteDance/drone prohibitions, the Consolidated Screening List (OFAC, BIS Entity List, etc.), SAM exclusions and, optionally, OpenSanctions.
* **What else should I worry about?** Integrity proceedings, financial-reporting red flags (SEC), exploited product vulnerabilities (CISA KEV) and adverse media (GDELT).

The results feed an explainable **0–100 risk score** in 8 categories, with findings, evidence, FAR/NIST references and recommended mitigations. An optional **Claude AI analyst** writes the executive summary, a decision recommendation, a mitigation plan and a vendor questionnaire, and answers follow-up questions. It never changes the score.

## Features

* **Dashboard:** portfolio risk score, exposure index (risk × mission criticality), tier distribution, likelihood × impact heat map, 12-month trend, risk drivers by category, flagged parties across the supply chain, supplier geography, government customers, and an activity feed.
* **Vendor register:** a historical list of every company you assess, with criticality, relationship status, annual spend, tags, owner, notes, sorting and filtering, bulk actions and CSV export.
* **Portfolios:** group vendors by program or contract vehicle, each with its own dashboard.
* **Assessments:** single-company lookup (USAspending and SAM.gov entity resolution), or a bulk list / CSV import of up to 500 vendors with live progress. Re-assessment keeps the score history.
* **Vendor detail:** overview, an interactive **supply chain map** (suppliers → company & owners → customers), customers, suppliers, ownership, findings with an adjudication workflow (open / mitigating / mitigated / accepted / false-positive), the AI analyst with chat, and history and data-source provenance.
* **Party screening:** ad-hoc screening of up to 200 names.
* **Printable report:** a one-click assessment report you can print or save as PDF.
* **Data Sources** and **Methodology** pages that document every source and scoring rule.
* **Demo mode:** a portfolio of 8 fictional vendors for training, demos and offline evaluation.
* **Audit log** of every assessment, disposition, setting change and AI request.

## Run it

Requires Node.js ≥ 22.5. SQLite is built in, and the Anthropic SDK is the only third-party dependency.

```bash
cd apps/scrm
npm install
npm start            # http://127.0.0.1:8787
npm test             # 12 unit and API tests on an isolated database
```

On first launch, select **Load demo portfolio** to explore. Then switch to live data in **Settings**:

| Setting | Why |
|---|---|
| `SAM_API_KEY` | Free from sam.gov (Profile → Account Details). Enables registration, hierarchy and exclusion checks. |
| `ANTHROPIC_API_KEY` | Enables the AI analyst (default model `claude-opus-5-5`). |
| `SEC_USER_AGENT` | The SEC requires a contact email, e.g. `MyAgency SCRM scrm@agency.gov`. |
| `CSL_API_KEY`, `OPENSANCTIONS_API_KEY` | Optional live screening APIs. |

Load the Consolidated Screening List once from **Data Sources → Download latest** (or import the JSON file on air-gapped networks), and refresh it weekly.

All settings can be supplied as environment variables or in `apps/scrm/.env` (see `.env.example`). Environment values take precedence and are read-only in the UI.

### Deployment notes

* The app binds to `127.0.0.1` by default. To expose it, set `HOST=0.0.0.0` **and** `SCRM_PASSWORD` (HTTP Basic auth), or put it behind your SSO reverse proxy with TLS.
* The server sends a strict CSP and anti-framing headers, rejects cross-origin state-changing requests, escapes all third-party data before rendering, and never returns API keys to the browser.
* Data is stored in `apps/scrm/data/scrm.db` (SQLite). Back up that file.
* If AI is enabled, assessment data (public information plus your notes) is sent to the Anthropic API. Confirm this is permitted for your environment.
* GitHub/GitLab Pages only serve static files. This app needs the Node server, so run it on a workstation, VM or container.

## Layout

```
server/
  index.js, api.js, http-util.js   HTTP server and REST API
  pipeline.js                      resolve → gather → screen → score → persist
  connectors/                      usaspending, sam, gleif, sec, screening (CSL/OpenSanctions/built-in), media (GDELT), kev, catalog
  reference/watchlists.js          statutory prohibition lists, country risk, NAICS mapping
  risk/engine.js                   deterministic scoring model
  ai/claude.js                     Claude analyst (structured JSON output, chat)
  demo/dataset.js                  fictional demo vendors
public/                            dependency-free SPA (ES modules, SVG charts)
docs/DATA-SOURCES.md               research notes: which source answers which question
test/                              node:test suite
```

See [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md) and the in-app **Methodology** page for details.

> Assessments are decision support built from public information and automated name matching. Potential matches require analyst adjudication. The tool does not replace FAR 9.104 responsibility determinations, DCSA FOCI determinations or legal review.
