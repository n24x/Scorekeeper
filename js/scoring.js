/**
 * APA Scorekeeper - Scoring Engine
 * Implements official APA Equalizer® handicap rules for 8-ball and 9-ball.
 * All data is derived from the APA Team Manual and rules.poolplayers.com.
 */

// ═══════════════════════════════════════════════════════════════════
// 8-BALL: Games Must Win Chart (SL2–SL7)
// Format: [you_need, opp_needs]
// Index: [yourSL][oppSL] → [yourRaceTo, oppRaceTo]
// ═══════════════════════════════════════════════════════════════════
const EIGHT_BALL_RACE_CHART = {
  2: { 2: [2,2], 3: [2,3], 4: [2,4], 5: [2,5], 6: [2,6], 7: [2,7] },
  3: { 2: [3,2], 3: [2,2], 4: [2,3], 5: [2,4], 6: [2,5], 7: [2,6] },
  4: { 2: [4,2], 3: [3,2], 4: [3,3], 5: [3,4], 6: [3,5], 7: [2,5] },
  5: { 2: [5,2], 3: [4,2], 4: [4,3], 5: [4,4], 6: [4,5], 7: [3,5] },
  6: { 2: [6,2], 3: [5,2], 4: [5,3], 5: [5,4], 6: [5,5], 7: [4,5] },
  7: { 2: [7,2], 3: [6,2], 4: [5,2], 5: [5,3], 6: [5,4], 7: [5,5] }
};

// ═══════════════════════════════════════════════════════════════════
// 9-BALL: Points Required to Win (SL1–SL9)
// Each ball 1-8 = 1 point, 9-ball = 2 points, max 10 per rack
// The race target is fixed per skill level (not dependent on opponent)
// ═══════════════════════════════════════════════════════════════════
const NINE_BALL_POINTS_TO_WIN = {
  1: 14, 2: 19, 3: 25, 4: 31, 5: 38,
  6: 46, 7: 55, 8: 65, 9: 75
};

// Skill level ranges per format
const EIGHT_BALL_Skill_LEVELS = [2, 3, 4, 5, 6, 7];
const NINE_BALL_Skill_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Senior skill levels (max 2 per match)
const EIGHT_BALL_SENIOR = [6, 7];
const NINE_BALL_SENIOR = [6, 7, 8, 9];

// Time-outs (called "coachings" in the Team Manual) are per GAME, not per match.
// APA Team Manual: players SL4 and up get one coaching per game; SL2, SL3 and
// non-rated players get two per game. The official app enforces the same limit.
const MAX_TIMEOUTS_PER_RACK = 1; // legacy default, kept for older saved matches

function maxTimeoutsPerRack(skillLevel) {
  return (Number(skillLevel) >= 4) ? 1 : 2;
}

// Table sizes offered by the official APA Scorekeeper app.
const TABLE_SIZE_LABELS = {
  'bar-box': '7-foot Coin-Op',        // legacy key used by v1.0 matches
  'coin-7': '7-foot Coin-Op',
  'coin-8': '8-foot Coin-Op',
  'regulation-8': '8-foot Regulation', // legacy key used by v1.0 matches
  'reg-8': '8-foot Regulation',
  'regulation-9': '9-foot Regulation', // legacy key used by v1.0 matches
  'reg-9': '9-foot Regulation'
};

function getTableSizeLabel(size) {
  return TABLE_SIZE_LABELS[size] || 'Unspecified';
}

// ═══════════════════════════════════════════════════════════════════
// Rack End Types (from APK: RackEndType enum)
// ═══════════════════════════════════════════════════════════════════
const RACK_END_TYPES = {
  // 8-ball
  EIGHT_BREAK_RUN: 'EIGHT_BREAK_RUN',         // 8-ball made on the break + run
  EIGHT_ON_BREAK: 'EIGHT_ON_BREAK',           // 8-ball pocketed on the break
  EIGHT_EARLY: 'EIGHT_EARLY',                 // 8-ball pocketed early (wrong shot) -> loss
  EIGHT_BREAK_AND_RUN: 'EIGHT_BREAK_AND_RUN', // Break and run to the 8-ball
  // shared
  STANDARD: 'STANDARD',                        // Normal rack win (last ball)
  SCRATCH_ON_EIGHT: 'SCRATCH_ON_EIGHT',       // Scratched on 8-ball shot -> loss
  WRONG_POCKET: 'WRONG_POCKET',               // 8-ball in wrong pocket -> loss
  // 9-ball
  NINE_ON_SNAP: 'NINE_ON_SNAP',              // 9-ball made on the break
  NINE_BREAK_AND_RUN: 'NINE_BREAK_AND_RUN',  // Break and run to 9-ball
  // no-winner
  END_RACK_EARLY: 'END_RACK_EARLY',           // Rack ended early (stalemate etc)
  STALEMATE: 'STALEMATE',                     // No winner
};

// Map for display
const RACK_END_LABELS = {
  EIGHT_BREAK_RUN: 'Break & Run',
  EIGHT_ON_BREAK: '8 on Break',
  EIGHT_EARLY: 'Early 8',
  EIGHT_BREAK_AND_RUN: 'Break & Run',
  STANDARD: 'Standard Win',
  SCRATCH_ON_EIGHT: 'Scratch on 8',
  WRONG_POCKET: 'Wrong Pocket',
  NINE_ON_SNAP: '9 on Snap',
  NINE_BREAK_AND_RUN: 'Break & Run',
  END_RACK_EARLY: 'End Early',
  STALEMATE: 'Stalemate',
};

// ═══════════════════════════════════════════════════════════════════
// Utility functions
// ═══════════════════════════════════════════════════════════════════

/** Get the race-to values for an 8-ball match based on both skill levels.
 *  Returns { home: yourRaceTo, away: oppRaceTo }
 *  Chart is indexed [yourSL][oppSL] = [yourRaceTo, oppRaceTo] */
function get8BallRace(yourSL, oppSL) {
  const chart = EIGHT_BALL_RACE_CHART;
  if (!chart[yourSL] || !chart[yourSL][oppSL]) return null;
  return { home: chart[yourSL][oppSL][0], away: chart[yourSL][oppSL][1] };
}

/** Get the points-to-win for a 9-ball match based on skill level */
function get9BallPoints(skillLevel) {
  return NINE_BALL_POINTS_TO_WIN[skillLevel] || null;
}

/** Check if a skill level is Senior in the given format */
function isSeniorSkillLevel(sl, format) {
  const seniors = format === '8-ball' ? EIGHT_BALL_SENIOR : NINE_BALL_SENIOR;
  return seniors.includes(sl);
}

/** Count senior players on a team for a match */
function countSeniors(players, format) {
  return players.filter(p => isSeniorSkillLevel(p.skillLevel, format)).length;
}

/** Check if a team is under the 23-point cap (8-ball, sum of skill levels) */
function isUnder23Cap(players) {
  const total = players.reduce((sum, p) => sum + (p.skillLevel || 0), 0);
  return total <= 23;
}

/** Validate team skill level total */
function getTeamSkillTotal(players) {
  return players.reduce((sum, p) => sum + (p.skillLevel || 0), 0);
}

// ═══════════════════════════════════════════════════════════════════
// Match state management
// ═══════════════════════════════════════════════════════════════════

/** Create a new match */
function createMatch(type, homeTeam, awayTeam, homePlayer, awayPlayer) {
  const format = type; // '8-ball' or '9-ball'
  const match = {
    id: 'm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    format: format,
    homeTeam: homeTeam,
    awayTeam: awayTeam,
    homePlayer: homePlayer,  // { id, name, skillLevel }
    awayPlayer: awayPlayer,  // { id, name, skillLevel }
    lagWinner: null,          // 'home' | 'away' | null
    racks: [],
    status: 'setup',          // setup → in_progress → completed → submitted
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tableSize: null,          // 'coin-7' | 'coin-8' | 'reg-8' | 'reg-9'
    completedAt: null,
    forfeit: null,            // null | 'home' | 'away' | 'double'
    forfeitPoints: null,      // { home, away } when the match ended by forfeit
    winner: null,              // 'home' | 'away' | null
    finalScore: null,          // { home, away }
    // Sudden Death (APA 8-ball: racks worth 2 then 1 team point; 9-ball: all
    // ball points doubled). See enableSuddenDeath().
    suddenDeath: false,
    suddenDeathAt: null,
    suddenDeathRacks: 0,
    suddenDeathFromRack: null,
    notes: '',
  };

  // Calculate race targets
  if (format === '8-ball') {
    const race = get8BallRace(homePlayer.skillLevel, awayPlayer.skillLevel);
    if (race) {
      match.homeRaceTo = race.home;
      match.awayRaceTo = race.away;
    }
  } else {
    match.homeRaceTo = get9BallPoints(homePlayer.skillLevel);
    match.awayRaceTo = get9BallPoints(awayPlayer.skillLevel);
  }

  return match;
}

/** Create a new rack (game within a match) */
function createRack(match, rackNumber) {
  return {
    id: 'r_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    rackNumber: rackNumber,
    breaker: null,          // 'home' | 'away' — who breaks this rack
    turn: null,             // 'home' | 'away' — who is at the table now
    homeWonLag: false,
    awayWonLag: false,
    // 8-ball fields
    homeRacksWon: 0,    // not used per-rack in 8-ball; match-level
    awayRacksWon: 0,
    // 9-ball fields
    homeBallPoints: 0,
    awayBallPoints: 0,
    deadBalls: 0,         // balls pocketed on fouls / scratches
    // shared fields
    innings: 0,
    homeTimeouts: 0,
    awayTimeouts: 0,
    homeDefensiveShots: 0,
    awayDefensiveShots: 0,
    endType: null,         // RACK_END_TYPES value
    winner: null,           // 'home' | 'away' | null
    endedAt: null,
    sdPoints: null,         // 8-ball Sudden Death: 2 for the first SD rack, 1 after
    // 9-ball: which balls were pocketed by whom
    balls: [],              // [{ number, pocketedBy: 'home'|'away', dead: false }]
    // 8-ball live picker
    eightBalls: [],         // legacy: v1.x recorded 8-ball balls here; no longer used
    notes: '',
  };
}

/** Set lag winner for the match (applies to first rack) */
function setLagWinner(match, side) {
  match.lagWinner = side;
  match.updatedAt = Date.now();
  if (match.racks.length > 0) {
    match.racks[0].homeWonLag = (side === 'home');
    match.racks[0].awayWonLag = (side === 'away');
  }
}

/** Start a new rack in the match */
function opposite(side) { return side === 'home' ? 'away' : 'home'; }

function startRack(match) {
  const rackNumber = match.racks.length + 1;
  const rack = createRack(match, rackNumber);
  if (rackNumber === 1 && match.lagWinner) {
    rack.homeWonLag = (match.lagWinner === 'home');
    rack.awayWonLag = (match.lagWinner === 'away');
  }
  // The lag winner breaks game one; after that the break alternates. The
  // breaker is stored on the rack so the scorekeeper can change it if their
  // league uses a different order.
  const prev = match.racks[match.racks.length - 1];
  rack.breaker = rackNumber === 1
    ? (match.lagWinner || 'home')
    : (prev && prev.breaker ? opposite(prev.breaker) : (match.lagWinner || 'home'));
  rack.turn = rack.breaker;
  match.racks.push(rack);
  match.status = 'in_progress';
  match.updatedAt = Date.now();
  return rack;
}

/** Change who is at the table.
 *  Each change of shooter counts one inning (the user's league convention).
 *  Returns true when an inning was counted. */
function setTurn(match, rack, side) {
  if (!rack || rack.winner || (side !== 'home' && side !== 'away')) return false;
  if (!rack.turn) rack.turn = rack.breaker || 'home';
  if (side === rack.turn) return false;

  // Every change of shooter counts as one inning in this app's bookkeeping:
  // tap the other player when the turn passes. The +/- stepper stays for
  // fixing a mis-tap.
  rack.innings = (rack.innings || 0) + 1;
  rack.turn = side;
  match.updatedAt = Date.now();
  return true;
}

/** Who is at the table, or the breaker if the turn has not been touched. */
function currentShooter(rack) {
  return rack.turn || rack.breaker || 'home';
}

/** 9-ball points including the rack currently being scored (balls entered but
 *  the rack not yet ended). Used to stop the match the moment someone reaches
 *  their target. */
function liveNineBallTotals(match) {
  const out = { home: 0, away: 0 };
  const multiplier = match.suddenDeath ? 2 : 1;
  match.racks.forEach((r, i) => {
    const isLive = (i === match.racks.length - 1) && !r.winner;
    if (isLive) {
      (r.balls || []).forEach(b => {
        if (b.dead || !b.pocketedBy) return;
        out[b.pocketedBy] += (b.number === 9 ? 2 : 1) * multiplier;
      });
    } else {
      out.home += r.homeBallPoints || 0;
      out.away += r.awayBallPoints || 0;
    }
  });
  return out;
}

/** End a rack with the given end type and winner */
function endRack(match, rack, endType, winner) {
  rack.endType = endType;
  rack.winner = winner || null;
  rack.endedAt = Date.now();
  match.updatedAt = Date.now();

  if (match.format === '8-ball') {
    // Sudden Death in 8-ball is scored in team points, not games: the first
    // SD rack is worth 2 points, every later SD rack is worth 1.
    // (APA Sudden Death Guidelines, 8-Ball section.) Recalculate from the rack
    // list so editing an old rack cannot inflate the SD total.
    if (match.suddenDeath) recalcSuddenDeath(match);
  } else {
    // 9-ball: balls 1-8 are worth 1 point, the 9-ball is worth 2.
    // In Sudden Death every ball is worth DOUBLE points.
    const multiplier = match.suddenDeath ? 2 : 1;

    // A stalemate returns the balls on the table as dead balls: nobody is
    // credited for them (Scoresheet instructions, "Dead Balls").
    if (endType === 'STALEMATE') {
      rack.balls.forEach(b => { b.dead = true; b.pocketedBy = null; });
    }

    // The 9-ball is never a dead ball - it is spotted (same source).
    const nine = rack.balls.find(b => b.number === 9);
    if (nine && nine.dead) { nine.dead = false; nine.pocketedBy = null; }

    rack.homeBallPoints = rack.balls
      .filter(b => b.pocketedBy === 'home' && !b.dead)
      .reduce((sum, b) => sum + (b.number === 9 ? 2 : 1), 0) * multiplier;
    rack.awayBallPoints = rack.balls
      .filter(b => b.pocketedBy === 'away' && !b.dead)
      .reduce((sum, b) => sum + (b.number === 9 ? 2 : 1), 0) * multiplier;
    rack.deadBalls = rack.balls.filter(b => b.dead).length;
  }

  // Recompute the result from the full rack list. Editing an earlier rack has
  // to be able to un-complete and re-complete the match.
  match.status = match.racks.length ? 'in_progress' : 'setup';
  match.winner = null;
  match.finalScore = null;
  match.completedAt = null;
  checkMatchOver(match);
}

/** Check if the match is over based on format */
function checkMatchOver(match) {
  if (match.format === '8-ball') {
    // Sudden Death replaces the games race: the first SD rack is worth 2
    // points and settles the individual match (tie-break credit goes to its
    // winner), so the match ends as soon as that rack is decided.
    if (match.suddenDeath) {
      const sd = getSuddenDeathPoints(match);
      if (sd.home !== sd.away) {
        match.status = 'completed';
        match.winner = sd.home > sd.away ? 'home' : 'away';
        match.finalScore = sd;
        match.completedAt = Date.now();
      }
      return;
    }
    let homeWins = 0, awayWins = 0;
    match.racks.forEach(r => {
      if (r.winner === 'home') homeWins++;
      else if (r.winner === 'away') awayWins++;
    });
    if (homeWins >= match.homeRaceTo) {
      match.status = 'completed';
      match.winner = 'home';
      match.finalScore = { home: homeWins, away: awayWins };
      match.completedAt = Date.now();
    } else if (awayWins >= match.awayRaceTo) {
      match.status = 'completed';
      match.winner = 'away';
      match.finalScore = { home: homeWins, away: awayWins };
      match.completedAt = Date.now();
    }
  } else {
    // 9-ball: sum ball points across all racks
    let homeTotal = 0, awayTotal = 0;
    match.racks.forEach(r => {
      homeTotal += r.homeBallPoints || 0;
      awayTotal += r.awayBallPoints || 0;
    });
    // "If a player earns more points than required to win, do not mark the
    // excess points" - cap the recorded score at each player's target.
    if (homeTotal >= match.homeRaceTo) {
      match.status = 'completed';
      match.winner = 'home';
      match.finalScore = { home: match.homeRaceTo, away: Math.min(awayTotal, match.awayRaceTo - 1) };
      match.completedAt = Date.now();
    } else if (awayTotal >= match.awayRaceTo) {
      match.status = 'completed';
      match.winner = 'away';
      match.finalScore = { home: Math.min(homeTotal, match.homeRaceTo - 1), away: match.awayRaceTo };
      match.completedAt = Date.now();
    }
  }
}

/** Get running score for the match */
function getRunningScore(match) {
  if (match.format === '8-ball') {
    let homeWins = 0, awayWins = 0;
    match.racks.forEach(r => {
      if (r.winner === 'home') homeWins++;
      else if (r.winner === 'away') awayWins++;
    });
    return {
      home: homeWins,
      away: awayWins,
      homeTarget: match.homeRaceTo,
      awayTarget: match.awayRaceTo,
      homeLabel: 'Games Won',
      awayLabel: 'Games Won'
    };
  } else {
    let homePts = 0, awayPts = 0;
    match.racks.forEach(r => {
      homePts += r.homeBallPoints || 0;
      awayPts += r.awayBallPoints || 0;
    });
    return {
      home: homePts,
      away: awayPts,
      homeTarget: match.homeRaceTo,
      awayTarget: match.awayRaceTo,
      homeLabel: 'Ball Points',
      awayLabel: 'Ball Points'
    };
  }
}

/** Get total innings across all racks */
function getTotalInnings(match) {
  return match.racks.reduce((sum, r) => sum + (r.innings || 0), 0);
}

/** Get total defensive shots for a side across all racks */
function getTotalDefensiveShots(match, side) {
  return match.racks.reduce((sum, r) =>
    sum + (side === 'home' ? (r.homeDefensiveShots || 0) : (r.awayDefensiveShots || 0)), 0);
}

/** Get total timeouts for a side across all racks */
function getTotalTimeouts(match, side) {
  return match.racks.reduce((sum, r) =>
    sum + (side === 'home' ? (r.homeTimeouts || 0) : (r.awayTimeouts || 0)), 0);
}

/** Forfeit a match.
 *  An individual forfeit is worth TWO match points in regular 8-ball League
 *  play (three in Playoffs/Higher Level Tournaments) - Team Manual, rule 4.
 *  The forfeiting player does not get a fabricated race-to score. */
function forfeitMatch(match, side, options) {
  const playoff = !!(options && options.playoff);
  const forfeitValue = playoff ? 3 : 2;

  match.forfeit = side;
  match.status = 'completed';
  match.completedAt = Date.now();
  match.finalScore = null;   // a forfeit is not a played-out score

  if (side === 'home') {
    match.winner = 'away';
    match.forfeitPoints = { home: 0, away: forfeitValue };
  } else if (side === 'away') {
    match.winner = 'home';
    match.forfeitPoints = { home: forfeitValue, away: 0 };
  } else {
    match.winner = null;
    match.forfeitPoints = { home: 0, away: 0 };
  }
}

/** Sudden Death: 8-ball racks are worth team points (2 then 1); 9-ball
 *  doubles every ball. Enabling it mid-match keeps the racks already played. */
function enableSuddenDeath(match) {
  if (match.suddenDeath) return match;
  match.suddenDeath = true;
  match.suddenDeathAt = Date.now();
  match.suddenDeathRacks = 0;
  // A rack already in progress becomes the first Sudden Death rack.
  const last = match.racks[match.racks.length - 1];
  match.suddenDeathFromRack = (last && !last.winner) ? match.racks.length - 1 : match.racks.length;
  match.updatedAt = Date.now();
  return match;
}

/** Re-number the Sudden Death racks (2 points for the first one, 1 after).
 *  Safe to call repeatedly; it is derived purely from the rack list. */
function recalcSuddenDeath(match) {
  const from = (typeof match.suddenDeathFromRack === 'number')
    ? match.suddenDeathFromRack
    : 0;
  let n = 0;
  match.racks.forEach((r, i) => {
    if (i < from || !r.winner) { r.sdPoints = null; return; }
    n++;
    r.sdPoints = (n === 1) ? 2 : 1;
  });
  match.suddenDeathRacks = n;
}

/** Points won so far in 8-ball Sudden Death racks. */
function getSuddenDeathPoints(match) {
  const out = { home: 0, away: 0 };
  match.racks.forEach(r => {
    if (r.sdPoints && r.winner === 'home') out.home += r.sdPoints;
    if (r.sdPoints && r.winner === 'away') out.away += r.sdPoints;
  });
  return out;
}

/** Value of the next 8-ball Sudden Death rack (2 for the first, then 1). */
function nextSuddenDeathRackValue(match) {
  return (match.suddenDeathRacks || 0) === 0 ? 2 : 1;
}

/** APA 8-Ball 3-Point Scoring System (introduced Spring 2014).
 *  Every individual match is worth 3 points:
 *   - shutout win (loser won no games) ............. 3-0
 *   - win where the loser reached the hill ......... 2-1
 *   - win where the loser won games but no hill .... 2-0
 *  Returns { home, away } match points, or null if not applicable. */
function get8BallMatchPoints(match) {
  if (match.format !== '8-ball' || match.status !== 'completed') return null;
  if (match.forfeit || match.suddenDeath) return null; // forfeits / SD use their own points

  let homeGames = 0, awayGames = 0;
  match.racks.forEach(r => {
    if (r.winner === 'home') homeGames++;
    else if (r.winner === 'away') awayGames++;
  });

  if (!match.winner) return null;

  const homeWon = match.winner === 'home';
  const loserGames = homeWon ? awayGames : homeGames;
  const loserTarget = homeWon ? match.awayRaceTo : match.homeRaceTo;

  let winnerPts, loserPts;
  if (loserGames === 0) {
    winnerPts = 3; loserPts = 0;              // shutout
  } else if (loserGames === loserTarget - 1) {
    winnerPts = 2; loserPts = 1;              // loser reached the hill
  } else {
    winnerPts = 2; loserPts = 0;              // loser won games, never reached the hill
  }

  return homeWon ? { home: winnerPts, away: loserPts } : { home: loserPts, away: winnerPts };
}

/** Match points for any format. Returns null when the app cannot compute them
 *  honestly (9-ball match points need APA's "Score of Match" chart). */
function getMatchPoints(match) {
  if (match.status !== 'completed') return null;
  if (match.forfeit) return match.forfeitPoints || null;
  if (match.format === '8-ball') {
    return match.suddenDeath ? getSuddenDeathPoints(match) : get8BallMatchPoints(match);
  }
  return null;
}

/** Undo the last rack */
function undoLastRack(match) {
  if (match.racks.length === 0) return null;
  const removed = match.racks.pop();
  if (match.suddenDeath) recalcSuddenDeath(match);
  match.status = match.racks.length > 0 ? 'in_progress' : 'setup';
  match.winner = null;
  match.finalScore = null;
  match.completedAt = null;
  match.forfeit = null;
  match.updatedAt = Date.now();
  // Recalculate if there are remaining racks
  if (match.racks.length > 0) {
    checkMatchOver(match);
    // If not over, set back to in_progress
    if (match.status === 'completed') {
      // genuinely over even without the last rack
    } else {
      match.status = 'in_progress';
    }
  }
  return removed;
}

/** Generate a summary of the match for display/submission */
function generateMatchSummary(match) {
  const score = getRunningScore(match);
  const totalInnings = getTotalInnings(match);
  const homeDef = getTotalDefensiveShots(match, 'home');
  const awayDef = getTotalDefensiveShots(match, 'away');
  const homeTO = getTotalTimeouts(match, 'home');
  const awayTO = getTotalTimeouts(match, 'away');

  return {
    format: match.format,
    tableSize: getTableSizeLabel(match.tableSize),
    suddenDeath: !!match.suddenDeath,
    matchPoints: getMatchPoints(match),
    forfeitPoints: match.forfeitPoints || null,
    homePlayer: match.homePlayer.name,
    awayPlayer: match.awayPlayer.name,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeSkillLevel: match.homePlayer.skillLevel,
    awaySkillLevel: match.awayPlayer.skillLevel,
    homeRaceTo: match.homeRaceTo,
    awayRaceTo: match.awayRaceTo,
    homeScore: score.home,
    awayScore: score.away,
    homeDefensiveShots: homeDef,
    awayDefensiveShots: awayDef,
    homeTimeouts: homeTO,
    awayTimeouts: awayTO,
    totalInnings: totalInnings,
    racksPlayed: match.racks.length,
    winner: match.winner,
    forfeit: match.forfeit,
    completedAt: match.completedAt,
    rackSummaries: match.racks.map(r => ({
      number: r.rackNumber,
      winner: r.winner,
      endType: r.endType,
      sdPoints: r.sdPoints || null,
      innings: r.innings,
      homeBallPoints: r.homeBallPoints,
      awayBallPoints: r.awayBallPoints,
      deadBalls: r.deadBalls,
      homeDefensiveShots: r.homeDefensiveShots,
      awayDefensiveShots: r.awayDefensiveShots,
      homeTimeouts: r.homeTimeouts,
      awayTimeouts: r.awayTimeouts,
      balls: r.balls.map(b => ({ number: b.number, pocketedBy: b.pocketedBy, dead: b.dead })),
      eightBalls: r.eightBalls ? r.eightBalls.map(b => ({ number: b.number, pocketedBy: b.pocketedBy, dead: b.dead })) : []
    }))
  };
}

// Export for use in other modules / service worker context
if (typeof module !== 'undefined') module.exports = {
  EIGHT_BALL_RACE_CHART,
  NINE_BALL_POINTS_TO_WIN,
  RACK_END_TYPES,
  RACK_END_LABELS,
  TABLE_SIZE_LABELS,
  getTableSizeLabel,
  maxTimeoutsPerRack,
  get8BallRace,
  get9BallPoints,
  isSeniorSkillLevel,
  countSeniors,
  isUnder23Cap,
  getTeamSkillTotal,
  createMatch,
  createRack,
  setLagWinner,
  startRack,
  endRack,
  checkMatchOver,
  getRunningScore,
  getTotalInnings,
  getTotalDefensiveShots,
  getTotalTimeouts,
  forfeitMatch,
  opposite,
  setTurn,
  currentShooter,
  liveNineBallTotals,
  enableSuddenDeath,
  getSuddenDeathPoints,
  nextSuddenDeathRackValue,
  get8BallMatchPoints,
  getMatchPoints,
  undoLastRack,
  generateMatchSummary
};
