/**
 * APA Scorekeeper - Main App Logic
 * Handles UI rendering, navigation, and user interactions.
 */

// ─────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────
let currentView = 'home';
let currentMatch = null;
let currentRack = null;
let teams = [];
let players = [];
let matches = [];
let modalStack = [];

// ─────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function showToast(msg, duration = 2500) {
  const t = $('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, duration);
}

function showModal(html) {
  $('modal-content').innerHTML = html;
  $('modal-overlay').classList.add('active');
}

function closeModal() {
  $('modal-overlay').classList.remove('active');
  $('modal-content').innerHTML = '';
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────────────
const ui = {
  switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $('view-' + view).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`.nav-btn[data-view="${view}"]`).forEach(b => b.classList.add('active'));
    currentView = view;

    const titles = { home: 'APA Scorekeeper', teams: 'Teams & Players', match: 'Match', settings: 'Settings', 'race-chart': 'Race Charts' };
    $('page-title').textContent = titles[view] || 'APA Scorekeeper';

    // Refresh data when switching views
    if (view === 'home') this.refreshMatchList();
    if (view === 'teams') this.refreshTeamList();
    if (view === 'race-chart') this.renderRaceChart();
    if (view !== 'match') this.keepAwake(false);
  },

  // ── Matches ──
  async refreshMatchList() {
    matches = await getAllMatches();
    matches.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const container = $('match-list');
    if (matches.length === 0) {
      container.innerHTML = '<div class="empty"><div class="icon">🎱</div><p>No matches yet</p><p class="text-sm text-dim mt-8">Tap "+ New Match" to start scoring</p></div>';
      return;
    }
    let html = '';
    for (const m of matches) {
      const score = getRunningScore(m);
      const statusBadge = m.status === 'completed' ? 'badge-completed">Completed' : m.status === 'in_progress' ? 'badge-in-progress">In Progress' : 'badge-setup">Setup';
      const fmtBadge = m.format === '8-ball' ? 'badge-8ball">8-Ball' : 'badge-9ball">9-Ball';
      const winnerText = m.winner ? `${m.winner === 'home' ? esc(m.homePlayer.name) : esc(m.awayPlayer.name)} won` : '';
      const mp = m.status === 'completed' ? getMatchPoints(m) : null;
      const mpBadge = mp ? `<span class="badge badge-mp">MP ${mp.home}-${mp.away}</span>` : '';
      html += `<div class="card card-tap" onclick="ui.openMatch('${m.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span class="badge ${fmtBadge}</span>
            <span class="badge ${statusBadge}</span>
            ${mpBadge}
          </div>
          <span class="text-sm text-dim">${fmtDate(m.updatedAt)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div>
            <div class="font-bold">${esc(m.homePlayer.name)} (${m.homePlayer.skillLevel})</div>
            <div class="text-sm text-dim">vs</div>
            <div class="font-bold">${esc(m.awayPlayer.name)} (${m.awayPlayer.skillLevel})</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold">${score.home} - ${score.away}</div>
            <div class="text-sm text-dim">to ${score.homeTarget} / ${score.awayTarget}</div>
          </div>
        </div>
        ${winnerText ? `<div class="text-sm mt-8" style="color:var(--green);">🏆 ${winnerText}</div>` : ''}
      </div>`;
    }
    container.innerHTML = html;
  },

  async showNewMatch() {
    if (teams.length === 0 && players.length === 0) {
      teams = await getAllTeams();
      players = await getAllPlayers();
    }
    this.renderNewMatchForm();
  },

  async renderNewMatchForm() {
    // Load teams and players fresh
    teams = await getAllTeams();
    players = await getAllPlayers();

    if (players.length === 0) {
      showModal(`<div class="modal-title">No Players Yet</div>
        <p class="text-dim">You need to add teams and players first.</p>
        <div class="mt-16"><button class="btn btn-primary" onclick="closeModal();ui.switchView('teams');">Go to Teams</button></div>`);
      return;
    }

    const formatOpts = '<option value="8-ball">8-Ball</option><option value="9-ball">9-Ball</option>';
    // Same four choices the official APA Scorekeeper app offers.
    const tableOpts = [
      ['coin-7', '7-foot Coin-Op'],
      ['coin-8', '8-foot Coin-Op'],
      ['reg-8', '8-foot Regulation'],
      ['reg-9', '9-foot Regulation']
    ].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

    // Build player dropdowns grouped by team
    let playerOpts = '<option value="">Select player...</option>';
    for (const p of players) {
      const team = teams.find(t => t.id === p.teamId);
      const teamName = team ? team.name : 'No Team';
      playerOpts += `<option value="${p.id}">${esc(p.name)} (SL${p.skillLevel}) — ${esc(teamName)}</option>`;
    }

    showModal(`<div class="modal-title">New Match <span class="modal-close" onclick="closeModal()">×</span></div>
      <div class="form-group">
        <label>Format</label>
        <select id="nm-format" onchange="ui.updateMatchForm()">${formatOpts}</select>
      </div>
      <div class="form-group">
        <label>Table Size</label>
        <select id="nm-table">${tableOpts}</select>
      </div>
      <div class="form-group">
        <label>Home Player</label>
        <select id="nm-home">${playerOpts}</select>
      </div>
      <div class="form-group">
        <label>Away Player</label>
        <select id="nm-away">${playerOpts}</select>
      </div>
      <div id="nm-race-preview" class="text-center text-dim text-sm mt-8"></div>
      <div class="mt-16">
        <button class="btn btn-primary" onclick="ui.createMatchFromForm()">Start Match</button>
      </div>
      <div style="height:20px;"></div>
    `);

    // Update race preview when players change
    document.getElementById('nm-home').addEventListener('change', () => this.updateMatchForm());
    document.getElementById('nm-away').addEventListener('change', () => this.updateMatchForm());
    this.updateMatchForm();
  },

  updateMatchForm() {
    const format = document.getElementById('nm-format').value;
    const homeId = parseInt(document.getElementById('nm-home').value);
    const awayId = parseInt(document.getElementById('nm-away').value);
    const preview = document.getElementById('nm-race-preview');
    if (!homeId || !awayId) { preview.textContent = 'Select both players to see race targets'; return; }
    const home = players.find(p => p.id === homeId);
    const away = players.find(p => p.id === awayId);
    if (!home || !away) return;
    let txt = '';
    if (format === '8-ball') {
      const race = get8BallRace(home.skillLevel, away.skillLevel);
      if (race) txt = `${esc(home.name)} races to ${race.home} — ${esc(away.name)} races to ${race.away}`;
    } else {
      const hp = get9BallPoints(home.skillLevel);
      const ap = get9BallPoints(away.skillLevel);
      txt = `${esc(home.name)} needs ${hp} pts — ${esc(away.name)} needs ${ap} pts`;
    }
    if (homeId === awayId) txt = '⚠️ Select two different players';
    preview.textContent = txt;
  },

  async createMatchFromForm() {
    const format = document.getElementById('nm-format').value;
    const tableSize = document.getElementById('nm-table').value;
    const homeId = parseInt(document.getElementById('nm-home').value);
    const awayId = parseInt(document.getElementById('nm-away').value);

    if (!homeId || !awayId) { showToast('Please select both players'); return; }
    if (homeId === awayId) { showToast('Home and away must be different players'); return; }

    const home = players.find(p => p.id === homeId);
    const away = players.find(p => p.id === awayId);
    const homeTeam = teams.find(t => t.id === home.teamId);
    const awayTeam = teams.find(t => t.id === away.teamId);

    // Use the correct skill level for the format
    const homeSL = format === '9-ball' ? (home.skillLevel9 || home.skillLevel || 3) : (home.skillLevel8 || home.skillLevel || 3);
    const awaySL = format === '9-ball' ? (away.skillLevel9 || away.skillLevel || 3) : (away.skillLevel8 || away.skillLevel || 3);

    const match = createMatch(format,
      homeTeam ? homeTeam.name : 'Home',
      awayTeam ? awayTeam.name : 'Away',
      { id: home.id, name: home.name, skillLevel: homeSL },
      { id: away.id, name: away.name, skillLevel: awaySL }
    );
    match.tableSize = tableSize;
    await saveMatch(match);
    closeModal();
    this.openMatch(match.id);
  },

  async openMatch(matchId) {
    currentMatch = await getMatch(matchId);
    if (!currentMatch) { showToast('Match not found'); return; }
    this.switchView('match');
    this.renderMatch();
  },

  renderMatch() {
    if (!currentMatch) return;
    const m = currentMatch;
    // Set global currentRack for use by rack modal functions
    currentRack = m.racks.length > 0 ? m.racks[m.racks.length - 1] : null;
    const score = getRunningScore(m);
    const totalInnings = getTotalInnings(m);

    let html = `
      <div class="scoreboard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="badge badge-${m.format === '8-ball' ? '8ball' : '9ball'}">${m.format === '8-ball' ? '8-Ball' : '9-Ball'}</span>
          ${m.status === 'completed' ? '<span class="badge badge-completed">Completed</span>' : m.status === 'in_progress' ? '<span class="badge badge-in-progress">In Progress</span>' : '<span class="badge badge-setup">Setup</span>'}
        </div>
        <div class="score-row" style="margin-top:12px;">
          <div class="score-side">
            <div class="score-name">${esc(m.homePlayer.name)} (SL${m.homePlayer.skillLevel})</div>
            <div class="score-value">${score.home}<span class="target"> / ${score.homeTarget}</span></div>
          </div>
          <div class="score-divider"></div>
          <div class="score-side">
            <div class="score-name">${esc(m.awayPlayer.name)} (SL${m.awayPlayer.skillLevel})</div>
            <div class="score-value">${score.away}<span class="target"> / ${score.awayTarget}</span></div>
          </div>
        </div>
        <div class="score-vs">${m.homeTeam} vs ${m.awayTeam}</div>
        ${m.lagWinner ? `<div class="text-center text-sm" style="color:var(--blue);margin-top:4px;">🏁 Lag winner: ${m.lagWinner === 'home' ? esc(m.homePlayer.name) : esc(m.awayPlayer.name)}</div>` : ''}
      </div>
    `;

    // Sudden Death banner (APA time-limit procedure)
    if (m.suddenDeath) {
      const sd = getSuddenDeathPoints(m);
      html += `<div class="card sd-banner">
        <div class="font-bold" style="color:var(--yellow);">⚡ SUDDEN DEATH</div>
        ${m.format === '8-ball'
          ? `<div class="text-sm mt-8">Racks are worth team points: <b>2</b> for the first, <b>1</b> after that.
             ${sd.home || sd.away ? `<br>SD points — ${esc(m.homePlayer.name)}: <b>${sd.home}</b> · ${esc(m.awayPlayer.name)}: <b>${sd.away}</b>` : ''}</div>`
          : `<div class="text-sm mt-8">Every ball counts <b>double</b>, including the 9-ball.</div>`}
      </div>`;
    }

    // Action buttons based on match status
    if (m.status === 'setup') {
      html += `
        <div class="card">
          <div class="section-title">Lag Winner</div>
          <p class="text-sm text-dim mb-8">Who won the lag? This determines who breaks first.</p>
          <div class="btn-row">
            <button class="btn btn-secondary" onclick="ui.setLag('home')">🏠 ${esc(m.homePlayer.name)} (SL${m.homePlayer.skillLevel})</button>
            <button class="btn btn-secondary" onclick="ui.setLag('away')">👥 ${esc(m.awayPlayer.name)} (SL${m.awayPlayer.skillLevel})</button>
          </div>
        </div>
        ${m.lagWinner ? `
        <div class="card">
          <div class="text-center" style="color:var(--blue);">
            <div class="font-bold" style="font-size:1.1rem;">🏁 Lag Winner: ${m.lagWinner === 'home' ? esc(m.homePlayer.name) : esc(m.awayPlayer.name)}</div>
            <div class="text-sm text-dim mt-8">${m.lagWinner === 'home' ? esc(m.homePlayer.name) : esc(m.awayPlayer.name)} breaks first!</div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="ui.startFirstRack()">Start First Rack</button>
        ` : ''}
        <div class="mt-8">
          <button class="btn btn-danger" style="font-size:0.85rem;" onclick="ui.deleteMatch()">Delete Match</button>
        </div>
      `;
    } else if (m.status === 'in_progress') {
      // Current rack info
      const rack = m.racks[m.racks.length - 1];
      currentRack = rack;
      const homeDef = getTotalDefensiveShots(m, 'home');
      const awayDef = getTotalDefensiveShots(m, 'away');
      const homeTO = getTotalTimeouts(m, 'home');
      const awayTO = getTotalTimeouts(m, 'away');

      // ── Live scoring controls (while rack is in progress) ──
      if (!rack.winner) {
        html += `
        <div class="live-scorer">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div>
              <span class="text-dim text-sm">Rack ${rack.rackNumber}</span>
              <div class="font-bold">🔴 In Progress</div>
            </div>
            <button class="btn btn-primary" style="width:auto;padding:10px 18px;" onclick="ui.endRackForm()">End Rack</button>
          </div>

          <div class="section-title">Innings This Rack</div>
          <div class="stepper">
            <button class="step-btn" onclick="ui.adjustInnings(-1)">−</button>
            <span class="step-count" id="live-innings">${rack.innings || 0}</span>
            <button class="step-btn" onclick="ui.adjustInnings(1)">+</button>
          </div>

          <div class="section-title" style="margin-top:14px;">Player Stats</div>
          <div class="scorer-row">
            <span class="scorer-name">🏠 ${esc(m.homePlayer.name)}</span>
            <div class="scorer-actions">
              <button class="chip-btn ${rack.homeTimeouts > 0 ? 'toggled' : ''}" onclick="ui.toggleTimeout('home')">
                <span>⏱ Timeout</span><span class="chip-num" id="live-hto">${rack.homeTimeouts || 0}/${maxTimeoutsPerRack(m.homePlayer.skillLevel)}</span>
              </button>
              <button class="chip-btn" onclick="ui.adjustDefensive('home', 1)">
                <span>🛡 Defensive</span><span class="chip-num" id="live-hdef">${rack.homeDefensiveShots || 0}</span>
              </button>
            </div>
          </div>
          <div class="scorer-row">
            <span class="scorer-name">👥 ${esc(m.awayPlayer.name)}</span>
            <div class="scorer-actions">
              <button class="chip-btn ${rack.awayTimeouts > 0 ? 'toggled' : ''}" onclick="ui.toggleTimeout('away')">
                <span>⏱ Timeout</span><span class="chip-num" id="live-ato">${rack.awayTimeouts || 0}/${maxTimeoutsPerRack(m.awayPlayer.skillLevel)}</span>
              </button>
              <button class="chip-btn" onclick="ui.adjustDefensive('away', 1)">
                <span>🛡 Defensive</span><span class="chip-num" id="live-adef">${rack.awayDefensiveShots || 0}</span>
              </button>
            </div>
          </div>
        </div>
        `;

        // 9-ball: live ball picker with player toggle
        if (m.format === '9-ball') {
          if (!rack._balls) rack._balls = rack.balls || [];
          if (!rack._scorerSide) rack._scorerSide = 'home';
          html += `
          <div class="live-scorer">
            <div class="section-title">9-Ball — Who Made Each Ball</div>
            <div class="scorer-toggle">
              <button class="btn ${rack._scorerSide === 'home' ? 'active' : 'btn-secondary'}" id="tog-home" onclick="ui.setScorerSide('home')">🏠 ${esc(m.homePlayer.name)}</button>
              <button class="btn ${rack._scorerSide === 'away' ? 'active' : 'btn-secondary'}" id="tog-away" onclick="ui.setScorerSide('away')">👥 ${esc(m.awayPlayer.name)}</button>
              <button class="btn ${rack._scorerSide === 'dead' ? 'active' : 'btn-secondary'}" id="tog-dead" onclick="ui.setScorerSide('dead')">💀 Dead</button>
            </div>
            <div class="ball-grid-sm" id="live-ball-grid"></div>
            <div class="live-total" id="live-ball-total"></div>
          </div>
          `;
        }

        // 8-ball: live ball picker with player toggle
        if (m.format === '8-ball') {
          if (!rack._eightBalls) rack._eightBalls = rack.eightBalls || [];
          if (!rack._scorerSide) rack._scorerSide = 'home';
          html += `
          <div class="live-scorer">
            <div class="section-title">8-Ball — Who Made Each Ball</div>
            <div class="scorer-toggle">
              <button class="btn ${rack._scorerSide === 'home' ? 'active' : 'btn-secondary'}" id="tog-home" onclick="ui.setScorerSide('home')">🏠 ${esc(m.homePlayer.name)}</button>
              <button class="btn ${rack._scorerSide === 'away' ? 'active' : 'btn-secondary'}" id="tog-away" onclick="ui.setScorerSide('away')">👥 ${esc(m.awayPlayer.name)}</button>
              <button class="btn ${rack._scorerSide === 'dead' ? 'active' : 'btn-secondary'}" id="tog-dead" onclick="ui.setScorerSide('dead')">💀 Dead</button>
            </div>
            <div class="ball-grid-15" id="live-eightball-grid"></div>
            <div class="live-total" id="live-eightball-totals"></div>
          </div>
          `;
        }
      }

      // Rack over banner (if current rack already has a winner, e.g. after modal close)
      if (rack.winner) {
        html += `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span class="text-dim text-sm">Rack ${rack.rackNumber}</span>
              <div class="font-bold" style="color:var(--green);">✅ Rack Over — ${rack.winner === 'home' ? esc(m.homePlayer.name) : esc(m.awayPlayer.name)} won</div>
            </div>
            <button class="btn btn-primary" style="width:auto;padding:10px 18px;" onclick="ui.startNewRack()">Start Next Rack</button>
          </div>
        </div>
        `;
      }

      // Match totals card
      html += `
        <div class="card">
          <div class="section-title">Match Totals</div>
          <div class="stat-row"><span class="stat-label">Total Innings</span><span class="stat-value">${totalInnings}</span></div>
          <div class="stat-row"><span class="stat-label">${esc(m.homePlayer.name)} Defensive Shots</span><span class="stat-value">${homeDef}</span></div>
          <div class="stat-row"><span class="stat-label">${esc(m.awayPlayer.name)} Defensive Shots</span><span class="stat-value">${awayDef}</span></div>
          <div class="stat-row"><span class="stat-label">${esc(m.homePlayer.name)} Timeouts</span><span class="stat-value">${homeTO}</span></div>
          <div class="stat-row"><span class="stat-label">${esc(m.awayPlayer.name)} Timeouts</span><span class="stat-value">${awayTO}</span></div>
        </div>
      `;

      // Rack list
      if (m.racks.length > 0) {
        html += '<div class="section-title">Racks</div>';
        for (const r of m.racks) {
          const rackScore = m.format === '8-ball'
            ? `${r.winner === 'home' ? 'H' : r.winner === 'away' ? 'A' : '-'}`
            : `${r.homeBallPoints || 0}-${r.awayBallPoints || 0}`;
          const endLabel = r.endType ? RACK_END_LABELS[r.endType] || r.endType : '';
          html += `<div class="rack-item" onclick="ui.viewRack(${r.rackNumber - 1})">
            <span class="rack-number">Rack ${r.rackNumber}</span>
            <span class="rack-result">${rackScore} ${endLabel ? '· ' + endLabel : ''}</span>
          </div>`;
          // Add edit button for completed racks
          if (r.winner) {
            html += `<div style="text-align:right;margin-top:-4px;margin-bottom:4px;">
              <button class="btn btn-secondary" style="width:auto;padding:4px 12px;font-size:0.75rem;" onclick="event.stopPropagation();ui.editRack(${r.rackNumber - 1})">✏️ Edit</button>
            </div>`;
          }
        }
      }

      // Sudden Death control (time limit hit before the match finished)
      if (!m.suddenDeath) {
        html += `
        <div class="mt-16">
          <button class="btn btn-secondary" onclick="ui.startSuddenDeath()">⚡ Start Sudden Death (time limit)</button>
          <p class="text-sm text-dim text-center mt-8">8-ball: next rack worth 2 points, then 1. 9-ball: all ball points doubled.</p>
        </div>`;
      }

      // Action buttons
      html += `
        <div class="mt-16">
          <div class="btn-row">
            <button class="btn btn-danger" style="flex:1;" onclick="ui.forfeitMatch()">Forfeit</button>
            <button class="btn btn-secondary" style="flex:1;" onclick="ui.undoLastRack()">Undo Last Rack</button>
          </div>
          <div class="text-center mt-8">
            <button class="btn btn-danger" style="width:auto;padding:6px 14px;font-size:0.75rem;display:inline-block;" onclick="ui.deleteMatch()">🗑 Delete Match</button>
          </div>
        </div>
      `;
    } else if (m.status === 'completed') {
      const summary = generateMatchSummary(m);
      html += `
        <div class="card">
          <div class="section-title">Match Complete</div>
          <div class="text-center" style="font-size:1.5rem;font-weight:800;color:var(--green);">
            ${m.winner ? esc(m.winner === 'home' ? m.homePlayer.name : m.awayPlayer.name) + ' Wins! 🏆' : 'Double Forfeit'}
          </div>
          <div class="text-center text-dim mt-8">
            ${summary.forfeit
              ? `Forfeit — ${summary.forfeit === 'double' ? 'both players' : (summary.forfeit === 'home' ? esc(m.homePlayer.name) : esc(m.awayPlayer.name))} forfeited`
              : (m.suddenDeath && m.format === '8-ball' && m.finalScore
                ? `Final: ${m.finalScore.home} - ${m.finalScore.away} (Sudden Death points)`
                : `Final: ${summary.homeScore} - ${summary.awayScore}`)}
          </div>
          ${summary.matchPoints ? `<div class="text-center mt-8" style="color:var(--yellow);font-weight:700;">
            Match Points: ${summary.matchPoints.home} - ${summary.matchPoints.away}${m.suddenDeath && !summary.forfeit ? ' (Sudden Death)' : ''}
          </div>` : ''}
        </div>
        <div class="card">
          <div class="section-title">Summary</div>
          <div class="stat-row"><span class="stat-label">Format</span><span class="stat-value">${summary.format}</span></div>
          <div class="stat-row"><span class="stat-label">Table</span><span class="stat-value">${summary.tableSize}</span></div>
          ${summary.matchPoints ? `<div class="stat-row"><span class="stat-label">Match Points${m.format === '8-ball' && !summary.forfeit && !m.suddenDeath ? ' (3-Point System)' : ''}</span><span class="stat-value">${summary.matchPoints.home} - ${summary.matchPoints.away}</span></div>` : ''}
          <div class="stat-row"><span class="stat-label">Total Innings</span><span class="stat-value">${summary.totalInnings}</span></div>
          <div class="stat-row"><span class="stat-label">${summary.homePlayer} Defensive Shots</span><span class="stat-value">${summary.homeDefensiveShots}</span></div>
          <div class="stat-row"><span class="stat-label">${summary.awayPlayer} Defensive Shots</span><span class="stat-value">${summary.awayDefensiveShots}</span></div>
          <div class="stat-row"><span class="stat-label">${summary.homePlayer} Timeouts</span><span class="stat-value">${summary.homeTimeouts}</span></div>
          <div class="stat-row"><span class="stat-label">${summary.awayPlayer} Timeouts</span><span class="stat-value">${summary.awayTimeouts}</span></div>
          <div class="stat-row"><span class="stat-label">Racks Played</span><span class="stat-value">${summary.racksPlayed}</span></div>
        </div>
        <div class="mt-16">
          <div class="btn-row">
            <button class="btn btn-secondary" onclick="ui.exportMatchSummary()">Export Summary</button>
            <button class="btn btn-danger" onclick="ui.deleteMatch()">Delete Match</button>
          </div>
        </div>
      `;
    }

    $('match-content').innerHTML = html;

    // Render live ball grids after DOM is ready
    if (m.status === 'in_progress' && currentRack && !currentRack.winner) {
      if (m.format === '9-ball' && currentRack._balls !== undefined) this.renderLiveBallGrid();
      if (m.format === '8-ball' && currentRack._eightBalls !== undefined) this.renderLiveEightBallGrid();
    }

    // Don't let the phone sleep mid-rack.
    this.keepAwake(m.status === 'in_progress');
  },

  // ── Lag ──
  async setLag(side) {
    setLagWinner(currentMatch, side);
    await saveMatch(currentMatch);
    this.renderMatch();
    showToast(`${side === 'home' ? currentMatch.homePlayer.name : currentMatch.awayPlayer.name} won the lag`);
  },

  // ── Live scoring controls ──
  async adjustInnings(delta) {
    const rack = currentRack;
    if (!rack || rack.winner) return;
    const newVal = Math.max(0, (rack.innings || 0) + delta);
    rack.innings = newVal;
    const el = document.getElementById('live-innings');
    if (el) el.textContent = newVal;
    await saveMatch(currentMatch);
  },

  async toggleTimeout(side) {
    const rack = currentRack;
    if (!rack || rack.winner) return;
    const key = side === 'home' ? 'homeTimeouts' : 'awayTimeouts';
    // Per-game limit from the Team Manual: SL4+ = 1, SL2/SL3 (and non-rated) = 2.
    const player = side === 'home' ? currentMatch.homePlayer : currentMatch.awayPlayer;
    const max = maxTimeoutsPerRack(player.skillLevel);
    const current = rack[key] || 0;
    // Cycle 0 → 1 → … → max → 0
    rack[key] = current >= max ? 0 : current + 1;
    const id = side === 'home' ? 'live-hto' : 'live-ato';
    const el = document.getElementById(id);
    if (el) el.textContent = `${rack[key]}/${max}`;
    const btn = el && el.closest('.chip-btn');
    if (btn) {
      btn.classList.toggle('toggled', rack[key] > 0);
      btn.title = `${rack[key]} of ${max} time-out${max === 1 ? '' : 's'} used this game`;
    }
    await saveMatch(currentMatch);
    if (current >= max) showToast(`Time-out cleared (limit ${max} per game)`);
  },

  async adjustDefensive(side, delta) {
    const rack = currentRack;
    if (!rack || rack.winner) return;
    const key = side === 'home' ? 'homeDefensiveShots' : 'awayDefensiveShots';
    const newVal = Math.max(0, (rack[key] || 0) + delta);
    rack[key] = newVal;
    const id = side === 'home' ? 'live-hdef' : 'live-adef';
    const el = document.getElementById(id);
    if (el) el.textContent = newVal;
    await saveMatch(currentMatch);
  },

  async setScorerSide(side) {
    const rack = currentRack;
    if (!rack || rack.winner) return;
    rack._scorerSide = side;
    // Update toggle button styles
    ['home', 'away', 'dead'].forEach(s => {
      const btn = document.getElementById('tog-' + s);
      if (btn) btn.className = s === side ? 'btn active' : 'btn btn-secondary';
    });
    await saveMatch(currentMatch);
  },

  async pickBall(num) {
    const rack = currentRack;
    if (!rack || rack.winner) return;
    const side = rack._scorerSide || 'home';
    // APA: "The 9-ball is never a dead ball. It is spotted."
    if (num === 9 && side === 'dead') {
      showToast('The 9-ball is never dead — it gets spotted');
      return;
    }
    if (!rack._balls) rack._balls = [];
    const existing = rack._balls.find(b => b.number === num);
    // Toggle off: if ball exists and is assigned to the same side, remove it
    let next = side;
    if (existing && existing.pocketedBy === side && !existing.dead && side !== 'dead') next = null;
    rack._balls = rack._balls.filter(b => b.number !== num);
    if (next) rack._balls.push({ number: num, pocketedBy: side === 'dead' ? null : side, dead: side === 'dead' });
    this.renderLiveBallGrid();
    await saveMatch(currentMatch);
  },

  renderLiveBallGrid() {
    const m = currentMatch;
    const rack = currentRack;
    if (!rack || !rack._balls) return;
    const grid = document.getElementById('live-ball-grid');
    const total = document.getElementById('live-ball-total');
    if (!grid) return;

    const colors = { 1: 'ball-1', 2: 'ball-2', 3: 'ball-3', 4: 'ball-4', 5: 'ball-5', 6: 'ball-6', 7: 'ball-7', 8: 'ball-8', 9: 'ball-9' };
    let html = '';
    for (let i = 1; i <= 9; i++) {
      const ball = rack._balls.find(b => b.number === i);
      let cls = colors[i] + ' ball-sm';
      let owner = '';
      if (ball) {
        if (ball.dead) cls += ' picked-dead';
        else if (ball.pocketedBy === 'home') { cls += ' picked-home'; owner = '<span class="ball-owner">🏠</span>'; }
        else if (ball.pocketedBy === 'away') { cls += ' picked-away'; owner = '<span class="ball-owner">👥</span>'; }
      }
      html += `<button class="${cls}" onclick="ui.pickBall(${i})">${i}${owner}</button>`;
    }
    grid.innerHTML = html;

    // Running total
    const homeBalls = rack._balls.filter(b => !b.dead && b.pocketedBy === 'home');
    const awayBalls = rack._balls.filter(b => !b.dead && b.pocketedBy === 'away');
    const homePts = homeBalls.reduce((s, b) => s + (b.number === 9 ? 2 : 1), 0);
    const awayPts = awayBalls.reduce((s, b) => s + (b.number === 9 ? 2 : 1), 0);
    // Add previous racks' points
    let prevHome = 0, prevAway = 0;
    m.racks.forEach((r, i) => {
      if (i !== m.racks.length - 1) {
        prevHome += r.homeBallPoints || 0;
        prevAway += r.awayBallPoints || 0;
      }
    });
    total.innerHTML = `<span class="side home">🏠 ${esc(m.homePlayer.name)}: ${homePts} rack / ${prevHome + homePts} tot</span>
      <span class="side away">👥 ${esc(m.awayPlayer.name)}: ${awayPts} rack / ${prevAway + awayPts} tot</span>`;
  },

  async pickEightBall(num) {
    const rack = currentRack;
    if (!rack || rack.winner) return;
    const side = rack._scorerSide || 'home';
    if (!rack._eightBalls) rack._eightBalls = [];
    const existing = rack._eightBalls.find(b => b.number === num);
    let next = side;
    if (existing && existing.pocketedBy === side && !existing.dead) next = null;
    rack._eightBalls = rack._eightBalls.filter(b => b.number !== num);
    if (next) rack._eightBalls.push({ number: num, pocketedBy: side === 'dead' ? null : side, dead: side === 'dead' });
    this.renderLiveEightBallGrid();
    await saveMatch(currentMatch);
  },

  renderLiveEightBallGrid() {
    const m = currentMatch;
    const rack = currentRack;
    if (!rack || !rack._eightBalls) return;
    const grid = document.getElementById('live-eightball-grid');
    const totals = document.getElementById('live-eightball-totals');
    if (!grid) return;

    const colors = {
      1: '#fbbf24', 2: '#3b82f6', 3: '#ef4444', 4: '#9333ea', 5: '#f97316', 6: '#059669', 7: '#92400e',
      8: '#1a1a1a', 9: '#fbbf24', 10: '#3b82f6', 11: '#ef4444', 12: '#9333ea', 13: '#f97316', 14: '#059669', 15: '#92400e'
    };
    let html = '';
    for (let i = 1; i <= 15; i++) {
      const ball = rack._eightBalls.find(b => b.number === i);
      let cls = 'ball-xs';
      let owner = '';
      let style = `background:${colors[i]};border-color:${colors[i]};color:${i === 8 ? '#fff' : '#000'};`;
      if (i === 8) style = 'background:#1a1a1a;border-color:#555;color:#fff;';
      if (ball) {
        if (ball.dead) cls += ' picked-dead';
        else if (ball.pocketedBy === 'home') { cls += ' picked-home'; owner = '<span class="ball-owner">🏠</span>'; }
        else if (ball.pocketedBy === 'away') { cls += ' picked-away'; owner = '<span class="ball-owner">👥</span>'; }
      }
      html += `<button class="${cls}" style="${style}" onclick="ui.pickEightBall(${i})">${i}${owner}</button>`;
    }
    grid.innerHTML = html;

    const homeCount = rack._eightBalls.filter(b => !b.dead && b.pocketedBy === 'home').length;
    const awayCount = rack._eightBalls.filter(b => !b.dead && b.pocketedBy === 'away').length;
    const deadCount = rack._eightBalls.filter(b => b.dead).length;
    totals.innerHTML = `<span class="side home">🏠 ${esc(m.homePlayer.name)}: ${homeCount}</span>
      <span class="side away">👥 ${esc(m.awayPlayer.name)}: ${awayCount}</span>
      <span class="side text-dim">💀 Dead: ${deadCount}</span>`;
  },

  // ── Rack actions ──
  async startFirstRack() {
    const rack = startRack(currentMatch);
    currentRack = rack;
    await saveMatch(currentMatch);
    this.renderMatch();
    showToast(`Rack 1 started — ${currentMatch.lagWinner === 'home' ? currentMatch.homePlayer.name : currentMatch.awayPlayer.name} breaks`);
  },

  async startNewRack() {
    // A completed match must not accept more racks.
    if (!currentMatch || currentMatch.status === 'completed') {
      showToast('This match is already complete');
      return;
    }
    const rack = startRack(currentMatch);
    currentRack = rack;
    await saveMatch(currentMatch);
    this.renderMatch();
    showToast(`Rack ${rack.rackNumber} started`);
  },

  endRackForm() {
    const m = currentMatch;
    // Editing an already-scored rack reopens the match; starting a fresh rack
    // on a finished match must not.
    if (m.status === 'completed' && !this._editingRack) {
      showToast('Match is complete — undo a rack first to change it');
      return;
    }
    const wasEditing = this._editingRack;
    this._editingRack = false;
    const rack = (currentRack && m.racks.includes(currentRack)) ? currentRack : m.racks[m.racks.length - 1];
    currentRack = rack;
    if (!rack) return;
    // A rack that already has a winner can only be reopened through editRack().
    if (rack.winner && !wasEditing) return;

    const isEdit = rack.endType !== null;
    if (isEdit) {
      if (m.format === '9-ball' && rack.balls && rack.balls.length > 0) {
        rack._balls = rack.balls.map(b => ({ number: b.number, pocketedBy: b.pocketedBy, dead: b.dead }));
      }
      if (m.format === '8-ball' && rack.eightBalls && rack.eightBalls.length > 0) {
        rack._eightBalls = rack.eightBalls.map(b => ({ number: b.number, pocketedBy: b.pocketedBy, dead: b.dead }));
      }
      rack._tempEndType = rack.endType;
      rack.winner = null;
      rack.endType = null;
      rack.endedAt = null;
      m.status = 'in_progress';
      m.winner = null;
      m.finalScore = null;
      m.completedAt = null;
    }

    // Helper to build an end-type button. type includes format prefix and side/winner.
    const btn = (type, label, sub, cls='') => `<button class="endtype-btn ${cls}" onclick="ui.selectEndType('${type}')">${label}<br><small style="font-weight:400;">${sub}</small></button>`;

    let html = `<div class="modal-title">${isEdit ? 'Edit' : 'End'} Rack ${rack.rackNumber} <span class="modal-close" onclick="closeModal()">×</span></div>`;
    html += `<p class="text-sm text-dim mb-16">Tap an outcome. The winner is baked into the button.</p>`;
    if (m.suddenDeath) {
      html += `<div class="card" style="box-shadow:none;background:var(--surface2);margin-bottom:12px;">
        <div class="text-sm" style="color:var(--yellow);">⚡ Sudden Death — ${m.format === '8-ball'
          ? `this rack is worth <b>${nextSuddenDeathRackValue(m)} point${nextSuddenDeathRackValue(m) === 1 ? '' : 's'}</b>`
          : 'every ball counts <b>double</b>'}</div>
      </div>`;
    }

    if (m.format === '8-ball') {
      html += `<div class="form-group"><label>🏠 ${esc(m.homePlayer.name)} wins</label><div class="endtype-grid">` +
        btn('home:STANDARD', '🎯 8-Ball Made', 'standard win') +
        btn('home:EIGHT_ON_BREAK', '💥 8 on Break', 'on the break') +
        btn('home:EIGHT_BREAK_AND_RUN', '🏃 Break & Run', 'ran out') +
        `</div></div>`;
      html += `<div class="form-group"><label>🏠 ${esc(m.homePlayer.name)} loses</label><div class="endtype-grid">` +
        btn('away:STANDARD', '🎯 8-Ball Made by Away', 'away wins normally') +
        btn('away:EIGHT_ON_BREAK', '💥 Away 8 on Break', 'away made on break') +
        btn('away:EIGHT_BREAK_AND_RUN', '🏃 Away Break & Run', 'away ran out') +
        btn('away:EIGHT_EARLY', '⏰ Home Early 8', 'home sank 8 early → away wins') +
        btn('away:SCRATCH_ON_EIGHT', '🔲 Home Scratch on 8', 'home scratched → away wins') +
        btn('away:WRONG_POCKET', '❌ Home Wrong Pocket', 'home wrong pocket → away wins') +
        `</div></div>`;
      html += `<div class="form-group"><label>👥 ${esc(m.awayPlayer.name)} loses</label><div class="endtype-grid">` +
        btn('home:EIGHT_EARLY', '⏰ Away Early 8', 'away sank 8 early → home wins') +
        btn('home:SCRATCH_ON_EIGHT', '🔲 Away Scratch on 8', 'away scratched → home wins') +
        btn('home:WRONG_POCKET', '❌ Away Wrong Pocket', 'away wrong pocket → home wins') +
        `</div></div>`;
      html += `<div class="form-group"><label>No winner</label><div class="endtype-grid">` +
        btn('null:STALEMATE', '🤝 Stalemate', 're-rack') +
        `</div></div>`;
    } else {
      html += `<div class="form-group"><label>🏠 ${esc(m.homePlayer.name)} wins</label><div class="endtype-grid">` +
        btn('home:STANDARD', '🎯 9-ball Made', 'standard win') +
        btn('home:NINE_ON_SNAP', '💥 9 on Snap', 'on the break') +
        btn('home:NINE_BREAK_AND_RUN', '🏃 Break & Run', 'home runs out') +
        `</div></div>`;
      html += `<div class="form-group"><label>👥 ${esc(m.awayPlayer.name)} wins</label><div class="endtype-grid">` +
        btn('away:STANDARD', '🎯 9-ball Made', 'standard win') +
        btn('away:NINE_ON_SNAP', '💥 9 on Snap', 'on the break') +
        btn('away:NINE_BREAK_AND_RUN', '🏃 Break & Run', 'away runs out') +
        `</div></div>`;
      html += `<div class="form-group"><label>No winner</label><div class="endtype-grid">` +
        btn('null:STALEMATE', '🤝 Stalemate', 're-rack') +
        `</div></div>`;
    }

    html += `<div class="mt-16"><button class="btn btn-primary" onclick="ui.submitEndRack('${m.format}')">${isEdit ? 'Save Changes' : 'End Rack'}</button></div><div style="height:20px;"></div>`;
    showModal(html);
  },

  selectEndType(type) {
    if (!currentRack) return;
    const [winner, endType] = type.split(':');
    currentRack._tempWinner = winner === 'null' ? null : winner;
    currentRack._tempEndType = endType;
    document.querySelectorAll('.endtype-btn').forEach(b => b.classList.remove('selected'));
    event.target.closest('.endtype-btn').classList.add('selected');
  },

  async submitEndRack(format) {
    const m = currentMatch;
    const rack = (currentRack && m.racks.includes(currentRack)) ? currentRack : m.racks[m.racks.length - 1];

    if (!rack._tempEndType) {
      showToast('Please select how the rack ended');
      return;
    }
    const endType = rack._tempEndType;
    // Winner is encoded in the end-type selection (null for stalemate)
    const winner = rack._tempWinner !== undefined ? rack._tempWinner : null;

    rack.innings = rack.innings || 0;
    rack.homeDefensiveShots = rack.homeDefensiveShots || 0;
    rack.awayDefensiveShots = rack.awayDefensiveShots || 0;
    rack.homeTimeouts = rack.homeTimeouts || 0;
    rack.awayTimeouts = rack.awayTimeouts || 0;

    if (format === '9-ball') {
      rack.balls = (rack._balls || []).map(b => ({
        number: b.number,
        pocketedBy: b.pocketedBy || 'home',
        dead: b.dead || false
      }));
    } else {
      rack.balls = [];
      rack.eightBalls = (rack._eightBalls || []).map(b => ({
        number: b.number,
        pocketedBy: b.pocketedBy || null,
        dead: b.dead || false
      }));
    }

    endRack(m, rack, endType, winner);

    delete rack._tempWinner;
    delete rack._tempEndType;
    delete rack._balls;
    delete rack._eightBalls;
    delete rack._scorerSide;

    await saveMatch(m);
    closeModal();
    currentMatch = m;
    this.renderMatch();

    if (m.status === 'completed') {
      showToast(`Match over! ${m.winner === 'home' ? m.homePlayer.name : m.awayPlayer.name} wins! 🏆`);
    } else {
      showToast(`Rack ${rack.rackNumber} ended`);
    }
  },

  viewRack(index) {
    const m = currentMatch;
    const rack = m.racks[index];
    if (!rack) return;
    const endLabel = rack.endType ? RACK_END_LABELS[rack.endType] || rack.endType : 'In Progress';
    let html = `<div class="modal-title">Rack ${rack.rackNumber} <span class="modal-close" onclick="closeModal()">×</span></div>
      <div class="card">
        <div class="stat-row"><span class="stat-label">Winner</span><span class="stat-value">${rack.winner ? (rack.winner === 'home' ? esc(m.homePlayer.name) : esc(m.awayPlayer.name)) : '—'}</span></div>
        <div class="stat-row"><span class="stat-label">End Type</span><span class="stat-value">${endLabel}</span></div>
        <div class="stat-row"><span class="stat-label">Innings</span><span class="stat-value">${rack.innings || 0}</span></div>`;
    if (m.format === '9-ball') {
      html += `<div class="stat-row"><span class="stat-label">${esc(m.homePlayer.name)} Ball Points</span><span class="stat-value">${rack.homeBallPoints || 0}</span></div>
        <div class="stat-row"><span class="stat-label">${esc(m.awayPlayer.name)} Ball Points</span><span class="stat-value">${rack.awayBallPoints || 0}</span></div>
        <div class="stat-row"><span class="stat-label">Dead Balls</span><span class="stat-value">${rack.deadBalls || 0}</span></div>`;
      if (rack.balls && rack.balls.length > 0) {
        html += '<div class="section-title">Balls</div>';
        rack.balls.forEach(b => {
          html += `<div class="stat-row"><span class="stat-label">Ball ${b.number}${b.dead ? ' (Dead)' : ''}</span><span class="stat-value">${b.pocketedBy === 'home' ? esc(m.homePlayer.name) : b.pocketedBy === 'away' ? esc(m.awayPlayer.name) : 'Dead'}</span></div>`;
        });
      }
    }
    if (m.format === '8-ball' && rack.eightBalls && rack.eightBalls.length > 0) {
      html += '<div class="section-title">Balls Pocketed</div>';
      rack.eightBalls.forEach(b => {
        html += `<div class="stat-row"><span class="stat-label">Ball ${b.number}${b.dead ? ' (Dead)' : ''}</span><span class="stat-value">${b.pocketedBy === 'home' ? esc(m.homePlayer.name) : b.pocketedBy === 'away' ? esc(m.awayPlayer.name) : 'Dead'}</span></div>`;
      });
    }
    html += `<div class="stat-row"><span class="stat-label">${esc(m.homePlayer.name)} Defensive Shots</span><span class="stat-value">${rack.homeDefensiveShots || 0}</span></div>
      <div class="stat-row"><span class="stat-label">${esc(m.awayPlayer.name)} Defensive Shots</span><span class="stat-value">${rack.awayDefensiveShots || 0}</span></div>
      <div class="stat-row"><span class="stat-label">${esc(m.homePlayer.name)} Timeouts</span><span class="stat-value">${rack.homeTimeouts || 0}</span></div>
      <div class="stat-row"><span class="stat-label">${esc(m.awayPlayer.name)} Timeouts</span><span class="stat-value">${rack.awayTimeouts || 0}</span></div>
      </div>`;
    // Add edit button if rack is completed
    if (rack.winner) {
      html += `<div class="mt-16">
        <button class="btn btn-primary" onclick="closeModal();ui.editRack(${index})">✏️ Edit This Rack</button>
      </div>`;
    }
    showModal(html);
  },

  editRack(index) {
    const m = currentMatch;
    const rack = m.racks[index];
    if (!rack) return;
    if (!rack.winner) return; // Can only edit completed racks
    // Point currentRack at this rack so endRackForm edits it
    currentRack = rack;
    this._editingRack = true;
    this.endRackForm();
  },

  async undoLastRack() {
    if (currentMatch.racks.length === 0) { showToast('No racks to undo'); return; }
    const m = currentMatch;
    const rack = m.racks[m.racks.length - 1];

    // Mirror the official app's "Undo Rack" screen: list exactly what is lost.
    const lost = [];
    if (rack.endType) lost.push(`End type: <b>${RACK_END_LABELS[rack.endType] || rack.endType}</b>`);
    if (rack.winner) lost.push(`Winner: <b>${rack.winner === 'home' ? esc(m.homePlayer.name) : esc(m.awayPlayer.name)}</b>`);
    if (rack.sdPoints) lost.push(`Sudden Death value: <b>${rack.sdPoints} point${rack.sdPoints === 1 ? '' : 's'}</b>`);
    if (rack.innings) lost.push(`${rack.innings} inning${rack.innings === 1 ? '' : 's'}`);
    if (rack.homeDefensiveShots || rack.awayDefensiveShots) lost.push(`${(rack.homeDefensiveShots || 0) + (rack.awayDefensiveShots || 0)} defensive shot(s)`);
    if (rack.homeTimeouts || rack.awayTimeouts) lost.push(`${(rack.homeTimeouts || 0) + (rack.awayTimeouts || 0)} time-out(s)`);
    const balls = (rack.balls || []).length + (rack.eightBalls || []).length;
    if (balls) lost.push(`${balls} ball record(s)`);

    showModal(`<div class="modal-title">Undo Rack ${rack.rackNumber} <span class="modal-close" onclick="closeModal()">×</span></div>
      <p class="text-sm text-dim mb-16">This deletes the whole rack. Nothing else is touched.</p>
      ${lost.length ? `<div class="card" style="box-shadow:none;background:var(--surface2);">
        ${lost.map(l => `<div class="stat-row" style="border-bottom:none;"><span class="text-sm">${l}</span></div>`).join('')}
      </div>` : '<p class="text-sm text-dim">This rack has no recorded data yet.</p>'}
      <div class="mt-16">
        <button class="btn btn-danger" onclick="ui.confirmUndoRack()">Undo Rack ${rack.rackNumber}</button>
      </div>
      <div class="mt-8"><button class="btn btn-secondary" onclick="closeModal()">Keep Rack</button></div>
      <div style="height:16px;"></div>
    `);
  },

  async confirmUndoRack() {
    undoLastRack(currentMatch);
    await saveMatch(currentMatch);
    closeModal();
    this.renderMatch();
    showToast('Rack undone');
  },

  async forfeitMatch() {
    const m = currentMatch;
    showModal(`<div class="modal-title">Forfeit Match <span class="modal-close" onclick="closeModal()">×</span></div>
      <p class="text-dim text-sm mb-16">Select which player forfeits. APA scores an individual forfeit as <b>2 match points</b> in regular play (3 in playoffs); no fabricated game score is recorded.</p>
      <div class="btn-row mb-8">
        <button class="btn btn-danger" onclick="ui.confirmForfeit('home')">🏠 ${esc(m.homePlayer.name)} forfeits</button>
      </div>
      <div class="btn-row mb-8">
        <button class="btn btn-danger" onclick="ui.confirmForfeit('away')">👥 ${esc(m.awayPlayer.name)} forfeits</button>
      </div>
      <div class="btn-row">
        <button class="btn btn-danger" onclick="ui.confirmForfeit('double')">Double forfeit</button>
      </div>
      <div style="height:20px;"></div>
    `);
  },

  async confirmForfeit(side) {
    forfeitMatch(currentMatch, side);
    await saveMatch(currentMatch);
    closeModal();
    this.renderMatch();
    showToast('Match forfeited');
  },

  async startSuddenDeath() {
    const m = currentMatch;
    if (!m || m.suddenDeath) return;
    showModal(`<div class="modal-title">Start Sudden Death <span class="modal-close" onclick="closeModal()">×</span></div>
      <p class="text-sm text-dim mb-16">Use this when the match hits the time limit before anyone reaches their race.</p>
      <div class="card" style="box-shadow:none;background:var(--surface2);">
        ${m.format === '8-ball'
          ? `<div class="text-sm">The next rack is worth <b>2 points</b>; any rack after that is worth <b>1 point</b>. The first SD rack settles this individual match for tie-break credit.</div>`
          : `<div class="text-sm">Every ball pockets counts <b>double</b>, including the 9-ball. Players still race to their normal points-to-win.</div>`}
      </div>
      <div class="mt-16">
        <button class="btn btn-primary" onclick="ui.confirmSuddenDeath()">Start Sudden Death</button>
      </div>
      <div style="height:16px;"></div>
    `);
  },

  async confirmSuddenDeath() {
    enableSuddenDeath(currentMatch);
    await saveMatch(currentMatch);
    closeModal();
    this.renderMatch();
    showToast('Sudden Death enabled');
  },

  async deleteMatch() {
    if (!confirm('Delete this match permanently?')) return;
    await deleteMatch(currentMatch.id);
    currentMatch = null;
    this.switchView('home');
    showToast('Match deleted');
  },

  exportMatchSummary() {
    const summary = generateMatchSummary(currentMatch);
    const json = JSON.stringify(summary, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `match-${currentMatch.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Summary exported');
  },

  // ── Teams & Players ──
  async refreshTeamList() {
    teams = await getAllTeams();
    players = await getAllPlayers();
    const container = $('team-list');
    if (teams.length === 0 && players.filter(p => !p.teamId).length === 0) {
      container.innerHTML = '<div class="empty"><div class="icon">👥</div><p>No teams yet</p><p class="text-sm text-dim mt-8">Tap "+ New Team" to get started</p></div>';
      return;
    }
    let html = '';
    for (const team of teams) {
      const teamPlayers = players.filter(p => p.teamId === team.id);
      html += `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span class="font-bold">${esc(team.name)}</span>
            <span class="text-sm text-dim"> (${teamPlayers.length} players)</span>
          </div>
          <div>
            <button class="btn btn-secondary" style="width:auto;padding:6px 12px;font-size:0.8rem;" onclick="ui.showAddPlayer(${team.id})">+ Player</button>
            <button class="btn btn-danger" style="width:auto;padding:6px 12px;font-size:0.8rem;" onclick="ui.deleteTeam(${team.id})">Delete</button>
          </div>
        </div>`;
      if (teamPlayers.length > 0) {
        html += '<div class="mt-8">';
        for (const p of teamPlayers) {
          const isSenior8 = isSeniorSkillLevel(p.skillLevel, '8-ball');
          const isSenior9 = isSeniorSkillLevel(p.skillLevel, '9-ball');
          html += `<div class="stat-row" style="padding:6px 0;">
            <span>${esc(p.name)} — SL${p.skillLevel} ${isSenior8 ? '<span class="badge badge-senior">Senior 8B</span>' : ''} ${isSenior9 ? '<span class="badge badge-senior">Senior 9B</span>' : ''}</span>
            <button class="btn btn-danger" style="width:auto;padding:4px 10px;font-size:0.75rem;" onclick="ui.deletePlayer(${p.id})">Remove</button>
          </div>`;
        }
        html += '</div>';
      }
      html += '</div>';
    }
    // Players without a team
    const freeAgents = players.filter(p => !p.teamId || !teams.find(t => t.id === p.teamId));
    if (freeAgents.length > 0) {
      html += '<div class="section-title">Free Agents (No Team)</div>';
      for (const p of freeAgents) {
        html += `<div class="card" style="padding:8px 16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span>${esc(p.name)} — SL${p.skillLevel}</span>
            <button class="btn btn-danger" style="width:auto;padding:4px 10px;font-size:0.75rem;" onclick="ui.deletePlayer(${p.id})">Remove</button>
          </div>
        </div>`;
      }
    }
    container.innerHTML = html;
  },

  showNewTeam() {
    showModal(`<div class="modal-title">New Team <span class="modal-close" onclick="closeModal()">×</span></div>
      <div class="form-group">
        <label>Team Name</label>
        <input type="text" id="nt-name" placeholder="e.g. Pool Sharks" autocomplete="off">
      </div>
      <div class="mt-16">
        <button class="btn btn-primary" onclick="ui.createTeam()">Create Team</button>
      </div>
      <div style="height:20px;"></div>
    `);
    setTimeout(() => { const el = document.getElementById('nt-name'); if (el) el.focus(); }, 100);
  },

  async createTeam() {
    const name = document.getElementById('nt-name').value.trim();
    if (!name) { showToast('Team name is required'); return; }
    const team = { name, createdAt: Date.now() };
    await saveTeam(team);
    closeModal();
    this.refreshTeamList();
    showToast('Team created');
  },

  async deleteTeam(id) {
    if (!confirm('Delete this team and all its players?')) return;
    await deleteTeam(id);
    this.refreshTeamList();
    showToast('Team deleted');
  },

  showAddPlayer(teamId) {
    const team = teams.find(t => t.id === teamId);
    const teamName = team ? team.name : '';
    showModal(`<div class="modal-title">Add Player ${teamName ? 'to ' + esc(teamName) : ''} <span class="modal-close" onclick="closeModal()">×</span></div>
      <div class="form-group">
        <label>Player Name</label>
        <input type="text" id="np-name" placeholder="e.g. John Smith" autocomplete="off">
      </div>
      <div class="form-group">
        <label>8-Ball Skill Level</label>
        <select id="np-sl8">
          ${EIGHT_BALL_Skill_LEVELS.map(sl => `<option value="${sl}">SL ${sl}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>9-Ball Skill Level</label>
        <select id="np-sl9">
          ${NINE_BALL_Skill_LEVELS.map(sl => `<option value="${sl}">SL ${sl}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>APA Member Number (optional)</label>
        <input type="text" id="np-member" placeholder="e.g. 1234567" autocomplete="off">
      </div>
      <div class="mt-16">
        <button class="btn btn-primary" onclick="ui.createPlayer(${teamId})">Add Player</button>
      </div>
      <div style="height:20px;"></div>
    `);
    setTimeout(() => { const el = document.getElementById('np-name'); if (el) el.focus(); }, 100);
  },

  async createPlayer(teamId) {
    const name = document.getElementById('np-name').value.trim();
    if (!name) { showToast('Player name is required'); return; }
    const skillLevel8 = parseInt(document.getElementById('np-sl8').value) || 3;
    const skillLevel9 = parseInt(document.getElementById('np-sl9').value) || 3;
    const memberNumber = document.getElementById('np-member').value.trim();

    const player = {
      name,
      skillLevel: skillLevel8, // default to 8-ball SL; used in match creation
      skillLevel8,
      skillLevel9,
      memberNumber,
      teamId,
      createdAt: Date.now()
    };
    await savePlayer(player);
    closeModal();
    this.refreshTeamList();
    showToast('Player added');
  },

  async deletePlayer(id) {
    if (!confirm('Remove this player?')) return;
    await deletePlayer(id);
    this.refreshTeamList();
    showToast('Player removed');
  },

  // ── Race Chart ──
  renderRaceChart() {
    let html = `
      <div class="card">
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" style="flex:1;" id="rc-8ball" onclick="ui.showChart('8-ball')">8-Ball</button>
          <button class="btn btn-secondary" style="flex:1;" id="rc-9ball" onclick="ui.showChart('9-ball')">9-Ball</button>
        </div>
      </div>
      <div id="chart-content"></div>
    `;
    $('race-chart-content').innerHTML = html;
    this.showChart('8-ball');
  },

  showChart(format) {
    document.getElementById('rc-8ball').className = format === '8-ball' ? 'btn btn-primary' : 'btn btn-secondary';
    document.getElementById('rc-9ball').className = format === '9-ball' ? 'btn btn-primary' : 'btn btn-secondary';
    document.getElementById('rc-8ball').style.flex = '1';
    document.getElementById('rc-9ball').style.flex = '1';

    let html = '';
    if (format === '8-ball') {
      html = `<div class="card">
        <div class="section-title">8-Ball Games Must Win Chart</div>
        <p class="text-sm text-dim mb-8">Your skill level (left) vs opponent's (top). First number = your race-to, second = opponent's.</p>
        <div class="race-chart">
          <table>
            <tr><th>You \ Opp</th><th>SL2</th><th>SL3</th><th>SL4</th><th>SL5</th><th>SL6</th><th>SL7</th></tr>`;
      for (const sl of EIGHT_BALL_Skill_LEVELS) {
        html += `<tr><th>SL${sl}</th>`;
        for (const opp of EIGHT_BALL_Skill_LEVELS) {
          const race = get8BallRace(sl, opp);
          html += `<td>${race ? race.home + '/' + race.away : '—'}</td>`;
        }
        html += '</tr>';
      }
      html += `</table>
        </div>
        <p class="text-sm text-dim mt-8">SL6 and SL7 are Senior Skill Levels. Max 2 Senior players per match.</p>
      </div>`;
    } else {
      html = `<div class="card">
        <div class="section-title">9-Ball Points Required to Win</div>
        <p class="text-sm text-dim mb-8">Each skill level has a fixed points target. Balls 1-8 = 1 pt, 9-ball = 2 pts. Max 10 per rack.</p>
        <div class="race-chart">
          <table>
            <tr><th>Skill Level</th><th>Points to Win</th></tr>`;
      for (const sl of NINE_BALL_Skill_LEVELS) {
        const pts = NINE_BALL_POINTS_TO_WIN[sl];
        const isSenior = isSeniorSkillLevel(sl, '9-ball');
        html += `<tr><th>SL ${sl} ${isSenior ? '★' : ''}</th><td>${pts}</td></tr>`;
      }
      html += `</table>
        </div>
        <p class="text-sm text-dim mt-8">SL6-SL9 are Senior Skill Levels. Max 2 Senior players per match.</p>
      </div>`;
    }
    document.getElementById('chart-content').innerHTML = html;
  },

  // ── Display / device ──
  applyFontSize(size) {
    const map = { small: '14px', medium: '16px', large: '18px', xlarge: '20px' };
    document.documentElement.style.fontSize = map[size] || '16px';
    const sel = document.getElementById('setting-font-size');
    if (sel) sel.value = size;
  },

  async setFontSize(size) {
    this.applyFontSize(size);
    await setSetting('fontSize', size);
    showToast('Text size saved');
  },

  // Keep the screen awake while a match is being scored (the official app
  // holds a wake lock too - it declares android.permission.WAKE_LOCK).
  async keepAwake(on) {
    if (on) {
      if (!('wakeLock' in navigator) || this._wakeLock) return;
      try {
        this._wakeLock = await navigator.wakeLock.request('screen');
        this._wakeLock.addEventListener('release', () => { this._wakeLock = null; });
      } catch (e) { this._wakeLock = null; }
    } else if (this._wakeLock) {
      try { await this._wakeLock.release(); } catch (e) {}
      this._wakeLock = null;
    }
  },

  // ── Settings / Data ──
  async exportData() {
    const data = await exportAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `apa-scorekeeper-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported');
  },

  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!confirm('Importing will replace all existing data. Continue?')) return;
      await importAllData(data);
      showToast('Data imported successfully');
      this.refreshMatchList();
      this.refreshTeamList();
    } catch (e) {
      showToast('Import failed: ' + e.message);
    }
  },
};

// ─────────────────────────────────────────────────────────────────────
// Service Worker Registration
// ─────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW registration failed:', err));
}

// ─────────────────────────────────────────────────────────────────────
// Initialize
// ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    await openDB();
  } catch (e) {
    console.error('Failed to open database:', e);
    showToast('Storage initialization failed');
  }
  try {
    const size = await getSetting('fontSize', 'medium');
    ui.applyFontSize(size);
  } catch (e) { /* settings store may be unavailable on first run */ }
  ui.refreshMatchList();
}

// Re-arm the wake lock when the tab comes back to the foreground.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentMatch && currentMatch.status === 'in_progress') {
    ui.keepAwake(true);
  }
});

document.addEventListener('DOMContentLoaded', init);

// Close modal when clicking overlay
document.addEventListener('click', (e) => {
  if (e.target === $('modal-overlay')) closeModal();
});

// Prevent scrolling issues on mobile
document.addEventListener('touchmove', (e) => {
  if ($('modal-overlay').classList.contains('active') && e.target === $('modal-overlay')) {
    e.preventDefault();
  }
}, { passive: false });
