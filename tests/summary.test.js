/**
 * Tests for js/summary.js — node tests/summary.test.js
 * scoring.js is loaded first and its helpers exposed as globals, the same way
 * the browser loads scoring.js before summary.js.
 */
const assert = require('assert');
const S = require('../js/scoring.js');

global.getMatchPoints = S.getMatchPoints;
global.RACK_END_LABELS = S.RACK_END_LABELS;
global.getTableSizeLabel = S.getTableSizeLabel;

const Summary = require('../js/summary.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; }
}

function build8(homeName = 'Alice', awayName = 'Bob') {
  const m = S.createMatch('8-ball', 'Sharks', 'Eagles',
    { id: 1, name: homeName, skillLevel: 6 },
    { id: 2, name: awayName, skillLevel: 4 });
  m.tableSize = 'reg-8';
  m.lagWinner = 'home';
  S.startRack(m);
  m.racks[0].innings = 3;
  m.racks[0].homeDefensiveShots = 1;
  S.endRack(m, m.racks[0], 'EIGHT_BREAK_AND_RUN', 'home');
  for (let i = 0; i < 3; i++) {
    S.startRack(m);
    m.racks[m.racks.length - 1].innings = 2;
    S.endRack(m, m.racks[m.racks.length - 1], 'STANDARD', 'home');
  }
  for (let i = 0; i < 2; i++) {
    S.startRack(m);
    S.endRack(m, m.racks[m.racks.length - 1], 'STANDARD', 'away');
  }
  S.startRack(m);
  S.endRack(m, m.racks[m.racks.length - 1], 'STANDARD', 'home'); // 5-2, away at hill
  m.completedAt = Date.UTC(2026, 10, 1, 20, 30);
  return m;
}

function build9() {
  const m = S.createMatch('9-ball', 'Sharks', 'Eagles',
    { id: 1, name: 'Carl', skillLevel: 4 },
    { id: 2, name: 'Dana', skillLevel: 5 });
  S.startRack(m);
  m.racks[0].innings = 4;
  m.racks[0].balls = [
    { number: 1, pocketedBy: 'home', dead: false },
    { number: 2, pocketedBy: 'home', dead: false },
    { number: 9, pocketedBy: 'home', dead: false },
    { number: 3, pocketedBy: 'away', dead: false },
    { number: 5, pocketedBy: null, dead: true }
  ];
  S.endRack(m, m.racks[0], 'STANDARD', 'home');
  m.status = 'completed';
  m.winner = 'away';
  m.finalScore = { home: 20, away: 31 };
  m.completedAt = Date.UTC(2026, 10, 1, 21, 10);
  return m;
}

console.log('match summary');
test('contains format, table, players and score', () => {
  const txt = Summary.formatMatchSummary(build8());
  assert.match(txt, /^8-BALL · 8-foot Regulation/m);
  assert.match(txt, /Sharks vs Eagles/);
  assert.match(txt, /Alice \(SL6\) 5 - 2 Bob \(SL4\)/);
  assert.match(txt, /Winner: Alice/);
  assert.match(txt, /Match points: 2-1/);
  assert.match(txt, /Racks: 7/);
  assert.match(txt, /Lag: Alice/);
});
test('rack log lists end types and stats', () => {
  const txt = Summary.formatMatchSummary(build8());
  assert.match(txt, /1\. Alice · Break & Run/);
  assert.match(txt, /· 3 inn/);
});
test('9-ball summary shows points and dead balls', () => {
  const txt = Summary.formatMatchSummary(build9());
  assert.match(txt, /^9-BALL/m);
  assert.match(txt, /1\. Carl · Standard Win · 4-1 pts · 1 dead/);
});
test('forfeited match is labelled, not given a fake score', () => {
  const m = build8();
  S.forfeitMatch(m, 'away');
  const txt = Summary.formatMatchSummary(m);
  assert.match(txt, /forfeit/i);
  assert.match(txt, /Forfeit by Bob/);
});

console.log('session summary');
test('one-liners carry the key numbers', () => {
  const line = Summary.matchOneLiner(build8());
  assert.match(line, /^8B · Alice \(SL6\) v Bob \(SL4\) · 5-2 games · MP 2-1 · 9 innings/);
});
test('session groups by day and totals every match', () => {
  const txt = Summary.formatSessionSummary([build8(), build9()], {
    label: 'WEEK 7', generatedAt: Date.UTC(2026, 10, 1, 22, 0)
  });
  assert.match(txt, /^WEEK 7/);
  assert.match(txt, /2 matches · 1 home wins · 1 away wins/);
  assert.match(txt, /— Sun, Nov 1, 2026 —/);
  assert.match(txt, /TOTALS/);
  assert.match(txt, /Matches 2 · Racks 8/);
});
test('session totals are summed correctly', () => {
  const t = Summary.sessionTotals([build8(), build9()]);
  assert.strictEqual(t.matches, 2);
  assert.strictEqual(t.racks, 8);
  assert.strictEqual(t.innings, 9 + 4);
  assert.strictEqual(t.defensive, 1);
});
test('empty range says so instead of printing zeros', () => {
  const txt = Summary.formatSessionSummary([]);
  assert.match(txt, /No completed matches/);
});

console.log('\n' + passed + ' tests passed' + (process.exitCode ? ' — with failures' : ''));
