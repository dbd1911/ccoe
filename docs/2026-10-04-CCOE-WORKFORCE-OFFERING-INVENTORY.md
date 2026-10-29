# CCoE Hub — Complete Workforce Offering Inventory
**Prepared for CISO review · 4 OCT 2026 · Full sweep: all 24 pages, every section, card, tool, download, and link. No truncation.**

Purpose: decision inventory for the minimally-viable deployment (+ .mil GitLab transition). Use the KEEP / MERGE / CUT marks to decide what stays in the release.

---

## A. PORTAL ENTRANCES & ORIENTATION

### A1. Home Page (`index.html`)
| Offering | What the workforce gets | Keep? |
|---|---|---|
| Hero: "From document repository to command center" + mission framing | Sets the narrative that compliance is the floor, risk-aware enablement is the standard | KEEP (it's the brand) |
| Hero stats — 84 systems / 71 ATOs / 12 in queue / 9 expiring | Instant portfolio size; animates on load | KEEP (edit monthly via site-metrics.json) |
| CYBER ALERTS ticker | Scrolling band: KEV acts-now, eMASS baseline changes, policy updates, deadlines, phishing advisories; newest CISA KEV auto-inserted | KEEP |
| Today's Operating Picture | CISO standing message + mission statement, effective/review dates, approval chain | KEEP |
| CISO Standing Message block | One voice from leadership; quarterly refresh | KEEP (owner: you) |
| Metrics Snapshot — Portfolio ATO Health 84%, Open POA&M 312, In Assessment Queue 12, High-Risk Systems 6 (deltas + color tones) | The 30-second posture read | KEEP |
| Authorization Status Mix (donut: Full 58 / Conditional 7 / IATT 4 / ATC 2 / Expiring 9 / In Process 4) | Composition of the authorization base | KEEP |
| Open POA&M by Severity (bars: 23/96/141/52) | Where the risk reduction work actually sits | KEEP |
| Command Emphasis (current priorities: renewals, inspection focus, cloud governance shift, 8140 tracker, KEV remediation) | What leadership wants attention on *this month* | KEEP |
| Upcoming Events list (6 nearest events w/ links) | Next obligations | REVIEW — replace w/ expirations post-transition |
| Role-Based Entry Points (8 role cards: ISSM, ISSO, SCA, SO/PM, ENG, CISO/AODR, CTR, New) | Every persona lands on *their* tasks, not a generic sitemap | KEEP — signature feature |
| Quick Links Engine (10 direct pathways: eMASS, interactive tools, policies, templates, SOPs, dashboards, glossary, references) | One-click depth from home | KEEP |
| Phased Implementation Roadmap (10 phase cards) | The rollout plan itself, all phases marked live | CUT or compress — post-deploy this meta-content serves nobody |

### A2. FAQ & Knowledge Base (`faq.html`) — **207 answers (verified count)**
| Offering | Detail |
|---|---|
| Answers mode | 207 searchable FAQ answers from 6 modules: site (01), RMF (02), incident (03), workforce (04–05), general (06) |
| Site mode | Full-site index search across all 24 pages (pages.json: every page has title, summary, keywords, section map) |
| CCoE Glossary | Authoritative acronyms: AO, AODR, ACAS, ATO-C, CCI, CUI, FedRAMP, IATT, IL, ISSM, ISSO, POA&M, RAW, RMF, SAR, SCA, SSP, STIG + more; searchable/sortable |
| Self-triage value | The #1 deflection tool — most "who do I ask" questions die here | KEEP — flagship |

### A3. Contact (`contact.html`)
| Offering | Detail |
|---|---|
| Routing directory table (Topic / Channel / Response SLA) | Who handles what: FrontDesk, AODR, Vuln Cell, eMASS Support, Acq Cyber, ARB Intake, Workforce, Knowledge Mgr | KEEP |
| Ask the CISO (anonymous) | Direct anonymous channel; answered live last-Friday monthly session or within 2 weeks; general-interest answers publish to FAQ + weekly digest | KEEP |
| General inquiry form | Prefilled mailto to office box (currently placeholder `usarmy.orlando.cpe-st3.mbx.cybersecurity-office@army.mil` — replace w/ real box) | KEEP |
| Incident bypass note | Explicit "incidents do NOT use this page" routing | KEEP |

---

## B. RMF / OPERATIONS CORE

### B1. RMF Operations Hub (`rmf-operations.html`)
| Offering | Detail |
|---|---|
| The Seven Steps (Prepare→Categorize→Select→Implement→Assess→Authorize→Monitor) | Lifecycle skeleton with deep content per step | KEEP |
| 10 authorization pathway cards: Full ATO, IATT, Conditional ATO, ATC Only, Assess-Only, Standalone Systems, Closed-Restricted Networks, Agile ATO/Continuous Auth, ATO Extension, Reciprocity | Which path fits which situation — each a card w/ job aid | KEEP |
| Job aids & checklists (downloads: AO Package Routing Checklist, Artifact Checklists by Control Family FULL-SET xlsx, Assessment Readiness Package, FIPS-199 Categorization Worksheet, RMF Process Map PDF, Cybersecurity-101 trio) | The working paper trail | KEEP |
| Cybersecurity 101 primers (Process Guide PDF, Reference Sheet PDF, Presentation PPTX) | Onboarding artifacts for the "NEW" persona | KEEP |

### B2. Vulnerability & POA&M Management (`vulnerability-poam.html`)
| Offering | Detail |
|---|---|
| The SLA clock (KEV 7d / CAT I 15d / CAT II 30d / Medium 90d / Low 180d) | The rules of the engagement clock | KEEP |
| Open POA&M aging dashboard (10 live rows from poam.json w/ status: overdue/at-risk/on-track/review) | Named-system findings — ⚠ CUI-TIER ONLY after transition; public side must be aggregate counts | REVIEW (tier-split) |
| Finding→verified-closure engine + evidence rules + escalation triggers | The process backbone | KEEP (process content is generic) |
| Standardized entry + battle rhythm + scan cadence guidance | ConMon discipline | KEEP |

### B3. Assessment & Authorization Calendar (`assessment-calendar.html`)
| Offering | Detail |
|---|---|
| Expiration Radar (9 systems w/ pathway, days-left, stage, ISSO, track) | ⚠ Named systems w/ dates+owners = CUI-TIER detail; public side must aggregate ("6 systems inside 180d") | REVIEW (tier-split) |
| Month-grid view of events (June 2026: assessments, trainings, blackouts, decisions) | Post-transition: you want EXPIRATIONS ONLY — the grid drops to system-expiry markers | MODIFY per your direction |
| Hard milestones + auto-built .ics downloads (6 .ics today incl. ccoe-all-events.ics) | Outlook integration | KEEP + build webcal subscribe URL |
| 6 downloads (calendar .ics set) | Same | KEEP |

### B4. Threat Intelligence (`threat-intel.html`)
| Offering | Detail |
|---|---|
| This Week's Threat Picture (weekly cards from threat-week.json) | Monday-morning refresh narrative | KEEP |
| KEV→Portfolio map (which named systems each KEV touches) | ⚠ Named-system exposure — public side aggregate only | REVIEW (tier-split) |
| Raw source feeds (auto-updated twice daily: CISA KEV 1,739 entries, NVD CRITICAL 7d, MSRC CVRF, Ubuntu+Red Hat notices, Nessus plugins) | **Pipeline now FIXED & running** (was 116-day stale; auto-refresh workflow restored 4 OCT) | KEEP |
| ATT&CK techniques mapped to weak points | Threat-informed self-assessment lens | KEEP |

---

## C. LEADERSHIP & GOVERNANCE

### C1. Governance & Leadership (`governance.html`)
| Offering | Detail |
|---|---|
| Oversight Authority Model | Who decides what, explicit | KEEP |
| Cyber Governance Board (CGB) | Charter/composition of the decision body | KEEP |
| RACI tiles (RMF / changes / incidents / vulnerabilities) | "Responsible/Accountable/Consulted/Informed" per process | KEEP |
| "If It Wasn't Recorded, It Wasn't Decided" | The decision-recording rule ⚠ no decision-log artifact exists yet — add decisions.json (recommendation) | KEEP + build |
| Portfolio-in-One-Screen dashboards (ATO mix, POA&M aging, workforce metrics) | Leadership rollups; JSON-driven | KEEP |

### C2. Risk Management Center (`risk-management.html`)
| Offering | Detail |
|---|---|
| Severity Calculator (live: likelihood × impact) | Interactive: score any finding in seconds | KEEP |
| Four-factor AO decision frame (Criticality, Data Category, Connectivity, Compensating Posture) | The AO's mental model, written down | KEEP |
| Authorization Priority Score | Triage metric for queue ordering | KEEP |
| CVE→Mission Language translator (Technical Finding → System Effect → Mission Degradation) | Speak warfighter impact, not CVE jargon — gold for AODR briefs | KEEP |
| Risk registers w/ top risks + quad charts | Ready-made leader artifacts | KEEP |

### C3. Inspection & Audit Readiness (`inspection-readiness.html`)
| Offering | Detail |
|---|---|
| Master readiness checklist (documentation + operational) | The IG-day checklist | KEEP |
| 8-tab artifact binder structure | "Every system, same order" — standardizes the binder | KEEP |
| Top recurring findings w/ fixes | Where inspections actually bite | KEEP |
| Mock-inspection methodology + interview prep | Rehearsal mechanics | KEEP |

### C4. Contact/SLA note: dates hard-coded (binder countdown) → JSON-ify in release | MODIFY |

---

## D. WORKFORCE & TRAINING

### D1. Workforce Development (`workforce.html`)
| Offering | Detail |
|---|---|
| 8140 readiness tiles (91% DCWF-coded / 84% foundational / 11 grace / 37 IDPs) | Monthly-roll numbers — ⚠ hand-coded HTML today; JSON-ify in release | MODIFY |
| Role deep-dives w/ DCWF codes: ISSO 722/723, ISSM 612, SCA 801/802, System Owner/PM, Engineer, Leadership, Contractor | "Know your lane + your artifacts" — duties + artifact ownership per role | KEEP |
| "What Counts, For Whom" (common core: CUI handling, incident notification, Intro to RMF within 60 days) | The everyone-must list | KEEP |
| Tools That Move You Forward (links: 8140 Readiness Tracker XLSX, DCWF Work-Role Mapper XLSX, Cyber Range) | The actual worksheets | KEEP |
| Mentorship Program (6-month pairings, charter, checkpoints, capstone) | DEVELOP-tier program | REVIEW — real, or aspirational? |
| Rotational Opportunities (90-day rotations, endorsement + backfill plan) | SURGE-capacity program | REVIEW — real, or aspirational? |
| ACMA cross-link | Acquisition career path bridge | KEEP |

### D2. Training Academy (`training.html`) + Cyber Range (`tools/cyber-range/`)
| Offering | Detail |
|---|---|
| 30 courses across 3 tiers (Build the Base / Run the Mission / Lead the Program) | Structured curriculum | REVIEW — course content real? |
| 31 range course modules (AC-301…AC-331, verified files in repo) | Actual runnable modules in the console | KEEP (strongest differentiator) |
| Knowledge checks + 80% capstone per course | Credential-style rigor | KEEP |
| "Practice on Fiction, Perform on Fact" doctrine | Range = fiction, prod = fact | KEEP |
| "Learn From the Rejection Pile" | Actual rejected-package artifacts as teaching material | KEEP — unique |

### D3. ACMA Resource Center (`acma.html`)
| Offering | Detail |
|---|---|
| DACM chartering policy (PDF, official Feb 2022 memo) | Governing doc | KEEP |
| What an ACMA is/isn't, who does what | Role clarification | KEEP |
| DAWIA certification tiers + CLP rules | Career mechanics | KEEP |
| Annual battle rhythm + official-source list (12 ext. links) | Every official link, one page | KEEP |
| ACMA Nomination Memo template (DOCX) | Ready to use | KEEP |

### D4. Community & Office Hours (`community.html`)
| Offering | Detail |
|---|---|
| 5 standing Teams office hours (eMASS Open Lab, RMF Clinic, Vuln & POA&M Surgery, ARB Pre-Brief, Ask the CISO) | Drop-in help, no appointment | REVIEW — cadence real? |
| 4 Communities of Practice (ISSO Forum, Assessors' Roundtable, Cloud & DevSecOps Guild, OT/Standalone Circle) | Peer groups | REVIEW — real communities? |
| Q2 FY26 Honors | Recognition wall | REVIEW |
| Weekly Posture | Digest teaser | KEEP w/ newsletter |

---

## E. TOOLS, AGENTS & AI

### E1. Tools & Systems Portal (`tools-dashboards.html`)
| Offering | Detail |
|---|---|
| Command Center Snapshot (live from site-metrics.json: auth mix donut, POA&M severity bars, nearest expirations, needs-attention worklist) | Same data as home, tool-context | KEEP |
| Purpose-built apps: VulneraSight, Aegis.AI, Cyber Range Console, AI Prompt Library | Home-grown suite | KEEP |
| The Tools You'll Actually Use: eMASS (access workflow: CAC+CBT+ISSM sponsorship, ~5-day provisioning), ACAS/Tenable, SCC 1.3, STIG Viewer, Power BI, SharePoint/Teams, NICCS | The real toolbelt w/ purposes | KEEP |
| Standard Access Workflow (Prerequisites→Sponsorship→Provisioning→Recertification) | The how-to-get-a-tool path | KEEP |

### E2. VulneraSight (`tools/vulnerasight/`)
| Offering | Detail |
|---|---|
| Threat-informed analysis: correlates ACAS/Nessus findings + STIG .ckl against threat context; drafts reviewable POA&M narratives | The triage accelerator | KEEP |

### E3. Aegis.AI Risk Command (`tools/aegis-ai/`)
| Offering | Detail |
|---|---|
| Executive decision support: portfolio risk posture, budget optimization, AI-drafted authorization memos (human-signed) | The leadership dashboard app | KEEP |

### E4. AI & Automation Center (`ai-automation.html`)
| Offering | Detail |
|---|---|
| Rules before tools: Permitted (approved platforms only) vs Prohibited — No Exceptions lists | The AI guardrail policy on one page | KEEP |
| 5 reviewable-draft prompt patterns (Control Narrative, Policy Plain-Language Summary, POA&M Milestone Decomposition, Tabletop Inject Generator, AAR First Draft) + NotebookLM Study Pack | Copy-ready prompts | KEEP |
| Automation intake (Submit→Triage→Build & Govern) | Paper-trail for new ideas | KEEP |
| Cybersecurity AI Prompt Library (hosted external app, Cloud Run) | The vetted prompt catalog | KEEP — ⚠ .mil reachability check |

### E5. Agent Catalog (`agent-catalog.html`)
| Offering | Detail |
|---|---|
| 12 approved AI agents w/ purpose + owner + Request-Access email flow: RMF Package Drafter, POA&M Triage Assistant, Threat Intel Synthesizer, STIG Compliance Checker, Risk Memo Drafter, ConMon Collector, Secure Blueprint Generator, Inspection Readiness Validator, 8140 Workforce Mapper, Phishing Analysis, Acquisition Cyber Language, Tabletop Exercise Generator | The AI workforce directory | KEEP — verify each agent EXISTS before launch (see honesty audit below) |

---

## F. CONTRACTS, ENGINEERING, POLICY, REFERENCE

### F1. Acquisition Cyber Support (`acquisition.html`)
| Offering | Detail |
|---|---|
| 9-clause library (RMF baseline, secure coding, CUI safeguarding, incident SLA, deliverables list, acceptance criteria, FedRAMP/IL residency, personnel access, departure) | Copy-paste SOW language | KEEP |
| Minimum Cyber Deliverable Set + Cost Estimating Guide | What "done" means at delivery | KEEP |
| 4 acquisition touchpoints (Market Research/RFI, SOW Drafting, Source Selection, Deliverable QA) | Where cyber plugs into contracts | KEEP |

### F2. Engineering & Secure Design (`engineering.html`)
| Offering | Detail |
|---|---|
| 6 reference architectures that already passed (Three-Tier Enclave, IL4/IL5 Cloud, Standalone/Closed, OT/Range, DevSecOps, XR/Sim) | Not theory — blueprints w/ precedent | KEEP |
| Non-negotiables (IAM, Logging, Crypto standards) | Design floor | KEEP |
| STIG Execution Handbook | From commit to authorized | KEEP |
| ARB intake | Architecture review routing | KEEP |

### F3. Policy Library (`policies.html`) — **14 controlled documents, all present as DOCX**
RMF Execution Policy v4.0 · Change Management Rubric v3.2 · Continuous Monitoring Parameters v2.7 · Vulnerability Mgmt Windows v3.0 · POA&M Lifecycle v2.4 · Standalone Boundaries SOP v1.8 · Closed Network Audit v1.5 · Cloud Governance IL2–IL6 v3.0 · CUI Handling v2.2 · Incident Response v3.1 · SCRM/SBOM v1.6 · Emerging AI Governance v1.0 · OT/XR/AR/VR v1.3 · Reciprocity Acceptance v1.7  → KEEP ALL (version-controlled, supersede lines on each card)

### F4. References & Authorities (`references.html`) — **36 documents, all linked to publisher source**
DoD issuances (6): DoDI 8500.01, DoDI 8510.01, DoDD 8140.01, DoDI 8140.02, DoDM 8140.03, Issuances Portal · Army (6): AR 25-2, DA PAM 25-2-14/-5/-9/-12, Army Pubs portal · NIST (15): FIPS 199/200, SP 800-18/-30/-37/-39/-53/-53A/-53B/-60/-137/-160/-171/-172, CSF 2.0 · CNSSI 1253 · MITRE (4): ATT&CK, D3FEND, CVE, CWE · CISA/DISA (4): KEV, KEV feed, DISA STIGs, DoD Cyber Exchange → KEEP ALL

### F5. Templates & Artifacts (`templates.html`) — **33 files, every artifact in blank + gold-standard pairs**
AO Decision Briefing (EXAMPLE / QUAD CHART / SLIDES) · AO Package Routing Checklist · Artifact Checklists xlsx (full set) · Assessment Readiness Package (BLANK/GOLD) · Control Implementation Statement Frames (BLANK/GOLD) · Cybersecurity-101 trio · Executive Risk Summary RAW (BLANK/GOLD) · FIPS-199 Worksheet (BLANK/GOLD) · HW/SW Inventory (BLANK/GOLD) · Minor Change Memo (BLANK/GOLD) · POA&M Closure Evidence Forms (BLANK/GOLD) · RMF Process Map PDF · Risk Acceptance Memorandum (BLANK/GOLD) · SSP Language Blocks (BLANK/GOLD/GOLD-PDF) · Significant Change Request (BLANK/GOLD) · Boundary & Data Flow (STENCIL/GOLD) · System Divestment Checklist → KEEP ALL (this is the site's single most-used section in any org)

### F6. Media Hub (`media.html`) — 8 executive CISO articles + 6 podcast/video series (external links)
External articles (Cyber Magazine, SC World, Gartner…) + AI Security Ops weekly podcast, AI Security Brief, AI Hacks… → REVIEW — these are public-internet thought-leadership, fine on both tiers; keep if you want the CISO "voice" section, cut if you want pure ops focus |

### F7. Newsletters (`newsletters/`) — 4 issues (W21–W24, ends mid-June)
Weekly digest archive w/ KEV act-now, binder deadlines, mock-inspection schedule → ⚠ 15 weeks stale — either revive as the comm channel for launch or hide until real. CUT the "4 issues" count from any banner until cadence is real |

---

## H. DOWNLOADS MASTER LIST (verified on disk — 50 unique files)
- `templates/` — 33 files (listed in F5)
- `tabletops/` — 5 files: Ransomware (LOGNET-04), CUI Spill Cross-Domain, Insider Data-Staging, Lost Laptop TDY + ALL.ZIP
- `policies/` — 14 DOCX (listed in F3)
- `tools/` — 2: 8140-Readiness-Tracker.xlsx, DCWF-Work-Role-Mapper.xlsx
- `acma/` — 2: DACM policy PDF, nomination memo template
- `calendar/` — 6 generated .ics

## I. INTERACTIVE / DYNAMIC LAYER (the "live site" part)
| Mechanism | Status |
|---|---|
| site-metrics.json → home + tools + governance | ✅ working, JSON-driven |
| ticker.json + auto-KEV insert | ✅ working |
| poam.json → live finding table (⚠ named systems) | ✅ working |
| calendar.json → grid + .ics build | ✅ working |
| threat-week.json → weekly cards | ✅ working |
| 6 FAQ modules (207 answers) + pages.json full-site search | ✅ working |
| data/auto feeds (KEV/NVD/MSRC/Linux/Nessus) | ✅ FIXED 4 OCT — auto-refresh workflow restored, feeds live (was 116 days stale) |
| .ics generation (build_ics.py) | ✅ pipeline-coupled — needs .mil CI job |

---

## J. HONESTY AUDIT — verify BEFORE workforce launch (the credibility list)
1. **Office hours / CoPs / mentorship / rotations** — are the Teams meetings real and staffed? An empty calendar link burns trust.
2. **Agent Catalog (12 agents)** — does each agent exist with a real owner? Any "coming soon" must be marked as such.
3. **Training Academy (30 courses)** — 31 range modules exist as files; verify Academy page claims match what's actually deliverable.
4. **Metrics (84/71/12/9, 91%/84%, 312 POA&M…)** — all currently seed values; do the first REAL monthly roll before showing leadership.
5. **Newsletter cadence** — revive or hide.
6. **Placeholder email** — `usarmy.orlando.cpe-st3.mbx.cybersecurity-office@army.mil` in 3 mailto links → swap before launch.
7. **CUI exposure check (pre-.mil)** — named systems + ISSO identities + POA&M narratives + expiration dates w/ owners: aggregate on public, detail on .mil only.