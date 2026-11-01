# Team match (scoresheet) — implementation plan

Goal: score a whole APA League night instead of a single player match — five player
matches on one scoresheet, put-up order, running match points, and a final confirm step.
Nothing here is built yet; this is the agreed shape so the work can be done in slices.

## Why it is the next step

Every other gap in `docs/features.md` is cosmetic next to this one. APA League night is a
team match; the official app's whole navigation (`Match → Match # → Player Match`) exists
to serve that container. The current app forces the scorer to open five separate matches
and add the points on paper.

## Data model

```
teamMatch {
  id, week, date, location, division,
  homeTeamId, awayTeamId,
  homeTeamName, awayTeamName,      // snapshot: names change between sessions
  format: '8-ball' | '9-ball',
  tableSize,
  putUpFirst: 'home' | 'away' | null,
  playerMatches: [ { slot: 1..5, homePlayerId, awayPlayerId, matchId } ],
  status: 'setup' | 'in_progress' | 'submitted',
  suddenDeath: bool,
  createdAt, updatedAt
}
```

`matchId` points at the existing per-player match record, so the scoring engine and all
existing screens keep working unchanged. The team match is a thin index plus totals.

## Scoring math

- 8-ball: sum of each player match's 3-point result (3-0 / 2-1 / 2-0). Team maximum 15.
  Playoff forfeits are worth 3, regular-season forfeits 2 (already in `forfeitMatch`).
- 9-ball: **not implementable yet.** APA awards 9-ball match points from the "Score of
  Match" chart based on the losing player's ball count. That chart is printed on the
  scoresheet and is not in the official app's binary (the server returns the value). We
  either transcribe the chart from an official scoresheet or leave 9-ball team totals
  blank and show ball points only. Do not guess it.
- Sudden Death: 8-ball uses the 2-then-1 rack values already implemented; the team match
  is over as soon as one side cannot catch up (see APA Sudden Death Guidelines scenarios).

## Slices

1. **Model + migration** — new `teamMatches` IndexedDB store (DB_VERSION 2), backfill
   nothing (old matches stay standalone), helpers in `js/team-match.js`.
2. **Create screen** — pick two teams, format, table, week; suggest the five slots from
   each roster; enforce the 23-Rule and max 2 Senior players before the first put-up.
3. **Team scoreboard** — five slot rows with match points, running total, put-up order.
4. **Wire-up** — "Start player match" from a slot creates the existing match record with
   `teamMatchId` + `slot`; on completion, roll its match points into the team total.
5. **Confirm + export** — side-by-side totals, captain confirmation, JSON/PDF export.

## Guardrails

- Existing single matches must keep opening and scoring exactly as they do now.
- No team total is shown for 9-ball until the match-point chart is sourced.
- All new scoring functions get unit tests in `tests/` before UI work.
