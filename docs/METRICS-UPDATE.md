# Weekly metrics update

Edit `data/manual/metrics.json` through your existing repository login. There is no visitor-facing editor or hardcoded password. Repository permissions determine who can edit; restrict write access and protected-branch approvals to your designated account in your hosting environment. This change does not modify repository permissions.

Keep every prior snapshot. Copy the last snapshot, append it to `snapshots`, change `reportingDate` to the report's actual date, and replace all values for that date. Publish through the normal GitLab pipeline. Refreshing a page reads the published file; editing a local file alone does not publish it. Use HTTP hosting, not file://.

The committed `metrics.json` currently contains **illustrative sample data** so you can see the visualizations. `"sampleData": true` puts a "sample data — not real" badge on every metrics page. Before you enter real reporting, delete the `sampleData` line and replace all sample snapshots with your first real report. Do not upload operational .mil metrics to a public repository. JSON delivered to a static website can be downloaded by anyone who can access that site.

## Fields

- `portfolio`: active systems, current and expired authorizations, assessment queue, high-risk system count. `authorizationDatesComplete` is true only when every active system is listed with its authorization expiration date.
- `poam`: `totalOpen`, portfolio-wide `overdue` and `dueWithin30Days`, optional `bySeverity` counts. Due within 30 days excludes already overdue items. Use the report date consistently. Do not enter individual findings, descriptions, IDs, owner names, or per-system overdue counts.
- `workforce`: optional aggregate workforce measures, in the units named by their keys.
- `systems`: one object per system: `{"name":"Example system","atoExpiration":"2027-01-15","openPoam":12}`. This example is illustrative, not real data. Use `null` for an unavailable date or count.
- `poam.systemCountsComplete`: true only when all active systems are included and each has a confirmed count. Then open backlog is calculated from their sum; leave `totalOpen` null or supply the identical sum. Otherwise enter the portfolio total separately and the leaderboard is labeled partial.

`null` means unavailable. `0` means confirmed zero. Dates use YYYY-MM-DD. Never remove an earlier record just to update this week's numbers. Fixing an incorrect historical value is allowed; document that correction in the commit message.

Run `node tests/metrics.test.cjs` and `node tests/enterprise-metrics.test.cjs` for calculation checks, and validate your current data before publishing:

```
node -e "const d=require('./data/manual/metrics.json');require('./assets/js/metrics.js').validate(d);require('./assets/js/enterprise-metrics.js').validate(d)"
```

## Enterprise metrics (`enterprise`) and Cyber Task Orders (`cyberTaskOrders`)

Both blocks live inside each snapshot, beside `portfolio` and `poam`. They are rendered by `assets/js/enterprise-metrics.js`.

**Where they appear**

| Page | Container | Shows |
|---|---|---|
| `index.html` hero band | `data-ent-hero` | Total systems, NIPR queue, SIPR queue, expired POA&Ms |
| `index.html` "Portfolio Health at a Glance" | `data-ent-highlights` | The headline (starred) metrics: total systems, NIPR/SIPR workflows in queue, authorization status, expired POA&Ms |
| `rmf-operations.html#enterprise-metrics` | `data-ent-dashboard` | All enterprise metrics |
| `rmf-operations.html#cyber-task-orders` | `data-cto-dashboard` | CTO KPI/KRI dashboard |

**Preview:** add `?demo=1` to either page URL (for example `rmf-operations.html?demo=1`) to render `data/manual/metrics.sample.json`, which contains clearly labeled illustrative values. A "sample data" badge appears. Never put real data in the sample file.

**`enterprise` fields** (all counts; `null` = not available)

- `totalSystems`
- `workflowsInQueue`: `NIPR`, `SIPR`
- `workflowsByStage`: `ISO/PM`, `ISSM`, `AO`
- `authorizationStatus`: `Not Authorized`, `Valid`, `Expired`
- `expiringAuthorizations` (days until expiration): `0-60`, `61-90`, `91-120`, `121-150`, `151-180`
- `systemsByOverallRisk`: `Unassigned`, `Very Low`, `Low`, `Moderate`, `High`, `Very High`
- `controlCompliance`: `Compliant`, `Non-Compliant`, `Not Applicable`, `Unassessed`. The compliance rate shown is Compliant ÷ (Compliant + Non-Compliant).
- `vulnerabilityTrend`: list of `{"month":"YYYY-MM","Low":n,"Moderate":n,"High":n,"Very High":n}`. The last 12 months are charted. Copy the 12-month trend from your source dashboard each period.
- `expiredPoams` (days past due): `1-89`, `>=90`
- `expiringPoams` (days until due): `0-30`, `31-60`, `61-90`
- `overduePoamLeaderboard`: list of `{"system":"Name","overdue":n}`. The top 10 are shown, ranked by overdue count. This publishes per-system overdue counts by name; confirm that is approved for the hosting environment.

If the legacy `portfolio.activeSystems`, `currentAuthorizations` or `expiredAuthorizations` are `null`, the older summary cards on other pages use `totalSystems`, `authorizationStatus.Valid` and `authorizationStatus.Expired` instead, so you don't have to enter them twice.

**`cyberTaskOrders` fields**

- `slaTargetPercent`: the SLA target (default 90). The SLA rate turns red below it.
- `status`: `open` (active and not yet past due), `late` (active and past due), `completed` (completed in the reporting window)
- `completedOnTime`: completed by the deadline in the same window as `status.completed`
- `monthly`: list of `{"month":"YYYY-MM","open":n,"late":n,"completed":n,"assigned":n}`. Drives the stacked-bar trend and completion velocity. `assigned` = new tasks received that month.
- `lateTasks`: list of `{"id":"CTO 26-014","title":"Short title","severity":"Critical|High|Medium|Low","dueDate":"YYYY-MM-DD"}`. Drives the aging table, backlog aging and the late-critical count. If the list is shorter than `status.late`, the page says it is partial. Task identifiers and titles can be sensitive. Publish only what is approved for the host.

**CTO calculations**

- SLA compliance rate = `completedOnTime` ÷ `status.completed`
- Overdue risk ratio = `late` ÷ (`open` + `late`)
- Backlog aging = average of (report date − `dueDate`) across `lateTasks`
- Completion velocity = latest month's `completed` vs `assigned`. If assignments exceed completions, the backlog is growing.
- Late critical tasks = `lateTasks` with severity `Critical`

A zero denominator displays N/A, not 0%.

## Calculations

Change = latest open backlog minus the preceding snapshot's backlog. A decrease is fewer open items, not evidence of that many closures. The comparison names the actual previous reporting date even when a week is skipped. Percentage change is unavailable when the baseline is zero. No change is shown until two comparable reports exist. Trend points use actual report dates and the accompanying table gives exact counts.

ATO windows use the report date: expiration today through 60 days ahead is included; past expirations are labeled expired. Incomplete dates do not produce a misleading complete portfolio count. The nearest-date list includes known dates, with negative days for expired authorizations. Rankings show five highest and five lowest reported system totals; small portfolios may appear in both lists. These are counts, not risk ratings.

Automation can later append the same validated schema; no page redesign is required. Source-tool integration and verified closure/on-time performance measures are not part of this release.
