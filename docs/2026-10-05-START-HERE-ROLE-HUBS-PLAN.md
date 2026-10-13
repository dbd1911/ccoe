# PLAN — "Start Here" Per-Role Day-One Hubs

**Prepared for CISO review · 5 OCT 2026 · PLAN ONLY — no site changes made**

---

## The problem you diagnosed (and it's real)

You're right on both counts:

1. **The role cards blur together.** On `workforce.html`, ISSO and ISSM both link to `rmf-operations.html`. Product Manager also lands on `program-roles.html` (same as PM, same as Chief Engineer nearly). The cards *describe* different lanes but *deliver* the same destination. A new ISSO and a new ISSM click different buttons and see the same generic RMF process page — no personalization, no role lens.

2. **The site has process content, not role onboarding.** What exists today: the Seven Steps, job aids, 101 primers, generic tool access. What doesn't exist anywhere: *"You are the new ISSO for SYSTEM-X. Here is literally what you do on Monday."* The closest artifact is the inspection binder standard, which is about evidence, not people.

The fix concept: **role-specific "Start Here" hubs** that answer the three questions you listed — *What is my job? What do I need for day one? What resources exist?* — from INSIDE that role's perspective, then route to the shared process content (which stays shared, no duplication).

---

## Proposed architecture: one page, six lanes (or six pages)

**Two shape options — decision point A for you:**

| Option | Shape | Pros | Cons |
|---|---|---|---|
| **A. Single "Start Here" page, anchored per role** | One new page `start-here.html`, with anchored sections (#isso, #issm, #isse, #pm, #chen, #acto…) | One nav item; shared Day-1 admin checklist written once at the top; role sections follow; fastest to build (~1 day) | URL looks generic; sections can get long |
| **B. Six role pages** | `start-isso.html`, `start-issm.html`, `start-pm.html`, `start-chen.html`, `start-se.html`, `start-aodr.html` | Each URL shareable directly in an onboarding email ("read this before Monday"); per-role nav feels tailor-made; can grow rich without crowding | 6x the maintenance; shared content risks diverging; slower build |

**My recommendation: Option A with anchors** for MVP speed + zero duplication, with the *option* to split later once a lane earns its own page. The role buttons on `index.html` / `workforce.html` then link `start-here.html#isso`, `start-here.html#issm`, etc. — same site, sharp landing.

---

## What each role section MUST answer (content design)

Every role section follows the same **four-part skeleton** so the site feels systematic, not ad hoc. This structure IS the product — a new hire learns the *shape* of their job from the shape of the page.

### Part 1 — "What is my job?" (the mandate)
- One-paragraph role charter in plain language (not RMF jargon)
- What you own vs. what you support vs. what you escalate (three-column: OWN / SUPPORT / ESCALATE)
- Your DCWF code + where your qualification requirements live (8140.03 matrix)
- Who you work FOR and who works FOR you (the authority chain — PM→CHEN→LPE→ISSE→ISSO→ISSM→AODR→AO, drawn per role)
- "A day in the life" — a short honest rhythm block (what a typical Monday looks like)

### Part 2 — "Day one: the first 10 days" (the startup checklist)
This is the piece everything else hangs on. Two tables per role:

**(a) Access & accounts checklist** — what to request, from whom, and in what order (these have SLAs, so order matters):
- CAC enablement / CBT prereqs / ISSM sponsorship letters / eMASS account (5-day SLA) / ACAS, SCC, STIG Viewer reads / SharePoint+Teams groups / email distros / the vault or CUI-enabled storage
- Each row: *what · who approves · SLA · link to the access workflow*

**(b) Read-first list** — roughly 6 documents in reading order, each with *why this one matters to YOUR role*:
- e.g., new ISSO: RMF Execution Policy → the SLA clock page → SSP Standard Language Blocks → your systems' POA&M rows → the ConMon parameters → the incident call order card
- e.g., new PM: the 801 Career Pathway playbook → AR 70-1 cyber decision points → the 9-clause library → the AO authority model → the expiration calendar (what your systems owe)
- e.g., new CHEN: SP 800-160 (skim ch. 1–3) → the 6 reference architectures → the non-negotiables → ARB intake mechanics
- e.g., new ISSM: the 722 Career Pathway playbook → the CGB charter → POA&M lifecycle policy → the change-management rubric → inspection binder standard

### Part 3 — "The ongoing rhythm" (the battle rhythm)
- A weekly / monthly / quarterly rhythm table specific to the role: what you do daily (scan review, ConMon artifacts), monthly (Aging reviews, metrics roll, 8140 tracker update), quarterly (CCRR data locks, binder self-audit), semi-annual/annual (IDP check, recertifications)
- This is where the "how do I strategize" answer lives — the rhythm IS the strategy

### Part 4 — "Your toolkit + who to call" (the resources)
- The role's specific tools from the belt (with real links)
- The routed contacts from the contact directory, filtered to YOUR likely needs (i.e., an ISSO routes to eMASS support and the vuln cell; a PM routes to acquisition cyber and the ARB)
- The 3–5 FAQ module answers a new person in this role asks first (curated, not the full 207)
- The playbook: DoD CCP PDF for the role's DCWF code + DAU playlist link (already built for most roles)

---

## The "shared Day-1 block" (top of the page, before role sections)
Written once, applies to every role, and kills 80% of new-hire confusion:
- The 60-day common core (CUI handling, incident notification, Intro to RMF) — who schedules it, where
- The physical/logistics stuff nobody tells you: badge access to the SCIF, which network you're on (NIPR vs enclave), VPN, CAC chip reuse, where policies live (this site!), how to meet your ISSM/ISSO counterpart
- A plain-English 60-second orientation to the org: CISO → AODR → ISSM → ISSO / PEO → PM → CHEN → LPE → ISSE — "here's the map, here's where YOU sit"
- A printable one-pager (the "welcome card") — role name, your first 5 actions, your first 5 contacts

---

## Distinct content per role (no hand-waving, what's genuinely DIFFERENT)

| Role | The unique "Day-1" spine | The unique rhythm | Unique resources |
|---|---|---|---|
| **ISSO (721)** | Assume systems in eMASS, read their SSPs, walk the controls with the ISSE, meet ConMon cadence | Daily: scan review + artifacts · Monthly: aging reviews · Quarterly: binder self-audit | Vulnerability & POA&M page, SLA clock, ConMon parameters, STIG Viewer, ACAS reads |
| **ISSM (722)** | Chart the portfolio, read every SSP w/ the ISSE, meet each PM, set the escalation map | Weekly: package routing · Monthly: governance prep, metrics roll + 8140 update | Governance page, CGB charter, POA&M lifecycle, change rubric, 722 playbook |
| **ISSE (SP 800-160)** | Read the architectures that are approved, shadow an ARB, review one boundary diagram | Weekly: design reviews · Per-change: inheritance analysis + STIG-ability scan | Engineering page (6 architectures), SP 800-160, ARB intake, 801/802 pathway PDFs for context |
| **PM (801)** | Cyber requirements in the contract, risk posture of the increment, ISSE/ISSM introductions, AAF gate map | Weekly: cyber deliverables check · Monthly: risk posture to AODR · Quarterly: binder readiness | program-roles.html (already built), 9-clause library, cost-estimating guide, 801 playbook |
| **APM (801-support)** | The deliverables tracker, POA&M funding map, test-evidence calendar | Weekly: deliverables triage · Monthly: contract cyber SLA check | Same hub (anchored #apm for the deputy lens) |
| **Product Mgr (803)** | The backlog's secure-by-design items, user-facing security behaviors, pipeline attestations | Per-increment: security stories | Same hub (#product lens) |
| **CHEN (641 + 160)** | The technical baseline, open ARB actions, non-negotiables compliance postures, ISSE alignment | Weekly: design sync · Per-gate: architecture review | engineering.html, 6 archetypes, ARB intake, DISA STIG floor |
| **LPE (802)** | Integration evidence pipeline (scans, attestations, test artifacts) — the delivery gate | Weekly: integration risk · Per-dr: evidence package | 802 playbook, inspection binder (they will be judged on THIS), tool belt |
| **AO/AODR (611)** | The delegation memo, portfolio risk posture, queue depth | Weekly: AODR package review · Quarterly: CGB data lock | governance.html, 611 playbook + playlist, Risk Center, decision log (future) |

---

## What I need from you (decision points)

1. **Shape:** Option A (one page + anchors, my recommendation for speed) or Option B (six pages)? Or 3 pages (cyber / program / engineering-leadership)?
2. **Scope for MVP:** which roles are in the launch cut? (My suggested priority: ISSO + ISSM + PM + CHEN first — the four you named — then ISSE, Product Mgr, LPE, AODR in wave 2.)
3. **The rhythm content:** how honest can I get? The "Day in the life" works best with REAL cadence (meeting names, actual SLAs from your org). I have invented placeholders — do you want to fill from your real battle rhythm, or ship placeholders labeled "example rhythm — your ISSM will calibrate"?
4. **The welcome card** (printable Day-1 one-pager): include in MVP, or wave 2?
5. **Link the role buttons here:** when this ships, `workforce.html` and `index.html` role cards point to `start-here.html#ROLE` instead of their current hubs (process pages stay as *deeper* resources linked FROM each section). Confirm that's the intent — the "Start Here" page becomes the landing spot, process pages become reference.
6. **Name it:** "Start Here" / "New to the Role" / "Day One" / something else? (Nav label + card title.)

---

## What this does NOT touch (scope guard)
- The RMF process pages, policy library, templates, tool belt: they stay exactly as they are — they become the *deeper layer* the Start-Here page routes people into. Nothing duplicated, nothing orphaned.
- The expirations-only / CUI-tier / env-links decisions from earlier: still queued, still your call — this plan is additive.

**Estimated build for recommended Option A (MVP, 4 roles):** ~1 session. Full 8-role cut: slightly longer. All content is new writing — honest, role-specific, and tied to real pages + real downloads already on the site.