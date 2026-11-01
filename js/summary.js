/**
 * APA Scorekeeper - Plain-text summaries
 *
 * Two jobs:
 *  1. formatMatchSummary(match)  -> one match, detailed enough to copy into the
 *     official APA app or email to a teammate.
 *  2. formatSessionSummary(matches, opts) -> several matches on one page with
 *     running totals, for "here is everything from tonight".
 *
 * These functions are pure (no DOM, no IndexedDB) so they can be unit tested
 * with node: tests/summary.test.js
 */

// ── small helpers ────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }

function fmtDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function fmtDateOnly(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function scoreLine(match) {
  const h = match.homePlayer, a = match.awayPlayer;
  if (match.forfeit) return `${h.name} (SL${h.skillLevel}) vs ${a.name} (SL${a.skillLevel}) — forfeit`;
  const fs = match.finalScore || { home: 0, away: 0 };
  return `${h.name} (SL${h.skillLevel}) ${fs.home} - ${fs.away} ${a.name} (SL${a.skillLevel})`;
}

/**
 * One rack, on one line: who won, how it ended, and every stat recorded for it.
 * Innings are always printed (0 is meaningful), the rest only when non-zero.
 */
function rackLine(match, rack) {
  const winnerName = rack.winner === 'home' ? match.homePlayer.name
    : rack.winner === 'away' ? match.awayPlayer.name : null;
  const label = (typeof RACK_END_LABELS !== 'undefined' && RACK_END_LABELS[rack.endType]) || rack.endType || '';
  const innings = rack.innings || 0;

  const bits = [winnerName ? `${winnerName} won` : 'No winner'];
  if (label) bits.push(label);
  if (match.format === '9-ball') {
    bits.push(`${rack.homeBallPoints || 0}-${rack.awayBallPoints || 0} points`);
    if (rack.deadBalls) bits.push(`${rack.deadBalls} dead`);
  }
  bits.push(`${innings} inning${innings === 1 ? '' : 's'}`);

  const hDef = rack.homeDefensiveShots || 0;
  const aDef = rack.awayDefensiveShots || 0;
  if (hDef || aDef) bits.push(`defensive ${hDef}/${aDef}`);

  const hTO = rack.homeTimeouts || 0;
  const aTO = rack.awayTimeouts || 0;
  if (hTO || aTO) bits.push(`time-outs ${hTO}/${aTO}`);

  if (rack.sdPoints) bits.push(`Sudden Death ${rack.sdPoints} pt`);

  return `${rack.rackNumber}. ` + bits.join(' · ');
}

// ── one match ────────────────────────────────────────────────────────
function formatMatchSummary(match) {
  const m = match;
  const lines = [];
  const tableLabel = (typeof getTableSizeLabel === 'function') ? getTableSizeLabel(m.tableSize) : '';
  const title = m.format === '9-ball' ? '9-BALL' : '8-BALL';

  lines.push(`${title}${tableLabel && tableLabel !== 'Unspecified' ? ' · ' + tableLabel : ''}`);
  if (m.homeTeam || m.awayTeam) lines.push(`${m.homeTeam || 'Home'} vs ${m.awayTeam || 'Away'}`);
  lines.push(fmtDateTime(m.completedAt || m.createdAt));
  lines.push('');
  lines.push(scoreLine(m));

  if (m.forfeit) {
    const who = m.forfeit === 'double' ? 'both players' :
      (m.forfeit === 'home' ? m.homePlayer.name : m.awayPlayer.name);
    lines.push(`Forfeit by ${who}`);
  } else if (m.winner) {
    lines.push(`Winner: ${m.winner === 'home' ? m.homePlayer.name : m.awayPlayer.name}`);
  }

  const mp = (typeof getMatchPoints === 'function') ? getMatchPoints(m) : null;
  if (mp) lines.push(`Match points: ${mp.home}-${mp.away}${m.suddenDeath ? ' (Sudden Death)' : ''}`);

  const innings = m.racks.reduce((s, r) => s + (r.innings || 0), 0);
  const hDef = m.racks.reduce((s, r) => s + (r.homeDefensiveShots || 0), 0);
  const aDef = m.racks.reduce((s, r) => s + (r.awayDefensiveShots || 0), 0);
  const hTO = m.racks.reduce((s, r) => s + (r.homeTimeouts || 0), 0);
  const aTO = m.racks.reduce((s, r) => s + (r.awayTimeouts || 0), 0);

  lines.push(`Racks: ${m.racks.length} · Innings: ${innings} · Defensive: ${hDef}/${aDef} · Time outs: ${hTO}/${aTO}`);
  if (m.lagWinner) {
    lines.push(`Lag: ${m.lagWinner === 'home' ? m.homePlayer.name : m.awayPlayer.name}`);
  }

  if (m.racks.length) {
    lines.push('');
    lines.push('Rack log');
    m.racks.forEach(r => lines.push('  ' + rackLine(m, r)));
  }

  return lines.join('\n');
}

// ── many matches ─────────────────────────────────────────────────────
function matchOneLiner(match) {
  const m = match;
  const fs = m.finalScore || { home: 0, away: 0 };
  const result = m.winner ? (m.winner === 'home' ? m.homePlayer.name : m.awayPlayer.name) : '—';
  const mp = (typeof getMatchPoints === 'function') ? getMatchPoints(m) : null;
  const innings = m.racks.reduce((s, r) => s + (r.innings || 0), 0);
  const def = m.racks.reduce((s, r) => s + (r.homeDefensiveShots || 0) + (r.awayDefensiveShots || 0), 0);
  const to = m.racks.reduce((s, r) => s + (r.homeTimeouts || 0) + (r.awayTimeouts || 0), 0);
  const parts = [];
  if (m.forfeit) {
    parts.push('forfeit');
  } else if (m.format === '9-ball') {
    parts.push(`${fs.home}-${fs.away} pts`);
  } else {
    parts.push(`${fs.home}-${fs.away} games`);
  }
  if (mp) parts.push(`MP ${mp.home}-${mp.away}`);
  parts.push(`${innings} innings`);
  if (def) parts.push(`${def} def`);
  if (to) parts.push(`${to} TO`);
  return `${m.format === '9-ball' ? '9B' : '8B'} · ${m.homePlayer.name} (SL${m.homePlayer.skillLevel}) v ` +
    `${m.awayPlayer.name} (SL${m.awayPlayer.skillLevel}) · ${parts.join(' · ')} · ${result} won`;
}

function sessionTotals(matches) {
  const t = {
    matches: matches.length, wins: 0, losses: 0,
    racks: 0, innings: 0, defensive: 0, timeouts: 0,
    homeWins: 0, awayWins: 0
  };
  matches.forEach(m => {
    if (m.winner === 'home') { t.wins++; t.homeWins++; }
    else if (m.winner === 'away') { t.losses++; t.awayWins++; }
    t.racks += m.racks.length;
    m.racks.forEach(r => {
      t.innings += r.innings || 0;
      t.defensive += (r.homeDefensiveShots || 0) + (r.awayDefensiveShots || 0);
      t.timeouts += (r.homeTimeouts || 0) + (r.awayTimeouts || 0);
    });
  });
  return t;
}

/**
 * @param {Array} matches completed matches
 * @param {Object} opts { label, generatedAt }
 */
function formatSessionSummary(matches, opts) {
  const o = opts || {};
  const sorted = matches.slice().sort((a, b) => (a.completedAt || a.createdAt) - (b.completedAt || b.createdAt));
  const totals = sessionTotals(sorted);
  const lines = [];

  lines.push(o.label || 'APA MATCH SUMMARY');
  lines.push(`Generated ${fmtDateTime(o.generatedAt || Date.now())}`);
  lines.push(`${totals.matches} match${totals.matches === 1 ? '' : 'es'} · ` +
    `${totals.homeWins} home wins · ${totals.awayWins} away wins`);
  lines.push('');

  if (!sorted.length) {
    lines.push('No completed matches in this range.');
    return lines.join('\n');
  }

  // Group by calendar day so a league night reads as one block.
  let currentDay = null, n = 0;
  sorted.forEach(m => {
    const day = fmtDateOnly(m.completedAt || m.createdAt);
    if (day !== currentDay) {
      currentDay = day;
      lines.push(`— ${day} —`);
    }
    n++;
    lines.push(`${n}. ${matchOneLiner(m)}`);
  });

  lines.push('');
  lines.push('TOTALS');
  lines.push(`Matches ${totals.matches} · Racks ${totals.racks} · Innings ${totals.innings}`);
  lines.push(`Defensive shots ${totals.defensive} · Time outs ${totals.timeouts}`);

  return lines.join('\n');
}

if (typeof module !== 'undefined') module.exports = {
  fmtDateOnly, fmtDateTime,
  formatMatchSummary, matchOneLiner, formatSessionSummary, sessionTotals
};
