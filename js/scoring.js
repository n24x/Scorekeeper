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

// Max timeouts per rack (1 per player per rack in 8-ball; 1 per player per rack in 9-ball)
const MAX_TIMEOUTS_PER_RACK = 1;

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
    tableSize: null,          // 'bar-box' (coin) | 'regulation-8' | 'regulation-9'
    completedAt: null,
    forfeit: null,            // null | 'home' | 'away' | 'double'
    winner: null,              // 'home' | 'away' | null
    finalScore: null,          // { home, away }
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
    // 9-ball: which balls were pocketed by whom
    balls: [],              // [{ number, pocketedBy: 'home'|'away', dead: false }]
    // 8-ball live picker
    eightBalls: [],         // [{ number, pocketedBy: 'home'|'away'|null, dead: false }]
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
function startRack(match) {
  const rackNumber = match.racks.length + 1;
  const rack = createRack(match, rackNumber);
  // Lag winner of rack 1 is match lag winner; subsequent racks alternate
  // (winner of previous rack generally breaks, but in APA the breaker alternates)
  if (rackNumber === 1 && match.lagWinner) {
    rack.homeWonLag = (match.lagWinner === 'home');
    rack.awayWonLag = (match.lagWinner === 'away');
  }
  match.racks.push(rack);
  match.status = 'in_progress';
  match.updatedAt = Date.now();
  return rack;
}

/** End a rack with the given end type and winner */
function endRack(match, rack, endType, winner) {
  rack.endType = endType;
  rack.winner = winner || null;
  rack.endedAt = Date.now();
  match.updatedAt = Date.now();

  // Update match-level scores
  if (match.format === '8-ball') {
    if (winner === 'home') {
      // count home racks won at match level
    } else if (winner === 'away') {
      // count away racks won at match level
    }
  } else {
    // 9-ball: add ball points from this rack
    const homePts = rack.balls.filter(b => b.pocketedBy === 'home' && !b.dead).length
      + (rack.balls.filter(b => b.pocketedBy === 'home' && b.number === 9 && !b.dead).length); // extra point for 9-ball
    const awayPts = rack.balls.filter(b => b.pocketedBy === 'away' && !b.dead).length
      + (rack.balls.filter(b => b.pocketedBy === 'away' && b.number === 9 && !b.dead).length);
    // Actually, balls 1-8 = 1pt, 9-ball = 2pts. Let's recalc properly.
    rack.homeBallPoints = rack.balls.filter(b => b.pocketedBy === 'home' && !b.dead)
      .reduce((sum, b) => sum + (b.number === 9 ? 2 : 1), 0);
    rack.awayBallPoints = rack.balls.filter(b => b.pocketedBy === 'away' && !b.dead)
      .reduce((sum, b) => sum + (b.number === 9 ? 2 : 1), 0);
    rack.deadBalls = rack.balls.filter(b => b.dead).length;
  }

  // Check if match is over
  checkMatchOver(match);
}

/** Check if the match is over based on format */
function checkMatchOver(match) {
  if (match.format === '8-ball') {
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
    if (homeTotal >= match.homeRaceTo) {
      match.status = 'completed';
      match.winner = 'home';
      match.finalScore = { home: homeTotal, away: awayTotal };
      match.completedAt = Date.now();
    } else if (awayTotal >= match.awayRaceTo) {
      match.status = 'completed';
      match.winner = 'away';
      match.finalScore = { home: homeTotal, away: awayTotal };
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

/** Forfeit a match */
function forfeitMatch(match, side) {
  match.forfeit = side;
  match.status = 'completed';
  match.completedAt = Date.now();
  if (side === 'home') {
    // Home forfeits → away wins
    match.winner = 'away';
    match.finalScore = { home: 0, away: match.format === '8-ball' ? match.awayRaceTo : match.awayRaceTo };
  } else if (side === 'away') {
    match.winner = 'home';
    match.finalScore = { home: match.format === '8-ball' ? match.homeRaceTo : match.homeRaceTo, away: 0 };
  } else {
    // Double forfeit
    match.winner = null;
    match.finalScore = { home: 0, away: 0 };
  }
}

/** Undo the last rack */
function undoLastRack(match) {
  if (match.racks.length === 0) return null;
  const removed = match.racks.pop();
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
  undoLastRack,
  generateMatchSummary
};
