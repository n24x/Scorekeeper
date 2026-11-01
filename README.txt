APA Scorekeeper - Offline Pool League Scoring App
===================================================

Version: 1.1
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
