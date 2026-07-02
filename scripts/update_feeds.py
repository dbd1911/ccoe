#!/usr/bin/env python3
"""
CCoE Hub — automatic external feed updater.

Pulls fresh data from official public sources and writes compact JSON files
into data/auto/ for the site to render client-side. Runs on a schedule via
.github/workflows/update-data.yml — no manual steps required.

Sources (all free, no API keys required):
  * CISA Known Exploited Vulnerabilities catalog (JSON)
  * NVD CVE API 2.0 — recent CRITICAL CVEs (JSON)
  * MSRC CVRF API v3.0 — latest Microsoft monthly security release (JSON)
  * Tenable — newest Nessus plugins (RSS)
  * Ubuntu Security Notices API (JSON)
  * Red Hat Security Data API — recent CVEs affecting RHEL (JSON)

Design rules:
  * Standard library only (portable to any GitHub Actions runner).
  * Every feed is independent: a failure in one never blocks the others,
    and on failure the previous JSON file is left untouched.
"""

import json
import re
import sys
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUTO = ROOT / "data" / "auto"
MANUAL = ROOT / "data" / "manual"
AUTO.mkdir(parents=True, exist_ok=True)

UA = "CCoE-Hub-Feed-Updater/1.0 (+static site data refresh)"
NOW = datetime.now(timezone.utc)


def fetch(url, accept="application/json", timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def fetch_json(url, timeout=60):
    return json.loads(fetch(url, timeout=timeout).decode("utf-8", "replace"))


def write(name, payload):
    payload["_updated"] = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    path = AUTO / name
    path.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  wrote {path.relative_to(ROOT)}")


def step(label, fn):
    print(f"[{label}]")
    try:
        fn()
        return True
    except Exception as e:  # noqa: BLE001 — keep other feeds running
        print(f"  !! {label} failed: {e}", file=sys.stderr)
        return False


# ---------------------------------------------------------------- CISA KEV
def update_kev():
    url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
    cat = fetch_json(url)
    vulns = cat.get("vulnerabilities", [])
    recent = sorted(vulns, key=lambda v: v.get("dateAdded", ""), reverse=True)[:15]

    # Cross-check the CVEs your team tracks in the manual KEV→portfolio map.
    tracked = set()
    tw = MANUAL / "threat-week.json"
    if tw.exists():
        tracked = {r.get("cve") for r in json.loads(tw.read_text()).get("kev_map", [])}
    crosscheck = [
        {
            "cveID": v.get("cveID"),
            "dateAdded": v.get("dateAdded"),
            "dueDate": v.get("dueDate"),
            "vulnerabilityName": v.get("vulnerabilityName"),
            "knownRansomwareCampaignUse": v.get("knownRansomwareCampaignUse"),
        }
        for v in vulns if v.get("cveID") in tracked
    ]

    write("kev.json", {
        "source": "CISA Known Exploited Vulnerabilities Catalog",
        "source_url": "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
        "catalogVersion": cat.get("catalogVersion"),
        "dateReleased": cat.get("dateReleased"),
        "total": cat.get("count", len(vulns)),
        "recent": [
            {
                "cveID": v.get("cveID"),
                "vendorProject": v.get("vendorProject"),
                "product": v.get("product"),
                "vulnerabilityName": v.get("vulnerabilityName"),
                "dateAdded": v.get("dateAdded"),
                "dueDate": v.get("dueDate"),
                "knownRansomwareCampaignUse": v.get("knownRansomwareCampaignUse"),
                "shortDescription": (v.get("shortDescription") or "")[:220],
            }
            for v in recent
        ],
        "tracked_crosscheck": crosscheck,
    })


# ---------------------------------------------------------------- NVD CVEs
def update_cves():
    start = (NOW - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S.000+00:00")
    end = NOW.strftime("%Y-%m-%dT%H:%M:%S.000+00:00")
    url = ("https://services.nvd.nist.gov/rest/json/cves/2.0?"
           + urllib.parse.urlencode({
               "pubStartDate": start, "pubEndDate": end,
               "cvssV3Severity": "CRITICAL", "resultsPerPage": "60",
           }))
    data = fetch_json(url, timeout=90)
    items = []
    for entry in data.get("vulnerabilities", []):
        c = entry.get("cve", {})
        metrics = c.get("metrics", {})
        score, vector = None, ""
        for key in ("cvssMetricV31", "cvssMetricV30"):
            if metrics.get(key):
                cd = metrics[key][0].get("cvssData", {})
                score, vector = cd.get("baseScore"), cd.get("vectorString", "")
                break
        desc = next((d.get("value", "") for d in c.get("descriptions", [])
                     if d.get("lang") == "en"), "")
        items.append({
            "id": c.get("id"),
            "published": (c.get("published") or "")[:10],
            "score": score,
            "vector": vector,
            "description": desc[:240],
        })
    items.sort(key=lambda x: (x["score"] or 0, x["published"]), reverse=True)
    write("cves.json", {
        "source": "NVD (NIST) — CRITICAL severity CVEs published in the last 7 days",
        "source_url": "https://nvd.nist.gov/vuln/search",
        "window_days": 7,
        "total_in_window": data.get("totalResults", len(items)),
        "items": items[:12],
    })


# ---------------------------------------------------------------- MSRC KBs
def update_mskb():
    updates = fetch_json("https://api.msrc.microsoft.com/cvrf/v3.0/updates")
    releases = updates.get("value", [])
    releases.sort(key=lambda r: r.get("InitialReleaseDate", ""), reverse=True)
    latest = releases[0]
    doc_id = latest.get("ID")
    cvrf = fetch_json(f"https://api.msrc.microsoft.com/cvrf/v3.0/cvrf/{doc_id}")

    vulns = cvrf.get("Vulnerability", []) or []
    kb_seen, kbs = set(), []
    exploited_likely = []
    for v in vulns:
        cve = v.get("CVE", "")
        title = (v.get("Title") or {}).get("Value", "")
        threats = v.get("Threats") or []
        exploit_txt = " ".join(
            (t.get("Description") or {}).get("Value", "") for t in threats
        )
        if "Exploitation More Likely" in exploit_txt or "Exploited:Yes" in exploit_txt.replace(" ", ""):
            exploited_likely.append({"cve": cve, "title": title[:120]})
        for rem in (v.get("Remediations") or []):
            desc = (rem.get("Description") or {}).get("Value", "")
            if re.fullmatch(r"\d{7}", desc or "") and desc not in kb_seen:
                kb_seen.add(desc)
                kbs.append({"kb": f"KB{desc}", "url": rem.get("URL") or
                            f"https://catalog.update.microsoft.com/Search.aspx?q=KB{desc}"})

    write("mskb.json", {
        "source": "Microsoft Security Response Center (MSRC) CVRF v3.0",
        "source_url": f"https://msrc.microsoft.com/update-guide/releaseNote/{doc_id}",
        "release_id": doc_id,
        "release_title": (cvrf.get("DocumentTitle") or {}).get("Value", doc_id),
        "release_date": latest.get("InitialReleaseDate", ""),
        "cve_count": len(vulns),
        "kb_count": len(kbs),
        "kbs": kbs[:14],
        "exploitation_more_likely": exploited_likely[:10],
    })


# ------------------------------------------------------------- Linux KBs
def update_linuxkb():
    out = {"source": "Ubuntu Security Notices + Red Hat Security Data API",
           "ubuntu_url": "https://ubuntu.com/security/notices",
           "redhat_url": "https://access.redhat.com/security/security-updates/security-advisories",
           "ubuntu": [], "redhat": []}

    try:
        u = fetch_json("https://ubuntu.com/security/notices.json?limit=10&order=newest")
        for n in u.get("notices", [])[:10]:
            out["ubuntu"].append({
                "id": n.get("id"),
                "title": (n.get("title") or "")[:160],
                "published": (n.get("published") or "")[:10],
                "cves": [c.get("id") for c in (n.get("cves") or [])][:6],
                "url": f"https://ubuntu.com/security/notices/{n.get('id')}",
            })
    except Exception as e:  # noqa: BLE001
        print(f"  !! ubuntu sub-feed failed: {e}", file=sys.stderr)

    try:
        after = (NOW - timedelta(days=10)).strftime("%Y-%m-%d")
        r = fetch_json(f"https://access.redhat.com/hydra/rest/securitydata/cve.json?after={after}&per_page=10")
        for c in r[:10]:
            out["redhat"].append({
                "cve": c.get("CVE"),
                "severity": c.get("severity"),
                "public_date": (c.get("public_date") or "")[:10],
                "description": (c.get("bugzilla_description") or "")[:180],
                "url": f"https://access.redhat.com/security/cve/{c.get('CVE')}",
            })
    except Exception as e:  # noqa: BLE001
        print(f"  !! redhat sub-feed failed: {e}", file=sys.stderr)

    if not out["ubuntu"] and not out["redhat"]:
        raise RuntimeError("both Linux sub-feeds failed")
    write("linuxkb.json", out)


# --------------------------------------------------------- Nessus plugins
def update_nessus():
    raw = fetch("https://www.tenable.com/plugins/feeds?sort=newest&type=nessus",
                accept="application/rss+xml, application/xml, text/xml")
    root = ET.fromstring(raw)
    items = []
    for it in root.iter("item"):
        def txt(tag):
            el = it.find(tag)
            return (el.text or "").strip() if el is not None else ""
        title = txt("title")
        link = txt("link")
        pub = txt("pubDate")
        m = re.search(r"/plugins/nessus/(\d+)", link)
        items.append({
            "id": m.group(1) if m else None,
            "title": title[:160],
            "link": link,
            "published": pub,
        })
        if len(items) >= 12:
            break
    if not items:
        raise RuntimeError("no items parsed from Tenable RSS")
    write("nessus.json", {
        "source": "Tenable — newest Nessus plugins",
        "source_url": "https://www.tenable.com/plugins/newest",
        "items": items,
    })


def main():
    results = {
        "kev": step("CISA KEV", update_kev),
        "cves": step("NVD critical CVEs", update_cves),
        "mskb": step("Microsoft security updates", update_mskb),
        "linuxkb": step("Linux security notices", update_linuxkb),
        "nessus": step("Nessus newest plugins", update_nessus),
    }
    meta = {"feeds": results}
    write("meta.json", meta)
    # Exit 0 even on partial failure — a bad feed day must not break the site
    # or the workflow; stale-but-valid data stays in place.
    print("done:", results)


if __name__ == "__main__":
    main()
