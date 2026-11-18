# Public data sources for federal supply chain risk management

Research notes behind SCRM Sentinel: where each due-diligence question can be answered from **public** information, and how the app uses it.

## The questions, and where the answers live

| Question | Best public sources | In the app |
|---|---|---|
| **Who are they?** Legal identity, registrations, identifiers | SAM.gov Entity API (UEI, CAGE, registration), USAspending recipient profiles, GLEIF LEI, SEC EDGAR (CIK), OpenCorporates | Automated (SAM, USAspending, GLEIF) |
| **What is their vertical?** | NAICS/PSC on their federal awards (USAspending), NAICS in SAM.gov, SEC SIC code | Automated (NAICS→vertical) |
| **Who owns or controls them?** (FOCI) | SAM.gov immediate/ultimate parent, GLEIF Level 2 (direct/ultimate parent, children, reporting exceptions), SEC SC 13D/13G and Exhibit 21, OpenSanctions ownership graph | Automated (SAM + GLEIF); SEC exhibits manual |
| **Who do they sell to?** (upstream: government customers) | USAspending prime awards by awarding agency/sub-agency; FPDS-NG contract actions; subawards where the company is the **sub** reveal which prime contractors it supplies | Automated |
| **Who do they buy from?** (downstream: sub-tier suppliers) | USAspending/FSRS first-tier subawards on the company's prime awards; customs bills of lading (ImportYeti, Panjiva) for commercial ocean imports | Federal subawards automated; bills of lading manual |
| **Are they or their partners restricted?** | Consolidated Screening List (OFAC SDN and non-SDN lists, BIS Entity List, Denied Persons, Unverified, MEU, ITAR debarred); SAM.gov exclusions; NDAA §889; FCC Covered List; DoD §1260H; UFLPA Entity List; FAR 52.204-23 (Kaspersky) and 52.204-27 (ByteDance); American Security Drone Act; OpenSanctions | Automated |
| **Are they responsible?** | SAM.gov exclusions and integrity information (FAPIIS proceedings), FPDS terminations for default, CPARS (government only) | Exclusions and proceedings automated |
| **Are they financially stable and transparent?** | SEC EDGAR filing history (late filings NT 10-K/Q, Form 15 deregistration, 8-K events), commercial credit reports | Manual (SEC blocks browser requests) |
| **Do their products carry cyber risk?** | CISA KEV catalog, NIST NVD, FedRAMP Marketplace, SPRS/CMMC (government only) | KEV automated |
| **What is being reported about them?** | GDELT global news index | Automated |

## Automated connectors

The tool runs entirely in the browser, so each source must allow cross-origin (CORS) requests and be reachable from your network. Run **Settings → Run connection check** on each new network.

| Source | Endpoint(s) used | Key | Notes |
|---|---|---|---|
| USAspending.gov | `/api/v2/recipient/`, `/recipient/{id}/`, `/search/spending_by_category/{awarding_agency,awarding_subagency,naics,psc}/`, `/search/spending_over_time/`, `/search/spending_by_award/` (prime awards and subawards), `/subawards/` | None | Subaward reporting covers first-tier subs above the FFATA threshold, and is often incomplete. |
| SAM.gov Entity Management v4 | `/entity-information/v4/entities` | Free public key (sam.gov → Account Details) | Hierarchy and some reps & certs fields need a federal system account. |
| SAM.gov Exclusions v4 | `/entity-information/v4/exclusions` | Same key | |
| Consolidated Screening List | Bulk file `data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.json` (no key, loaded locally); search API `data.trade.gov/consolidated_screening_list/v1/search` (subscription key) | Optional | Load or refresh the bulk file on the Data Sources page; on restricted networks, import it from a file. |
| GLEIF | `/api/v1/lei-records`, `/{lei}/direct-parent`, `/ultimate-parent`, `/direct-children`, reporting exceptions | None | |
| GDELT DOC 2.0 | `api.gdeltproject.org/api/v2/doc/doc` | None | Classifies headlines only; an analyst should review the results. |
| CISA KEV | `www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` | None | |
| OpenSanctions | `api.opensanctions.org/match/default` | API key | Optional. |
| Built-in lists | `server/reference/watchlists.js` | — | A curated subset (as of 2026-11-01). Refresh quarterly against the FCC Covered List, the DoD §1260H list, the DHS UFLPA list and the FAR. |

## Manual and reference sources (not automated)

FPDS-NG, FAPIIS/Responsibility & Qualification, CPARS, SPRS/CMMC, the FedRAMP Marketplace, NIST NVD, the Federal Register (Entity List additions, FASCSA orders, ICTS determinations), OpenCorporates, customs bills of lading, and DCSA FOCI status. Each one is described on the in-app **Data Sources** page, with access requirements and limitations.

## Known gaps in public data

* **Commercial supply chains are mostly invisible.** Federal subaward data shows only first-tier subcontracts on federal awards. For critical buys, request a supplier list, an SBOM or HBOM, and country-of-origin certifications.
* **Beneficial ownership.** The Corporate Transparency Act's BOI database is not public. Rely on SAM.gov hierarchy, GLEIF, SF 328 FOCI disclosures and vendor attestations.
* **Name matching is probabilistic.** Every potential match needs adjudication against addresses and identifiers.
