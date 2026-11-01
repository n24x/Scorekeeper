# Feature map — official APA Scorekeeper vs this app

Where the feature list comes from: the official Android app (`com.poolplayers.scorekeeper`
v1.14.51, React Native/Hermes, SHA-256 `53df5048…37ae2`) was inspected locally with REA
(JADX) and its Hermes bytecode decompiled with `hermes-dec`. UI strings below are quoted
from the app's own `defaultMessage` catalogue; rule statements come from
rules.poolplayers.com, the APA Team Manual and the APA Sudden Death Guidelines.

Status labels: **Implemented** = in this app and exercised, **Partial** = present but
simpler than the official behaviour, **Planned** = agreed, not built, **Out of scope** =
needs APA's servers/league account and will not be built.

## Pre-match

| Feature | Official app | This app | Status |
| --- | --- | --- | --- |
| Team + player roster | GraphQL roster, member numbers, unpaid/uncertified flags | Local teams/players, member number stored | Partial |
| Roster limits | 23-Rule + max 2 Senior players enforced before put-up | Race chart shows Senior levels; **no cap enforcement** | Planned |
| Coin toss for put-up order | `preMatch.coinToss.heads/tails`, "Who Puts up First?" | Lag winner only (no coin toss) | Planned |
| Lag winner | `editGame.edit.lag`, `LAG` pill | Yes | Implemented |
| Put-up | `editGame.edit.putUp`, `putUp.playerWasPutUp` | No (single player match, no lineup) | Planned |
| Table size | 7-foot coin-op, 8-foot coin-op, 8-foot regulation, 9-foot regulation | Same four options since v1.1 | Implemented |
| Pre-play a match early | `matchup.startMatchEarly` (days early warning) | No | Out of scope |

## Scoring — 8-ball

| Feature | Official app | This app | Status |
| --- | --- | --- | --- |
| Games Must Win race chart | Server-supplied `raceTo` | Local chart SL2–SL7 (+ SL8/9 for 9-ball) | Implemented |
| Ball-by-ball entry | **Not used in 8-ball** — the official app asks who won and how | Removed in v1.3 (the 15-ball grid is gone) | Implemented |
| Rack end types | Standard, 8-on-the-Break, 8-ball Break-and-Run, Early 8, Scratch on 8, Wrong pocket | Same set, asked in two steps (who won → how it ended) | Implemented |
| Innings | Auto-counted from the turn (bottom player misses) | At-the-table toggle counts innings automatically; manual +/- for corrections | Implemented |
| Defensive shots | Per-player counters | Per-player counters | Implemented |
| Time-outs | 1 per game for SL4+, 2 for SL2/SL3 | Same rule since v1.1 (was 1 for everyone) | Implemented |
| **3-Point Scoring System** | `editGame.pMatchInfo.matchPoints` — 3-0 / 2-1 / 2-0 | Computed on completion since v1.1 | Implemented |
| Sudden Death (time limit) | 2 points for first rack, 1 for the second | Flag + per-rack SD points since v1.1 | Implemented |
| Forfeit | `matchInput.forfeit.struck/notStruck` ("was the first rack struck?") | Forfeit records 2 points (3 in playoffs), no fake score since v1.1 | Partial — no struck/not-struck detail |
| Complete by points | `scoresheet.completeByPoints` (team match ends early) | No team match container | Planned |

## Scoring — 9-ball

| Feature | Official app | This app | Status |
| --- | --- | --- | --- |
| Points Required to Win | Server-supplied targets (14/19/25/31/38/46/55/65/75) | Local table | Implemented |
| Ball-by-ball entry | Tap balls, assign to a player, mark dead | Tap balls, assign, mark dead | Implemented |
| 9-ball worth 2 | Yes | Yes | Implemented |
| Dead balls | Auto on scratch/foul, 9 never dead (spotted) | Stalemate kills all balls; 9 cannot be marked dead since v1.1 | Partial — scratch handling is manual |
| Excess points not marked | Cap at the player's target | Capped since v1.1 | Implemented |
| Sudden Death | Every ball worth double | Doubling since v1.1 | Implemented |
| Live points + auto win | Score climbs as balls drop; match ends at the target | Live score since v1.5; match stops at the target, excess points dropped | Implemented |
| 9-ball ends the rack | Yes | Pocketing the 9 closes the rack automatically since v1.5 | Implemented |
| Match points | `Score of Match` chart from the losing player's ball count | Not computed (chart not in the app binary) | Planned |

## Match flow and UX

| Feature | Official app | This app | Status |
| --- | --- | --- | --- |
| Undo with loss summary | `undoRackModal.*` lists innings, shots, time-outs, balls | Same summary in a confirmation sheet since v1.1 | Implemented |
| Edit a completed rack | "Adjust Game Ending" + disabled reasons | Edit rack, then re-end it | Partial — no disabled-reason logic |
| Font size | Settings → Font Size (small/medium/large/default) | Settings → Text Size (4 steps) since v1.1 | Implemented |
| Screen stays awake | `WAKE_LOCK` permission | Screen Wake Lock API while scoring, since v1.1 | Implemented |
| Takeover scoring (second device) | `editGame.scoringAction.takeoverScoring` | No multi-device sync | Out of scope |
| Offline queue | `matchInput.offline.incompleteData` | Always offline (IndexedDB) | Implemented |
| Submit to league | GraphQL submission, signed scoresheet | JSON export/import only | Out of scope |
| Tablet layout | `ScoreboardTablet`, `MatchListTablet` | Responsive single column | Planned |

## Team match — deliberately not built

The official app scores a **team match**: five player matches on one scoresheet, put-up
order, running match points (max 15 for 8-ball), and a "confirm scores with opponent"
step. This app scores one singles match at a time and rolls several of them into a text
report.

Decision: the team-match container is out of scope. This app exists as an **outage
fallback** — when the official app is down, score the singles match, then email the
summary or copy it into the official app later. `docs/team-match-plan.md` is kept only
as a record of what that would have involved.

## Handover (v1.2)

| Need | Where |
| --- | --- |
| Name + team without building a roster | New Match → type the name / team fields |
| One match, readable | Match → Match Summary → Copy / Email |
| Several matches at once | Summary tab → Today / 7 days / All → tick matches → Copy / Email / Share |
| Machine backup | Settings → Export Backup (JSON) |
