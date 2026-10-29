# Weekly metrics update

Edit `data/manual/metrics.json` through your existing repository login. There is no visitor-facing editor or hardcoded password. Repository permissions determine who can edit; restrict write access and protected-branch approvals to your designated account in your hosting environment. This change does not modify repository permissions.

Keep every prior snapshot. Copy the last snapshot, append it to `snapshots`, change `reportingDate` to the report's actual date, and replace all values for that date. Publish through the normal GitLab pipeline. Refreshing a page reads the published file; editing a local file alone does not publish it. Use HTTP hosting, not file://.

The committed initial snapshot deliberately contains unavailable values. Replace that initial empty entry with your first real report. Do not upload operational .mil metrics to a public repository. JSON delivered to a static website can be downloaded by anyone who can access that site.

## Fields

- `portfolio`: active systems, current and expired authorizations, assessment queue, high-risk system count. `authorizationDatesComplete` is true only when every active system is listed with its authorization expiration date.
- `poam`: `totalOpen`, portfolio-wide `overdue` and `dueWithin30Days`, optional `bySeverity` counts. Due within 30 days excludes already overdue items. Use the report date consistently. Do not enter individual findings, descriptions, IDs, owner names, or per-system overdue counts.
- `workforce`: optional aggregate workforce measures, in the units named by their keys.
- `systems`: one object per system: `{"name":"Example system","atoExpiration":"2027-01-15","openPoam":12}`. This example is illustrative, not real data. Use `null` for an unavailable date or count.
- `poam.systemCountsComplete`: true only when all active systems are included and each has a confirmed count. Then open backlog is calculated from their sum; leave `totalOpen` null or supply the identical sum. Otherwise enter the portfolio total separately and the leaderboard is labeled partial.

`null` means unavailable. `0` means confirmed zero. Dates use YYYY-MM-DD. Never remove an earlier record just to update this week's numbers. Fixing an incorrect historical value is allowed; document that correction in the commit message.

Run `node tests/metrics.test.cjs` for calculation checks and `node -e "require('./assets/js/metrics.js').validate(require('./data/manual/metrics.json'))"` to validate your current data before publishing.

## Calculations

Change = latest open backlog minus the preceding snapshot's backlog. A decrease is fewer open items, not evidence of that many closures. The comparison names the actual previous reporting date even when a week is skipped. Percentage change is unavailable when the baseline is zero. No change is shown until two comparable reports exist. Trend points use actual report dates and the accompanying table gives exact counts.

ATO windows use the report date: expiration today through 60 days ahead is included; past expirations are labeled expired. Incomplete dates do not produce a misleading complete portfolio count. The nearest-date list includes known dates, with negative days for expired authorizations. Rankings show five highest and five lowest reported system totals; small portfolios may appear in both lists. These are counts, not risk ratings.

Automation can later append the same validated schema; no page redesign is required. Source-tool integration and verified closure/on-time performance measures are not part of this release.
