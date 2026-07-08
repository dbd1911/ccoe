# Training Academy — Revision, Repair & QA Report

**Scope:** Full overhaul of the CSO Cyber Range Training Academy (`tools/cyber-range/`),
all 30 courses, site functionality, and every downloadable template/artifact.
**Verification date:** 2026-07-08
**Method:** Node structural validator + headless Chromium (Playwright) end-to-end
drive of the live LMS + OOXML/PDF/ZIP integrity checks + site-wide link and page
smoke tests.

---

## 1. Courses — 15 modules each ✅

All **30** courses now contain exactly **15 fully developed modules** (450 modules total).
Verified by `tools/cyber-range/courses/_validate.js` (every course reports
`OK (15 mods, 10 cap)`) and re-confirmed in-browser against the loaded
`COURSE_DATA` (all 30 report `mods === 15`).

Each module contains: a title + summary, ≥3 learning objectives, ≥2 substantial
reading passages, an applied worked example, ≥2 assigned references, and a required
3-item knowledge check with per-item explanations.

- **Reading:** 1,008 reading passages, ~783,000 characters total (avg ~776 chars/passage;
  every module's combined reading exceeds the 600-char floor — most run far longer).
- Tiers: Beginner (BC-101…110), Intermediate (IC-201…210), Advanced (AC-301…310).

## 2. Lengthy reading + functioning knowledge check per module ✅

Every one of the 450 modules has both lengthy assigned reading and a functioning,
required knowledge check (1,350 per-module KC questions authored in total). In the
live engine, opening any module renders the reading, worked example, references, and
the gated knowledge check; the module cannot be marked complete until every KC item
is answered (verified end-to-end).

## 3. Knowledge checks — two-attempt rule ✅

The knowledge-check state machine (`kcSelect` / `kcCheck` / `kcNext` in
`tools/cyber-range/index.html`) enforces the required behavior, verified live in a
headless browser:

- Answers are **never revealed up front**.
- The learner **must select an answer** before advancing (blocked otherwise).
- **1st wrong answer →** "Not quite… try once more (1 attempt remaining)" — the
  correct answer is **not** shown.
- **2nd wrong answer →** the correct answer is revealed **with a brief explanation**,
  and the learner may continue.
- A correct answer is accepted immediately (with its explanation).

Applied consistently across every module in every course.

## 4. Capstone — 40 questions, 80% to pass ✅

Every course builds a **40-question capstone** (`buildCourseCapstone`): 2 items drawn
from each of the 15 module KC banks (30, guaranteeing full-module coverage) + 10
scenario/application/analysis items from the course's dedicated capstone bank. Verified
live for all 30 courses (`buildCourseCapstone(...).length === 40`).

Pass threshold is **80%** (`submitExam`): end-to-end drive confirmed an all-correct
attempt scores 100% → **Pass — Certified** (certificate issued to the credentials
wallet), and an all-wrong attempt scores below threshold → **Below threshold** with an
incorrect-item review. Capstone stays **locked** until all 15 modules are complete.

Capstone items emphasize scenario-based decision-making, application, and analysis —
the 300 capstone-bank items are predominantly "SCENARIO:" prompts, not recall.

## 5. Site loads and all core pages accessible ✅

- **Root cause of the blank site** (prior state): render-blocking external resources and
  no deployment path. Fixed earlier in this branch — Google Fonts made non-render-blocking
  (`media="print"` swap + `<noscript>` fallback), jsPDF lazy-loaded, GitHub Pages workflow
  + `.nojekyll` added.
- The Cyber Range LMS renders on load (auth screen → dashboard → catalog → course →
  module → capstone → credentials) with **no JavaScript errors**.
- All **22 top-level site pages** load clean (index, training, templates,
  assessment-calendar, and the rest) — verified headless.
- Navigation, course catalog (30 cards), course pages (15 module rows), module pages,
  knowledge checks, capstone assessments, downloads page, and credentials all function.

> The only blocked network request in the sandbox is the external Google Fonts
> stylesheet (proxy-blocked here). It is **non-render-blocking with a system-font
> fallback**, so it does not affect rendering and resolves normally on GitHub Pages.

## 6. Downloadable templates & artifacts — repaired, tested, verified ✅

- **62** downloadable files under `assets/downloads/` (templates, policies, tabletops,
  ACMA, tools, calendar).
- **49 Office files** (.docx/.xlsx/.pptx) were **repackaged into canonical OOXML form**
  — `[Content_Types].xml` moved to the first ZIP entry and stray directory entries
  removed, matching what Word/Excel/PowerPoint emit. This fixes the most likely cause of
  the reported "corrupted/unreadable" files: strict viewers (Google Drive / Quick Look
  preview, some Office builds) reject non-canonical OOXML packaging. Document content was
  preserved byte-for-byte.
- Post-repair validation: all 49 Office files pass ZIP CRC, contain a valid
  `[Content_Types].xml`, have their required main part, and every XML part is well-formed.
  Extracted text confirms real, professionally formatted content aligned to course topics
  (RMF, POA&M, FIPS-199, SSP language, risk acceptance, AO briefings, etc.).
- **PDFs** (valid `%PDF` header + `%%EOF`), **ZIPs** (pass `unzip -t`), and **ICS**
  calendar files (valid `VCALENDAR`) all verified readable.
- **Every download link resolves.** All 66 `assets/downloads/...` links across the site
  point to files that exist and serve HTTP 200 (the single "unresolved" hit was a
  runtime JS template literal in `assessment-calendar.html`, not a static link — its
  generated `.ics` paths all exist on disk).

---

## Remaining issues / blockers / assumptions

1. **`training.html` illustrative cards** — the CCoE hub landing page (`training.html`,
   distinct from the Cyber Range LMS) shows a handful of *illustrative* "popular course"
   cards with sample titles (RMF Fundamentals, eMASS Execution, …), mock completion bars,
   and small module counts ("6 modules", "4 modules"). These are **not** the 30 academy
   courses and do not map to them. They were left as illustrative UI rather than
   rewritten, to avoid fabricating module counts for courses that don't exist in the
   catalog. If you'd prefer, these can be updated to reference real academy courses or
   have the mock counts removed — flagging as an assumption, not a defect.
2. **External Google Fonts** are proxy-blocked in this sandbox (non-render-blocking, with
   fallback). They load normally on GitHub Pages; no action needed.
3. **Progress storage** uses `localStorage` with an in-memory fallback; learner progress
   is per-browser (by design for a static, no-backend deployment).
4. **Offensive-security content** (AC-303 red-team, AC-307 malware analysis) is authored
   strictly for **authorized, defensive** contexts (detection, IR, threat intel) and is
   framed accordingly throughout.

## Production readiness

The academy is complete, internally consistent, and learner-ready: 30 courses ×
15 modules with lengthy reading, applied examples, and two-attempt gated knowledge
checks; a 40-question, 80%-to-pass capstone per course; a fully functioning site; and
62 verified, non-corrupted, professionally formatted downloadable artifacts.
