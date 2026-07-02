#!/usr/bin/env python3
"""
Builds downloadable .ics calendar files from data/manual/calendar.json.

Outputs (assets/downloads/calendar/):
  * one .ics per hard reporting milestone (linked from assessment-calendar.html)
  * ccoe-all-events.ics — every calendar event + milestone in one subscribeable file

Runs automatically in the update-data workflow whenever calendar.json changes,
so editing the JSON is the only manual step.
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "downloads" / "calendar"
OUT.mkdir(parents=True, exist_ok=True)

cal = json.loads((ROOT / "data" / "manual" / "calendar.json").read_text(encoding="utf-8"))
STAMP = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

TYPE_LABEL = {
    "e-ato": "ATO DEADLINE", "e-asmt": "ASSESSMENT", "e-mil": "MILESTONE",
    "e-trn": "TRAINING / EVENT", "e-blk": "BLACKOUT",
}


def esc(s):
    return (s.replace("\\", "\\\\").replace(";", "\\;")
             .replace(",", "\\,").replace("\n", "\\n"))


def vevent(uid, date_str, summary, description=""):
    d = datetime.strptime(date_str, "%Y-%m-%d")
    end = d + timedelta(days=1)
    lines = [
        "BEGIN:VEVENT",
        f"UID:{uid}@ccoe-hub",
        f"DTSTAMP:{STAMP}",
        f"DTSTART;VALUE=DATE:{d.strftime('%Y%m%d')}",
        f"DTEND;VALUE=DATE:{end.strftime('%Y%m%d')}",
        f"SUMMARY:{esc(summary)}",
    ]
    if description:
        lines.append(f"DESCRIPTION:{esc(description)}")
    lines.append("END:VEVENT")
    return lines


def calendar_file(name, events, calname):
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0",
             "PRODID:-//CCoE Operational Hub//Assessment Calendar//EN",
             f"X-WR-CALNAME:{esc(calname)}"]
    for ev in events:
        lines += ev
    lines.append("END:VCALENDAR")
    (OUT / name).write_text("\r\n".join(lines) + "\r\n", encoding="utf-8")
    print(f"wrote assets/downloads/calendar/{name}")


# Per-milestone files
for m in cal.get("milestones", []):
    ev = vevent(m["slug"], m["date"], f"{m['code']} — {m['title']}",
                "CCoE hard reporting milestone. Details: assessment-calendar.html")
    calendar_file(f"{m['slug']}.ics", [ev], f"CCoE: {m['code']} {m['date']}")

# Everything-in-one file
all_events = []
for m in cal.get("milestones", []):
    all_events.append(vevent("ms-" + m["slug"], m["date"], f"{m['code']} — {m['title']}"))
for date_str, entries in sorted(cal.get("events", {}).items()):
    for i, (etype, label) in enumerate(entries):
        all_events.append(vevent(f"ev-{date_str}-{i}", date_str,
                                 f"[{TYPE_LABEL.get(etype, 'EVENT')}] {label}"))
calendar_file("ccoe-all-events.ics", all_events, "CCoE Assessment Calendar")
