# CCoE Operational Hub

Static demonstration site for the Cybersecurity Center of Excellence operational hub
(UNCLASSIFIED demonstration environment — all systems and data are fictional).

* **Serve it:** any static host (GitHub Pages works as-is). Local preview: `python3 -m http.server 8000`.
* **Update content:** edit the JSON files in `data/manual/` — see [HOW-TO-UPDATE.md](HOW-TO-UPDATE.md).
* **Live feeds:** `data/auto/` is refreshed twice daily by the `Update live data feeds`
  GitHub Action (CISA KEV, NVD, MSRC, Ubuntu, Red Hat, Tenable). Enable read/write
  workflow permissions in repo settings for the auto-commit to work.
* **Downloads:** real template/tool files live under `assets/downloads/`.
