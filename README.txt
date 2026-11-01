APA Scorekeeper - Offline Pool League Scoring App
===================================================

Version: 1.6
By: Built for zappb44

WHAT THIS APP DOES
-------------------
Scores APA (American Poolplayers Association) 8-ball and 9-ball league matches
fully offline. No internet connection required. All data stored locally on your phone.

FEATURES
--------
- 8-ball scoring with official APA Games Must Win race chart (SL2-SL7)
- 9-ball scoring with official APA Points Required to Win (SL1-SL9)
- Team and player management (add teams, add players, set skill levels)
- Rack-by-rack scoring with:
  - Lag winner tracking
  - Innings tracking
  - Defensive shots
  - Timeouts
  - 8-ball end types (Standard, 8 on Break, Break & Run, Early 8, Scratch on 8, Wrong Pocket)
  - 9-ball ball-by-ball entry (tap balls to assign to home/away, mark dead balls)
  - 9-ball end types (Standard, 9 on Snap, Break & Run, End Early)
- Undo last rack (with a summary of exactly what is deleted)
- Forfeit match (APA values it at 2 match points, 3 in playoffs)
- Match summary with full stats
- Export/import data backup (JSON)
- Race chart reference (8-ball and 9-ball)
- Works offline (PWA with service worker)
- Installable to home screen

NEW IN 1.6
----------
- 9-ball ball entry is merged with the turn: tap a ball and it is credited to
  whoever is at the table. There is no second "who made it" toggle.
- Dead balls use a one-shot "Dead ball" button: arm it, tap the ball, and it
  goes back to normal.
- Every change of shooter counts one inning, so tapping back and forth
  builds the innings count. The +/- stepper still fixes mistakes.

NEW IN 1.5
----------
- 9-ball stops the moment a player reaches their points target: the match is
  declared there, and points above the target are not counted.
- Pocketing the 9-ball ends the rack automatically, and ends the match if it
  reaches the target.
- The big 9-ball score updates ball by ball as you enter them.
- "At the table" buttons for both formats: tap whoever is shooting. An inning
  is counted for you when the player who did not break finishes their turn,
  exactly like the scoresheet. Manual +/- stays for corrections.
- Each rack shows who breaks; the break alternates after the lag winner.
- Settings shows the build number and has "Reload app & clear cache".

NEW IN 1.4
----------
- The app updates itself on the next load (network-first service worker),
  instead of showing a cached build.
- The Summary tab includes rack-by-rack detail: who won each rack and the
  innings, with a checkbox to turn it off.

NEW IN 1.3
----------
- 8-ball no longer asks you to mark individual balls. The official app does
  not track balls in 8-ball either; it asks who won the rack and how it
  ended. The 15-ball grid is gone.
- Ending a rack is now two clear steps: "Who won the rack?" (player 1,
  player 2, or no winner) and then "How did it end?" with only the endings
  that make sense for that winner. Picking player 2 to win is now obvious.
- The rack summary lists every rack with who won, how it ended, innings,
  defensive shots and time-outs, e.g.
    1. Player2 won - Standard Win - 3 innings
- Cancelling an edit no longer reopens or changes the match.

NEW IN 1.2 (outage fallback)
----------------------------
Built to be used when the official APA app is down: score the singles match,
then hand the numbers over by email or by typing them into the official app
later.

- Type a player name and a team name straight into New Match. No roster
  needed - the roster is still there if you want it.
- "Match Summary" on any finished match shows the full scoresheet as plain
  text: players and skill levels, final score, match points, racks, innings,
  defensive shots, time outs, lag and a rack-by-rack log.
- Copy or Email buttons on that summary. Copy also works when you want to
  paste it into the official app or a message.
- New "Summary" tab: pick Today / 7 days / All, tick the matches you want,
  give the report a title ("Week 7"), and get one text block covering every
  match plus totals. Copy, Email or Share it.
- Forfeits are labelled as forfeits instead of showing a fake 0-0 score.

NEW IN 1.1
----------
- 8-ball 3-Point Scoring System: 3-0 shutout, 2-1 when the loser reaches
  the hill, 2-0 otherwise. Shown on the summary and in the match list.
- Sudden Death: time-limit procedure. In 8-ball the next rack is worth 2
  points and the one after it 1; in 9-ball every ball counts double.
- Table size now matches the official app: 7-ft coin-op, 8-ft coin-op,
  8-ft regulation, 9-ft regulation.
- Time-outs follow the Team Manual: 1 per game for SL4 and up, 2 per game
  for SL2/SL3.
- 9-ball rule fixes: the 9-ball can no longer be marked dead (it is
  spotted), a stalemate kills the balls on the table, and points above a
  player's target are not recorded.
- Text size setting (small / medium / large / extra large).
- Screen stays awake while a match is being scored (wake lock).
- Editing a completed rack no longer lets you add racks to a finished match.
- Unit tests for the scoring engine: node tests/scoring.test.js
- Feature map vs the official APA app: docs/features.md

HOW TO INSTALL ON ANDROID
---------------------------
Option A — Install from browser:
1. Copy the "pwa" folder to your phone (or host it online)
2. Open index.html in Chrome
3. Tap menu → "Install app" or "Add to Home screen"
4. The app will appear on your home screen and work offline

Option B — Host locally and install:
1. Upload the contents of the "pwa" folder to any web server
2. Open the URL in Chrome on your phone
3. Install as above

HOW TO USE
-----------
1. Go to Teams tab → Create your team(s) and add players with their skill levels
2. Go to Matches tab → New Match → Select format (8-ball or 9-ball)
3. Select home and away players
4. The race targets auto-calculated from skill levels
5. Set lag winner → Start scoring racks
6. For 8-ball: tap who won each rack, select end type, enter stats
7. For 9-ball: tap balls to assign to home/away, mark dead balls, enter stats
8. Match auto-completes when someone reaches their race target
9. View match summary, export if needed

OFFLINE CAPABILITY
------------------
The app uses a service worker (sw.js) to cache all resources. Once loaded
once, it works completely offline — no internet needed. All match data is
stored in IndexedDB on your device.

DATA BACKUP
-----------
Settings → Export Backup creates a JSON file with all your teams, players,
and matches. Import Backup restores from this file.

NOT AFFILIATED WITH APA
------------------------
This app implements the APA Equalizer® handicap scoring rules as published
at rules.poolplayers.com. It is an independent tool and is not affiliated
with, endorsed by, or connected to the American Poolplayers Association.
