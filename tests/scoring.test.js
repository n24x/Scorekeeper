/**
 * Unit tests for js/scoring.js — run with: node tests/scoring.test.js
 * No dependencies; exits non-zero on the first failure.
 */
const assert = require('assert');
const S = require('../js/scoring.js');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    console.error('FAIL  ' + name + '\n      ' + e.message);
    process.exitCode = 1;
  }
}

function new8(slHome = 5, slAway = 5) {
  return S.createMatch('8-ball', 'Home Team', 'Away Team',
    { id: 1, name: 'Home', skillLevel: slHome },
    { id: 2, name: 'Away', skillLevel: slAway });
}
function new9(slHome = 5, slAway = 5) {
  return S.createMatch('9-ball', 'Home Team', 'Away Team',
    { id: 1, name: 'Home', skillLevel: slHome },
    { id: 2, name: 'Away', skillLevel: slAway });
}
function winRack(m, side, endType = 'STANDARD') {
  const rack = S.startRack(m);
  S.endRack(m, rack, endType, side);
  return rack;
}
function nineRack(m, homeBalls = [], awayBalls = [], deadBalls = []) {
  const rack = S.startRack(m);
  rack.balls = [
    ...homeBalls.map(n => ({ number: n, pocketedBy: 'home', dead: false })),
    ...awayBalls.map(n => ({ number: n, pocketedBy: 'away', dead: false })),
    ...deadBalls.map(n => ({ number: n, pocketedBy: null, dead: true }))
  ];
  S.endRack(m, rack, 'STANDARD', homeBalls.length ? 'home' : 'away');
  return rack;
}

console.log('8-ball race chart');
test('SL7 vs SL2 races 7-2', () => {
  assert.deepStrictEqual(S.get8BallRace(7, 2), { home: 7, away: 2 });
});
test('SL2 vs SL7 races 2-7', () => {
  assert.deepStrictEqual(S.get8BallRace(2, 7), { home: 2, away: 7 });
});
test('SL4 vs SL7 races 2-5 (lower SL needs only 2)', () => {
  assert.deepStrictEqual(S.get8BallRace(4, 7), { home: 2, away: 5 });
});
test('chart is internally consistent (a/b mirrored)', () => {
  for (const a of [2, 3, 4, 5, 6, 7]) {
    for (const b of [2, 3, 4, 5, 6, 7]) {
      const ab = S.get8BallRace(a, b);
      const ba = S.get8BallRace(b, a);
      assert.strictEqual(ab.home, ba.away, `race ${a}v${b}`);
      assert.strictEqual(ab.away, ba.home, `race ${b}v${a}`);
    }
  }
});
test('match gets race targets from both skill levels', () => {
  const m = new8(6, 3);
  assert.strictEqual(m.homeRaceTo, 5);
  assert.strictEqual(m.awayRaceTo, 2);
});

console.log('9-ball');
test('points required to win table', () => {
  assert.deepStrictEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(S.get9BallPoints),
    [14, 19, 25, 31, 38, 46, 55, 65, 75]
  );
});
test('9-ball is worth 2 points, others 1', () => {
  const m = new9(3, 3);
  const rack = nineRack(m, [1, 2, 9], [3]);
  assert.strictEqual(rack.homeBallPoints, 4);
  assert.strictEqual(rack.awayBallPoints, 1);
});
test('stalemate kills every ball and scores nothing', () => {
  const m = new9(3, 3);
  const rack = S.startRack(m);
  rack.balls = [{ number: 1, pocketedBy: 'home', dead: false }];
  S.endRack(m, rack, 'STALEMATE', null);
  assert.strictEqual(rack.homeBallPoints, 0);
  assert.strictEqual(rack.deadBalls, 1);
});
test('the 9-ball is never a dead ball (it is spotted)', () => {
  const m = new9(3, 3);
  const rack = S.startRack(m);
  rack.balls = [{ number: 9, pocketedBy: null, dead: true }];
  S.endRack(m, rack, 'NINE_ON_SNAP', 'home');
  assert.strictEqual(rack.balls[0].dead, false);
  assert.strictEqual(rack.balls[0].pocketedBy, null);
});
test('excess points over the target are not marked', () => {
  const m = new9(1, 1); // race to 14
  m.racks = [{ homeBallPoints: 18, awayBallPoints: 2, winner: 'home' }];
  S.checkMatchOver(m);
  assert.strictEqual(m.winner, 'home');
  assert.deepStrictEqual(m.finalScore, { home: 14, away: 2 });
});

console.log('8-ball 3-Point Scoring System');
function completed8(homeGames, awayGames, slHome = 7, slAway = 7) {
  const m = new8(slHome, slAway);
  for (let i = 0; i < homeGames; i++) winRack(m, 'home');
  for (let i = 0; i < awayGames; i++) winRack(m, 'away');
  return m;
}
test('shutout 5-0 is 3-0 match points', () => {
  const m = new8(7, 7); // both race to 5
  for (let i = 0; i < 5; i++) winRack(m, 'home');
  assert.strictEqual(m.status, 'completed');
  assert.deepStrictEqual(S.get8BallMatchPoints(m), { home: 3, away: 0 });
});
test('winner 5-4 (loser reached the hill) is 2-1', () => {
  const m = new8(7, 7);
  for (let i = 0; i < 4; i++) winRack(m, 'home');
  for (let i = 0; i < 4; i++) winRack(m, 'away'); // away at the hill (5-4)
  winRack(m, 'home');
  assert.deepStrictEqual(S.get8BallMatchPoints(m), { home: 2, away: 1 });
});
test('winner 5-2 (loser won games, no hill) is 2-0', () => {
  const m = new8(7, 7);
  for (let i = 0; i < 4; i++) winRack(m, 'home');
  winRack(m, 'away');
  winRack(m, 'away');
  winRack(m, 'home');
  assert.deepStrictEqual(S.get8BallMatchPoints(m), { home: 2, away: 0 });
});
test('away winner gets the points on their side', () => {
  const m = new8(7, 7);
  for (let i = 0; i < 5; i++) winRack(m, 'away');
  assert.deepStrictEqual(S.get8BallMatchPoints(m), { home: 0, away: 3 });
});

console.log('forfeits');
test('forfeit awards 2 points and no fake score', () => {
  const m = new8(5, 5);
  S.forfeitMatch(m, 'home');
  assert.strictEqual(m.winner, 'away');
  assert.strictEqual(m.finalScore, null);
  assert.deepStrictEqual(m.forfeitPoints, { home: 0, away: 2 });
  assert.deepStrictEqual(S.getMatchPoints(m), { home: 0, away: 2 });
});
test('playoff forfeit awards 3 points', () => {
  const m = new8(5, 5);
  S.forfeitMatch(m, 'away', { playoff: true });
  assert.deepStrictEqual(m.forfeitPoints, { home: 3, away: 0 });
});

console.log('sudden death');
test('8-ball SD: first rack worth 2 and settles the match', () => {
  const m = new8(6, 3);
  winRack(m, 'home');
  S.enableSuddenDeath(m);
  const rack = winRack(m, 'away');
  assert.strictEqual(rack.sdPoints, 2);
  assert.strictEqual(m.status, 'completed');
  assert.strictEqual(m.winner, 'away');
  assert.deepStrictEqual(m.finalScore, { home: 0, away: 2 });
  assert.deepStrictEqual(S.getMatchPoints(m), { home: 0, away: 2 });
});
test('9-ball SD doubles every ball, including the 9', () => {
  const m = new9(3, 3);
  S.enableSuddenDeath(m);
  const rack = nineRack(m, [1, 2, 9], [3]);
  assert.strictEqual(rack.homeBallPoints, 8); // (1+1+2) x2
  assert.strictEqual(rack.awayBallPoints, 2);
});
test('editing an SD rack keeps its 2-point value', () => {
  const m = new8(6, 3);
  winRack(m, 'home');            // rack 1, normal play
  S.enableSuddenDeath(m);
  const sd = winRack(m, 'home'); // rack 2, first SD rack
  assert.strictEqual(sd.sdPoints, 2);
  // Re-end the same rack for the other player (what the Edit Rack screen does)
  S.endRack(m, sd, 'STANDARD', 'away');
  assert.strictEqual(sd.sdPoints, 2);
  assert.deepStrictEqual(S.getSuddenDeathPoints(m), { home: 0, away: 2 });
  assert.deepStrictEqual(S.getMatchPoints(m), { home: 0, away: 2 });
});
test('racks played before Sudden Death never get SD points', () => {
  const m = new8(6, 3);
  winRack(m, 'home');
  winRack(m, 'away');
  S.enableSuddenDeath(m);
  winRack(m, 'home');
  assert.strictEqual(m.racks[0].sdPoints, null);
  assert.strictEqual(m.racks[1].sdPoints, null);
  assert.strictEqual(m.racks[2].sdPoints, 2);
});
test('editing an earlier rack can flip the match winner', () => {
  const m = new8(7, 7);
  for (let i = 0; i < 5; i++) winRack(m, 'away');
  assert.strictEqual(m.winner, 'away');
  S.endRack(m, m.racks[0], 'STANDARD', 'home'); // edit one rack
  // Away now has 4 of 5, so the match reopens instead of staying complete.
  assert.strictEqual(m.winner, null);
  assert.strictEqual(m.status, 'in_progress');
  winRack(m, 'away');                           // away closes it out again
  assert.strictEqual(m.winner, 'away');
  assert.strictEqual(m.status, 'completed');
});
test('undoing an SD rack rolls the SD counter back', () => {
  const m = new8(6, 3);
  S.enableSuddenDeath(m);
  winRack(m, 'home');
  assert.strictEqual(m.suddenDeathRacks, 1);
  S.undoLastRack(m);
  assert.strictEqual(m.suddenDeathRacks, 0);
});

console.log('limits and labels');
test('time-outs: SL4+ get 1 per game, SL2-3 get 2', () => {
  assert.strictEqual(S.maxTimeoutsPerRack(7), 1);
  assert.strictEqual(S.maxTimeoutsPerRack(4), 1);
  assert.strictEqual(S.maxTimeoutsPerRack(3), 2);
  assert.strictEqual(S.maxTimeoutsPerRack(1), 2);
});
test('legacy table keys still render', () => {
  assert.strictEqual(S.getTableSizeLabel('bar-box'), '7-foot Coin-Op');
  assert.strictEqual(S.getTableSizeLabel('regulation-9'), '9-foot Regulation');
  assert.strictEqual(S.getTableSizeLabel('coin-8'), '8-foot Coin-Op');
});

console.log('\n' + passed + ' tests passed' + (process.exitCode ? ' — with failures' : ''));
