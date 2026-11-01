/**
 * APA Scorekeeper - Main App Logic
 * Handles UI rendering, navigation, and user interactions.
 */

// ─────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────
const APP_VERSION = '1.9';
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

/** Skill-level <option> list for the typed-name pickers (APA: new players are SL3). */
function slOptions(format, selected) {
  const levels = format === '9-ball' ? NINE_BALL_Skill_LEVELS : EIGHT_BALL_Skill_LEVELS;
  const def = selected || 3;
  return levels.map(n => `<option value="${n}"${n === def ? ' selected' : ''}>SL${n}</option>`).join('');
}

/** Copy text to the clipboard, with a fallback for browsers without the async API. */
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

/** Open the user's mail app with the summary prefilled. Long bodies are copied instead. */
async function emailText(subject, body) {
  const url = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  if (url.length > 1800) {
    const ok = await copyText(body);
    showToast(ok ? 'Summary copied — paste it into your email' : 'Summary is too long for a mail link');
    return;
  }
  window.location.href = url;
}

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

    const titles = { home: 'APA Scorekeeper', teams: 'Teams & Players', match: 'Match', settings: 'Settings', 'race-chart': 'Race Charts', report: 'Match Summary' };
    $('page-title').textContent = titles[view] || 'APA Scorekeeper';

    // Refresh data when switching views
    if (view === 'home') this.refreshMatchList();
    if (view === 'teams') this.refreshTeamList();
    if (view === 'race-chart') this.renderRaceChart();
    if (view === 'report') this.renderReport();
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
            <div class="text-lg font-bold">${m.forfeit ? 'Forfeit' : `${score.home} - ${score.away}`}</div>
            <div class="text-sm text-dim">${m.forfeit ? '' : `to ${score.homeTarget} / ${score.awayTarget}`}</div>
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

    // No roster is fine: the form accepts typed names for a one-off match.

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
        <label>Home team (optional)</label>
        <input type="text" id="nm-home-team" placeholder="e.g. Sharks" autocomplete="off">
      </div>
      <div class="form-group">
        <label>Away team (optional)</label>
        <input type="text" id="nm-away-team" placeholder="e.g. Eagles" autocomplete="off">
      </div>
      <div class="form-group">
        <label>Home player</label>
        <select id="nm-home">${playerOpts}</select>
      </div>
      <div class="form-group">
        <label>…or type the home name</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="nm-home-name" placeholder="Name" autocomplete="off" style="flex:2;">
          <select id="nm-home-sl" style="flex:1;">${slOptions('8-ball')}</select>
        </div>
      </div>
      <div class="form-group">
        <label>Away player</label>
        <select id="nm-away">${playerOpts}</select>
      </div>
      <div class="form-group">
        <label>…or type the away name</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="nm-away-name" placeholder="Name" autocomplete="off" style="flex:2;">
          <select id="nm-away-sl" style="flex:1;">${slOptions('8-ball')}</select>
        </div>
      </div>
      <div id="nm-race-preview" class="text-center text-dim text-sm mt-8"></div>
      <div class="mt-16">
        <button class="btn btn-primary" onclick="ui.createMatchFromForm()">Start Match</button>
      </div>
      <div style="height:20px;"></div>
    `);

    // Update race preview when anything that affects the race changes
    ['nm-home', 'nm-away', 'nm-home-name', 'nm-away-name', 'nm-home-sl', 'nm-away-sl']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => this.updateMatchForm());
      });
    this.updateMatchForm();
  },

  /** Resolve one side of the New Match form: typed name wins over a roster pick. */
  resolveSide(prefix, format) {
    const typedEl = document.getElementById(prefix + '-name');
    const typed = typedEl ? typedEl.value.trim() : '';
    const slEl = document.getElementById(prefix + '-sl');
    const typedSL = slEl ? parseInt(slEl.value) : 3;

    if (typed) return { id: null, name: typed, skillLevel: typedSL, typed: true, teamId: null };

    const sel = document.getElementById(prefix);
    const id = sel ? parseInt(sel.value) : NaN;
    const p = players.find(x => x.id === id);
    if (!p) return null;
    const sl = format === '9-ball'
      ? (p.skillLevel9 || p.skillLevel || 3)
      : (p.skillLevel8 || p.skillLevel || 3);
    return { id: p.id, name: p.name, skillLevel: sl, typed: false, teamId: p.teamId };
  },

  updateMatchForm() {
    const format = document.getElementById('nm-format').value;
    const preview = document.getElementById('nm-race-preview');
    if (!preview) return;

    // 8-ball offers SL2-SL7, 9-ball SL1-SL9 - rebuild the pickers when the format changes.
    if (this._lastFormat !== format) {
      this._lastFormat = format;
      ['nm-home-sl', 'nm-away-sl'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = slOptions(format, parseInt(el.value) || 3);
      });
    }
    const home = this.resolveSide('nm-home', format);
    const away = this.resolveSide('nm-away', format);
    if (!home || !away) { preview.textContent = 'Pick a player or type both names'; return; }
    if (!home.typed && !away.typed && home.id && home.id === away.id) {
      preview.textContent = '⚠️ Pick two different players';
      return;
    }
    let txt = '';
    if (format === '8-ball') {
      const race = get8BallRace(home.skillLevel, away.skillLevel);
      if (race) txt = `${home.name} races to ${race.home} — ${away.name} races to ${race.away}`;
    } else {
      const hp = get9BallPoints(home.skillLevel);
      const ap = get9BallPoints(away.skillLevel);
      txt = `${home.name} needs ${hp} pts — ${away.name} needs ${ap} pts`;
    }
    preview.textContent = txt;
  },

  async createMatchFromForm() {
    const format = document.getElementById('nm-format').value;
    const tableSize = document.getElementById('nm-table').value;
    const home = this.resolveSide('nm-home', format);
    const away = this.resolveSide('nm-away', format);

    if (!home || !away) { showToast('Pick a player or type both names'); return; }
    if (!home.typed && !away.typed && home.id && home.id === away.id) {
      showToast('Home and away must be different players');
      return;
    }

    // Team names: typed value first, then the roster team of a picked player.
    const typedHomeTeam = (document.getElementById('nm-home-team').value || '').trim();
    const typedAwayTeam = (document.getElementById('nm-away-team').value || '').trim();
    const homeTeam = home.teamId ? teams.find(t => t.id === home.teamId) : null;
    const awayTeam = away.teamId ? teams.find(t => t.id === away.teamId) : null;

    const match = createMatch(format,
      typedHomeTeam || (homeTeam ? homeTeam.name : 'Home'),
      typedAwayTeam || (awayTeam ? awayTeam.name : 'Away'),
      { id: home.id, name: home.name, skillLevel: home.skillLevel },
      { id: away.id, name: away.name, skillLevel: away.skillLevel }
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
    let score = getRunningScore(m);
    // 9-ball is scored live: show the points earned so far in the rack too,
    // capped at the target (excess points are never counted).
    if (m.format === '9-ball' && m.status === 'in_progress') {
      const live = liveNineBallTotals(m);
      score = {
        ...score,
        home: Math.min(live.home, m.homeRaceTo),
        away: Math.min(live.away, m.awayRaceTo)
      };
    }
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
            <div class="score-value" id="score-home">${score.home}<span class="target"> / ${score.homeTarget}</span></div>
          </div>
          <div class="score-divider"></div>
          <div class="score-side">
            <div class="score-name">${esc(m.awayPlayer.name)} (SL${m.awayPlayer.skillLevel})</div>
            <div class="score-value" id="score-away">${score.away}<span class="target"> / ${score.awayTarget}</span></div>
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

          <div class="section-title">At the table</div>
          <div class="scorer-toggle">
            <button class="btn turn-btn ${currentShooter(rack) === 'home' ? 'active' : 'btn-secondary'}" data-side="home" onclick="ui.setTurn('home')">🏠 ${esc(m.homePlayer.name)}</button>
            <button class="btn turn-btn ${currentShooter(rack) === 'away' ? 'active' : 'btn-secondary'}" data-side="away" onclick="ui.setTurn('away')">👥 ${esc(m.awayPlayer.name)}</button>
          </div>
          <div class="text-center text-sm text-dim" id="turn-note">${rack.breaker === 'away' ? esc(m.awayPlayer.name) : esc(m.homePlayer.name)} breaks · ${rack.innings || 0} inning${(rack.innings || 0) === 1 ? '' : 's'}</div>

          <div class="section-title" style="margin-top:14px;">Innings This Rack</div>
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

        // 9-ball: balls are credited to whoever is at the table. No second
        // "who made it" toggle - tap the ball, that's it.
        if (m.format === '9-ball') {
          if (!rack._balls) rack._balls = rack.balls || [];
          html += `
          <div class="live-scorer">
            <div class="section-title">9-Ball — tap each ball made</div>
            <div class="text-sm text-dim mb-8">Balls go to <b id="ball-owner">${esc(currentShooter(rack) === 'home' ? m.homePlayer.name : m.awayPlayer.name)}</b>.</div>
            <div class="scorer-toggle">
              <button class="btn dead-btn ${rack._deadMode ? 'active' : 'btn-secondary'}" onclick="ui.toggleDeadMode()">💀 Dead ball</button>
            </div>
            <div class="ball-section">
              <div class="ball-section-title">On the table</div>
              <div class="ball-row" id="live-ball-rack"></div>
            </div>
            <div class="ball-section home">
              <div class="ball-section-title" id="live-title-home">${esc(m.homePlayer.name)} — 0 pts</div>
              <div class="ball-row" id="live-balls-home"></div>
            </div>
            <div class="ball-section away">
              <div class="ball-section-title" id="live-title-away">${esc(m.awayPlayer.name)} — 0 pts</div>
              <div class="ball-row" id="live-balls-away"></div>
            </div>
            <div class="ball-section dead">
              <div class="ball-section-title" id="live-title-dead">Dead balls — 0</div>
              <div class="ball-row" id="live-balls-dead"></div>
            </div>
          </div>
          `;
        }

        // 8-ball: no ball-by-ball entry. The official app only asks who won
        // the rack and how it ended; individual balls are not recorded.
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
          // Add edit button for any rack that has ended (winner or stalemate)
          if (r.winner || r.endType) {
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
          <button class="btn btn-primary" onclick="ui.showMatchText()">📋 Match Summary</button>
          <div class="btn-row mt-8">
            <button class="btn btn-secondary" onclick="ui.exportMatchSummary()">JSON</button>
            <button class="btn btn-danger" onclick="ui.deleteMatch()">Delete Match</button>
          </div>
        </div>
      `;
    }

    $('match-content').innerHTML = html;

    // Render live ball grids after DOM is ready
    if (m.status === 'in_progress' && currentRack && !currentRack.winner) {
      if (m.format === '9-ball' && currentRack._balls !== undefined) this.renderLiveBallGrid();
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
  /** Tap the player who is now at the table. An inning is counted when the
   *  player who did not break finishes their turn - same as the scoresheet. */
  async setTurn(side) {
    const m = currentMatch;
    const rack = currentRack;
    if (!m || !rack || rack.winner) return;
    const counted = setTurn(m, rack, side);
    await saveMatch(m);

    document.querySelectorAll('.turn-btn').forEach(b => {
      const active = b.dataset.side === side;
      b.classList.toggle('active', active);
      b.classList.toggle('btn-secondary', !active);
    });
    const inn = document.getElementById('live-innings');
    if (inn) inn.textContent = rack.innings || 0;
    const owner = document.getElementById('ball-owner');
    if (owner) owner.textContent = side === 'home' ? m.homePlayer.name : m.awayPlayer.name;
    this.updateTurnNote(counted);
  },

  updateTurnNote(counted) {
    const m = currentMatch;
    const rack = currentRack;
    const note = document.getElementById('turn-note');
    if (!m || !rack || !note) return;
    const breakerName = rack.breaker === 'away' ? m.awayPlayer.name : m.homePlayer.name;
    const inn = rack.innings || 0;
    note.textContent = `${breakerName} breaks · ${inn} inning${inn === 1 ? '' : 's'}${counted ? ' (+1)' : ''}`;
  },

  async adjustInnings(delta) {
    const rack = currentRack;
    if (!rack || rack.winner) return;
    const newVal = Math.max(0, (rack.innings || 0) + delta);
    rack.innings = newVal;
    const el = document.getElementById('live-innings');
    if (el) el.textContent = newVal;
    this.updateTurnNote(false);
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

  toggleDeadMode() {
    const rack = currentRack;
    if (!rack || rack.winner) return;
    rack._deadMode = !rack._deadMode;
    this.renderMatch();
    if (rack._deadMode) showToast('Dead ball mode — tap the ball that was not credited');
  },

  async pickBall(num) {
    const rack = currentRack;
    if (!rack || rack.winner) return;
    const dead = !!rack._deadMode;
    // APA: "The 9-ball is never a dead ball. It is spotted."
    if (num === 9 && dead) {
      showToast('The 9-ball is never dead — it gets spotted');
      return;
    }
    // The ball belongs to whoever is at the table. No second toggle.
    const side = dead ? 'dead' : currentShooter(rack);

    if (!rack._balls) rack._balls = [];
    if (rack._balls.some(b => b.number === num)) return; // already placed
    const existing = rack._balls.find(b => b.number === num);
    // Tapping the same ball for the same player again removes it.
    let next = side;
    if (existing && !dead && existing.pocketedBy === side && !existing.dead) next = null;
    rack._balls = rack._balls.filter(b => b.number !== num);
    if (next) rack._balls.push({ number: num, pocketedBy: dead ? null : side, dead });
    if (dead) {
      rack._deadMode = false; // one-shot mode
      const btn = document.querySelector('.dead-btn');
      if (btn) { btn.classList.remove('active'); btn.classList.add('btn-secondary'); }
    }
    // Keep the saved rack in step with the live grid so running totals and the
    // "match over at target" check see the balls already pocketed.
    rack.balls = rack._balls.map(b => ({ number: b.number, pocketedBy: b.dead ? null : (b.pocketedBy || null), dead: !!b.dead }));
    this.renderLiveBallGrid();
    this.updateLiveScoreboard();
    await saveMatch(currentMatch);
    await this.checkNineBallProgress();
  },

  /** Keep the big score in step with the balls already pocketed this rack. */
  updateLiveScoreboard() {
    const m = currentMatch;
    if (!m || m.format !== '9-ball' || m.status !== 'in_progress') return;
    const live = liveNineBallTotals(m);
    const home = Math.min(live.home, m.homeRaceTo);
    const away = Math.min(live.away, m.awayRaceTo);
    const h = document.getElementById('score-home');
    const a = document.getElementById('score-away');
    if (h) h.innerHTML = `${home}<span class="target"> / ${m.homeRaceTo}</span>`;
    if (a) a.innerHTML = `${away}<span class="target"> / ${m.awayRaceTo}</span>`;
  },

  /** 9-ball: pocketing the 9 ends the rack; reaching the points target ends
   *  the match on the spot (excess points are not counted). */
  async checkNineBallProgress() {
    const m = currentMatch;
    const rack = currentRack;
    if (!m || m.format !== '9-ball' || !rack || rack.winner) return;

    const nine = (rack._balls || []).find(b => b.number === 9 && !b.dead && b.pocketedBy);
    const totals = liveNineBallTotals(m);

    let winner = null;
    let endType = 'STANDARD';
    if (nine) {
      winner = nine.pocketedBy;
    } else if (totals.home >= m.homeRaceTo) {
      winner = 'home'; endType = 'END_RACK_EARLY';
    } else if (totals.away >= m.awayRaceTo) {
      winner = 'away'; endType = 'END_RACK_EARLY';
    }
    if (!winner) return;

    rack.balls = (rack._balls || []).map(b => ({
      number: b.number,
      pocketedBy: b.dead ? null : (b.pocketedBy || null),
      dead: b.dead || false
    }));
    endRack(m, rack, endType, winner);
    delete rack._balls;
    delete rack._scorerSide;
    await saveMatch(m);
    this.renderMatch();

    const name = winner === 'home' ? m.homePlayer.name : m.awayPlayer.name;
    if (m.status === 'completed') showToast(`${name} wins the match!`);
    else showToast(`${nine ? '9-ball made' : 'Points target reached'} — ${name} wins rack ${rack.rackNumber}`);
  },

  /** A pool ball that looks like one: solid 1-8, striped 9, white number. */
  ballHtml(n, onclick) {
    const colors = {
      1: '#f2c200', 2: '#1f5fd0', 3: '#d62828', 4: '#6a2c91', 5: '#ef7d00',
      6: '#0f7b3a', 7: '#7b1f1f', 8: '#141414', 9: '#f2c200'
    };
    const stripe = n === 9;
    return `<button class="ball-real${stripe ? ' stripe' : ''}" style="--ball-color:${colors[n]}" onclick="${onclick}" aria-label="Ball ${n}"><span class="num">${n}</span></button>`;
  },

  renderLiveBallGrid() {
    const m = currentMatch;
    const rack = currentRack;
    if (!m || !rack || !rack._balls) return;
    const rackEl = document.getElementById('live-ball-rack');
    if (!rackEl) return;

    const balls = rack._balls;
    const bySide = side => balls.filter(b => side === 'dead' ? b.dead : (!b.dead && b.pocketedBy === side));
    const points = list => list.reduce((sum, b) => sum + (b.number === 9 ? 2 : 1), 0);

    // Balls still on the table.
    const inPlay = new Set(balls.map(b => b.number));
    const remaining = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => !inPlay.has(n));
    rackEl.innerHTML = remaining.length
      ? remaining.map(n => this.ballHtml(n, `ui.pickBall(${n})`)).join('')
      : '<span class="text-dim text-sm">All balls are placed</span>';

    const home = bySide('home');
    const away = bySide('away');
    const dead = bySide('dead');
    const fill = (id, list) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = list.length
        ? list.map(b => this.ballHtml(b.number, `ui.returnBall(${b.number})`)).join('')
        : '<span class="text-dim text-sm">—</span>';
    };
    fill('live-balls-home', home);
    fill('live-balls-away', away);
    fill('live-balls-dead', dead);

    const pts = n => `${n} pt${n === 1 ? '' : 's'}`;
    const titles = {
      'live-title-home': `${m.homePlayer.name} — ${pts(points(home))}`,
      'live-title-away': `${m.awayPlayer.name} — ${pts(points(away))}`,
      'live-title-dead': `Dead ball${dead.length === 1 ? '' : 's'} — ${dead.length}`
    };
    Object.keys(titles).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = titles[id];
    });
  },

  /** Tap a ball in a player's section (or the dead section) to put it back. */
  async returnBall(num) {
    const rack = currentRack;
    if (!rack || rack.winner) return;
    rack._balls = (rack._balls || []).filter(b => b.number !== num);
    rack.balls = rack._balls.map(b => ({ number: b.number, pocketedBy: b.dead ? null : (b.pocketedBy || null), dead: !!b.dead }));
    this.renderLiveBallGrid();
    this.updateLiveScoreboard();
    await saveMatch(currentMatch);
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
    const breakerName = rack.breaker === 'away' ? currentMatch.awayPlayer.name : currentMatch.homePlayer.name;
    showToast(`Rack ${rack.rackNumber} — ${breakerName} breaks`);
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

      // Only remember the old values. Nothing is mutated until the user saves,
      // so cancelling an edit leaves the match exactly as it was.
      rack._wasWinner = rack.winner;
      rack._prevEndType = rack.endType;
    }

    // Two steps, same order as the official app: who won, then how it ended.
    this._endRackEditing = isEdit;
    rack._tempWinner = isEdit ? (rack._wasWinner || null) : undefined;
    rack._tempEndType = isEdit ? rack._prevEndType : undefined;
    if (m.format === '8-ball') {
      // The official app asks who made the 8-ball and derives the winner.
      let maker = null;
      if (isEdit) {
        if (rack.endType === 'SCRATCH_ON_EIGHT' || rack.endType === 'WRONG_POCKET') {
          maker = rack.winner === 'home' ? 'away' : 'home';
        } else if (rack.winner) {
          maker = rack.winner;
        }
      }
      rack._maker = maker;
      if (isEdit) this.showEndTypeStep();
      else this.showMakerStep();
      return;
    }
    if (isEdit) this.showEndTypeStep();
    else this.showWinnerStep();
  },

  /** 8-ball step 1 — who made the 8-ball. The winner follows from this. */
  showMakerStep() {
    const m = currentMatch;
    const rack = currentRack;
    const isEdit = this._endRackEditing;

    let html = `<div class="modal-title">${isEdit ? 'Edit' : 'End'} Rack ${rack.rackNumber} <span class="modal-close" onclick="closeModal()">×</span></div>`;
    html += `<p class="text-sm text-dim mb-8">Who made the 8-ball?</p>`;
    if (m.suddenDeath) {
      html += `<div class="card" style="box-shadow:none;background:var(--surface2);margin-bottom:12px;">
        <div class="text-sm" style="color:var(--yellow);">⚡ Sudden Death — this rack is worth <b>${nextSuddenDeathRackValue(m)} point${nextSuddenDeathRackValue(m) === 1 ? '' : 's'}</b></div>
      </div>`;
    }
    html += `<button class="btn btn-primary" style="margin-bottom:8px;" onclick="ui.pickRackMaker('home')">🏠 ${esc(m.homePlayer.name)}</button>
      <button class="btn btn-primary" style="margin-bottom:8px;" onclick="ui.pickRackMaker('away')">👥 ${esc(m.awayPlayer.name)}</button>
      <button class="btn btn-secondary" onclick="ui.pickRackMaker('null')">No 8-ball made / rack abandoned</button>
      <div style="height:20px;"></div>`;
    showModal(html);
  },

  pickRackMaker(side) {
    if (!currentRack) return;
    currentRack._maker = side === 'null' ? null : side;
    currentRack._tempEndType = undefined;
    this.showEndTypeStep();
  },

  /** 8-ball endings, seen from whoever dropped the 8. */
  endTypeOptions8(maker) {
    const m = currentMatch;
    const home = m.homePlayer.name;
    const away = m.awayPlayer.name;
    if (!maker) {
      return [
        { type: 'STALEMATE', label: '🤝 Stalemate', sub: 'no winner — rack replayed', winner: null },
        { type: 'END_RACK_EARLY', label: '⏹ Rack ended early', sub: 'no winner — scores stay', winner: null }
      ];
    }
    const name = maker === 'home' ? home : away;
    const other = maker === 'home' ? away : home;
    const otherSide = maker === 'home' ? 'away' : 'home';
    return [
      { type: 'STANDARD', label: `🎯 ${name} made the 8-ball`, sub: `${name} wins the rack`, winner: maker },
      { type: 'EIGHT_BREAK_AND_RUN', label: '🏃 Break & Run', sub: `${name} ran the rack`, winner: maker },
      { type: 'EIGHT_ON_BREAK', label: '💥 8 on the break', sub: `${name} wins`, winner: maker },
      { type: 'SCRATCH_ON_EIGHT', label: `🔲 ${name} scratched on the 8`, sub: `${other} wins`, winner: otherSide },
      { type: 'WRONG_POCKET', label: `❌ ${name} put the 8 in the wrong pocket`, sub: `${other} wins`, winner: otherSide }
    ];
  },

  /** Step 1 — who won the rack. */
  showWinnerStep() {
    const m = currentMatch;
    const rack = currentRack;
    const isEdit = this._endRackEditing;

    let html = `<div class="modal-title">${isEdit ? 'Edit' : 'End'} Rack ${rack.rackNumber} <span class="modal-close" onclick="closeModal()">×</span></div>`;
    html += `<p class="text-sm text-dim mb-8">Who won the rack?</p>`;
    if (m.suddenDeath) {
      html += `<div class="card" style="box-shadow:none;background:var(--surface2);margin-bottom:12px;">
        <div class="text-sm" style="color:var(--yellow);">⚡ Sudden Death — ${m.format === '8-ball'
          ? `this rack is worth <b>${nextSuddenDeathRackValue(m)} point${nextSuddenDeathRackValue(m) === 1 ? '' : 's'}</b>`
          : 'every ball counts <b>double</b>'}</div>
      </div>`;
    }
    html += `<button class="btn btn-primary" style="margin-bottom:8px;" onclick="ui.pickRackWinner('home')">🏠 ${esc(m.homePlayer.name)}</button>
      <button class="btn btn-primary" style="margin-bottom:8px;" onclick="ui.pickRackWinner('away')">👥 ${esc(m.awayPlayer.name)}</button>
      <button class="btn btn-secondary" onclick="ui.pickRackWinner('null')">No winner / rack abandoned</button>
      <div style="height:20px;"></div>`;
    showModal(html);
  },

  pickRackWinner(side) {
    if (!currentRack) return;
    currentRack._tempWinner = side === 'null' ? null : side;
    currentRack._tempEndType = undefined;
    this.showEndTypeStep();
  },

  /** Step 2 — how the rack ended, filtered by who won. */
  endTypeOptions(winner) {
    const m = currentMatch;
    const home = m.homePlayer.name;
    const away = m.awayPlayer.name;
    const winnerName = winner === 'home' ? home : away;
    const loserName = winner === 'home' ? away : home;

    if (winner === 'home' || winner === 'away') {
      if (m.format === '8-ball') {
        return [
          { type: 'STANDARD', label: `🎯 ${winnerName} made the 8-ball`, sub: 'standard win' },
          { type: 'EIGHT_BREAK_AND_RUN', label: '🏃 Break & Run', sub: `${winnerName} ran the rack` },
          { type: 'EIGHT_ON_BREAK', label: '💥 8 on the break', sub: `${winnerName} made it on the break` },
          { type: 'EIGHT_EARLY', label: `⏰ ${loserName} made the 8 early`, sub: `${winnerName} wins` },
          { type: 'SCRATCH_ON_EIGHT', label: `🔲 ${loserName} scratched on the 8`, sub: `${winnerName} wins` },
          { type: 'WRONG_POCKET', label: `❌ ${loserName} put the 8 in the wrong pocket`, sub: `${winnerName} wins` }
        ];
      }
      return [
        { type: 'STANDARD', label: `🎯 ${winnerName} made the 9`, sub: 'standard win' },
        { type: 'NINE_ON_SNAP', label: '💥 9 on the snap', sub: 'made on the break' },
        { type: 'NINE_BREAK_AND_RUN', label: '🏃 Break & Run', sub: `${winnerName} ran out` }
      ];
    }
    return [
      { type: 'STALEMATE', label: '🤝 Stalemate', sub: 'rack replayed, balls are dead' },
      { type: 'END_RACK_EARLY', label: '⏹ End rack early', sub: 'scores stay as they are' }
    ];
  },

  showEndTypeStep() {
    const m = currentMatch;
    const rack = currentRack;
    const winner = rack._tempWinner;
    const makerMode = m.format === '8-ball' && Object.prototype.hasOwnProperty.call(rack, '_maker');
    const opts = makerMode ? this.endTypeOptions8(rack._maker) : this.endTypeOptions(winner);
    const who = makerMode
      ? (rack._maker ? `${rack._maker === 'home' ? m.homePlayer.name : m.awayPlayer.name} made the 8` : 'No 8-ball made')
      : (winner === null ? 'No winner' : `${winner === 'home' ? m.homePlayer.name : m.awayPlayer.name} won`);

    let html = `<div class="modal-title">How did rack ${rack.rackNumber} end?</div>
      <p class="text-sm text-dim mb-8">${esc(who)}</p>
      <div class="endtype-grid">` +
      opts.map(o => `<button class="endtype-btn${rack._tempEndType === o.type ? ' selected' : ''}" onclick="ui.selectEndType('${o.type}', this)">${esc(o.label)}<br><small style="font-weight:400;">${esc(o.sub)}</small></button>`).join('') +
      `</div>
      <div class="mt-16"><button class="btn btn-primary" onclick="ui.submitEndRack('${m.format}')">${this._endRackEditing ? 'Save Changes' : 'Save Rack'}</button></div>
      <div class="mt-8"><button class="btn btn-secondary" onclick="${m.format === '8-ball' ? "ui.showMakerStep()" : "ui.showWinnerStep()"}">← Change ${m.format === '8-ball' ? 'maker' : 'winner'}</button></div>
      <div style="height:16px;"></div>`;
    showModal(html);
  },

  selectEndType(endType, el) {
    if (!currentRack) return;
    currentRack._tempEndType = endType;
    document.querySelectorAll('.endtype-btn').forEach(b => b.classList.remove('selected'));
    if (el) el.classList.add('selected');
  },

  async submitEndRack(format) {
    const m = currentMatch;
    const rack = (currentRack && m.racks.includes(currentRack)) ? currentRack : m.racks[m.racks.length - 1];

    if (!rack._tempEndType) {
      showToast('Please select how the rack ended');
      return;
    }
    const endType = rack._tempEndType;
    // 8-ball: the maker plus the ending decide the winner. 9-ball: the winner
    // was picked explicitly and the ending labels it.
    let winner = rack._tempWinner !== undefined ? rack._tempWinner : null;
    if (format === '8-ball' && Object.prototype.hasOwnProperty.call(rack, '_maker')) {
      const opt = this.endTypeOptions8(rack._maker).find(o => o.type === endType);
      winner = opt ? opt.winner : null;
    }

    rack.innings = rack.innings || 0;
    rack.homeDefensiveShots = rack.homeDefensiveShots || 0;
    rack.awayDefensiveShots = rack.awayDefensiveShots || 0;
    rack.homeTimeouts = rack.homeTimeouts || 0;
    rack.awayTimeouts = rack.awayTimeouts || 0;

    if (format === '9-ball') {
      rack.balls = (rack._balls || []).map(b => ({
        number: b.number,
        pocketedBy: b.dead ? null : (b.pocketedBy || null),
        dead: b.dead || false
      }));
    } else {
      // 8-ball has no ball-level data in APA scoresheets.
      rack.balls = [];
      rack.eightBalls = [];
    }

    endRack(m, rack, endType, winner);

    delete rack._tempWinner;
    delete rack._tempEndType;
    delete rack._maker;
    delete rack._balls;
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
        ${m.format === '8-ball' && rack.endType ? (() => {
          const maker = (rack.endType === 'SCRATCH_ON_EIGHT' || rack.endType === 'WRONG_POCKET')
            ? (rack.winner === 'home' ? 'away' : 'home')
            : rack.winner;
          const who = maker ? (maker === 'home' ? m.homePlayer.name : m.awayPlayer.name) : 'Nobody';
          return `<div class="stat-row"><span class="stat-label">8-Ball Made By</span><span class="stat-value">${esc(who)}</span></div>`;
        })() : ''}
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
    html += `<div class="stat-row"><span class="stat-label">${esc(m.homePlayer.name)} Defensive Shots</span><span class="stat-value">${rack.homeDefensiveShots || 0}</span></div>
      <div class="stat-row"><span class="stat-label">${esc(m.awayPlayer.name)} Defensive Shots</span><span class="stat-value">${rack.awayDefensiveShots || 0}</span></div>
      <div class="stat-row"><span class="stat-label">${esc(m.homePlayer.name)} Timeouts</span><span class="stat-value">${rack.homeTimeouts || 0}</span></div>
      <div class="stat-row"><span class="stat-label">${esc(m.awayPlayer.name)} Timeouts</span><span class="stat-value">${rack.awayTimeouts || 0}</span></div>
      </div>`;
    // Add edit button if the rack has ended
    if (rack.winner || rack.endType) {
      html += `<div class="mt-16">
        <button class="btn btn-primary" onclick="closeModal();ui.editRack(${index})">✏️ Edit This Rack</button>
      </div>`;
    }
    showModal(html);
  },

  /** Full rack editor: balls, stats, winner and ending in one sheet.
   *  Works on a draft, so Cancel leaves the rack untouched. */
  editRack(index) {
    const m = currentMatch;
    const rack = m.racks[index];
    if (!rack) return;
    currentRack = rack;
    this._editIndex = index;
    this._editDraft = {
      balls: (rack.balls || []).map(b => ({ number: b.number, pocketedBy: b.pocketedBy, dead: !!b.dead })),
      innings: rack.innings || 0,
      homeDefensiveShots: rack.homeDefensiveShots || 0,
      awayDefensiveShots: rack.awayDefensiveShots || 0,
      homeTimeouts: rack.homeTimeouts || 0,
      awayTimeouts: rack.awayTimeouts || 0,
      winner: rack.winner || null,
      endType: rack.endType || null,
      target: 'home',
      maker: m.format === '8-ball'
        ? ((rack.endType === 'SCRATCH_ON_EIGHT' || rack.endType === 'WRONG_POCKET')
            ? (rack.winner === 'home' ? 'away' : 'home')
            : (rack.winner || null))
        : undefined
    };
    this.renderRackEditor();
  },

  renderRackEditor() {
    const m = currentMatch;
    const d = this._editDraft;
    const rack = m.racks[this._editIndex];
    if (!d) return;

    const ballSections = m.format === '9-ball' ? (() => {
      const bySide = side => d.balls.filter(b => side === 'dead' ? b.dead : (!b.dead && b.pocketedBy === side));
      const inPlay = new Set(d.balls.map(b => b.number));
      const remaining = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => !inPlay.has(n));
      const row = (list, cb) => list.length
        ? list.map(b => this.ballHtml(b.number, `ui.editReturn(${b.number})`)).join('')
        : '<span class="text-dim text-sm">—</span>';
      return `
        <div class="section-title" style="margin-top:0;">Add a ball to</div>
        <div class="scorer-toggle">
          <button class="btn ${d.target === 'home' ? 'active' : 'btn-secondary'}" onclick="ui.editSetTarget('home')">🏠 ${esc(m.homePlayer.name)}</button>
          <button class="btn ${d.target === 'away' ? 'active' : 'btn-secondary'}" onclick="ui.editSetTarget('away')">👥 ${esc(m.awayPlayer.name)}</button>
          <button class="btn ${d.target === 'dead' ? 'active' : 'btn-secondary'}" onclick="ui.editSetTarget('dead')">💀 Dead</button>
        </div>
        <div class="ball-section">
          <div class="ball-section-title">On the table</div>
          <div class="ball-row">${remaining.length ? remaining.map(n => this.ballHtml(n, `ui.editPick(${n})`)).join('') : '<span class="text-dim text-sm">All balls placed</span>'}</div>
        </div>
        <div class="ball-section home">
          <div class="ball-section-title">${esc(m.homePlayer.name)}</div>
          <div class="ball-row">${row(bySide('home'))}</div>
        </div>
        <div class="ball-section away">
          <div class="ball-section-title">${esc(m.awayPlayer.name)}</div>
          <div class="ball-row">${row(bySide('away'))}</div>
        </div>
        <div class="ball-section dead">
          <div class="ball-section-title">Dead balls</div>
          <div class="ball-row">${row(bySide('dead'))}</div>
        </div>`;
    })() : '';

    const stepper = (label, field) => `<div class="stat-row">
      <span class="stat-label">${label}</span>
      <span class="stat-value" style="display:flex;align-items:center;gap:10px;">
        <button class="step-btn" style="width:34px;height:34px;font-size:1.1rem;" onclick="ui.editStat('${field}',-1)">−</button>
        <span id="ed-${field}" style="min-width:24px;text-align:center;">${d[field]}</span>
        <button class="step-btn" style="width:34px;height:34px;font-size:1.1rem;" onclick="ui.editStat('${field}',1)">+</button>
      </span>
    </div>`;

    const makerMode = m.format === '8-ball';
    const opts = makerMode ? this.endTypeOptions8(d.maker) : this.endTypeOptions(d.winner);
    const endButtons = opts.map(o => `<button class="endtype-btn${d.endType === o.type ? ' selected' : ''}" onclick="ui.editEndType('${o.type}')">${esc(o.label)}</button>`).join('');
    const whoBlock = makerMode
      ? `<div class="section-title">Who made the 8-ball?</div>
      <div class="scorer-toggle">
        <button class="btn ${d.maker === 'home' ? 'active' : 'btn-secondary'}" onclick="ui.editMaker('home')">🏠 ${esc(m.homePlayer.name)}</button>
        <button class="btn ${d.maker === 'away' ? 'active' : 'btn-secondary'}" onclick="ui.editMaker('away')">👥 ${esc(m.awayPlayer.name)}</button>
        <button class="btn ${d.maker === null ? 'active' : 'btn-secondary'}" onclick="ui.editMaker(null)">Nobody</button>
      </div>`
      : `<div class="section-title">Winner</div>
      <div class="scorer-toggle">
        <button class="btn ${d.winner === 'home' ? 'active' : 'btn-secondary'}" onclick="ui.editWinner('home')">🏠 ${esc(m.homePlayer.name)}</button>
        <button class="btn ${d.winner === 'away' ? 'active' : 'btn-secondary'}" onclick="ui.editWinner('away')">👥 ${esc(m.awayPlayer.name)}</button>
        <button class="btn ${d.winner === null ? 'active' : 'btn-secondary'}" onclick="ui.editWinner(null)">None</button>
      </div>`;

    showModal(`<div class="modal-title">Edit Rack ${rack.rackNumber} <span class="modal-close" onclick="ui.cancelRackEdit()">×</span></div>
      ${ballSections}
      <div class="section-title">Stats</div>
      ${stepper('Innings', 'innings')}
      ${stepper(esc(m.homePlayer.name) + ' defensive', 'homeDefensiveShots')}
      ${stepper(esc(m.awayPlayer.name) + ' defensive', 'awayDefensiveShots')}
      ${stepper(esc(m.homePlayer.name) + ' time-outs', 'homeTimeouts')}
      ${stepper(esc(m.awayPlayer.name) + ' time-outs', 'awayTimeouts')}
      ${whoBlock}
      <div class="section-title">How it ended</div>
      <div class="endtype-grid">${endButtons}</div>
      <div class="mt-16"><button class="btn btn-primary" onclick="ui.saveRackEdit()">Save Changes</button></div>
      <div class="mt-8"><button class="btn btn-secondary" onclick="ui.cancelRackEdit()">Cancel</button></div>
      <div style="height:16px;"></div>
    `);
  },

  editSetTarget(side) { this._editDraft.target = side; this.renderRackEditor(); },
  editPick(n) {
    const d = this._editDraft;
    if (!d || d.balls.some(b => b.number === n)) return;
    if (n === 9 && d.target === 'dead') { showToast('The 9-ball is never dead — it gets spotted'); return; }
    d.balls.push({ number: n, pocketedBy: d.target === 'dead' ? null : d.target, dead: d.target === 'dead' });
    this.renderRackEditor();
  },
  editReturn(n) {
    const d = this._editDraft;
    if (!d) return;
    d.balls = d.balls.filter(b => b.number !== n);
    this.renderRackEditor();
  },
  editStat(field, delta) {
    const d = this._editDraft;
    if (!d) return;
    d[field] = Math.max(0, (d[field] || 0) + delta);
    const el = document.getElementById('ed-' + field);
    if (el) el.textContent = d[field];
  },
  editWinner(side) { this._editDraft.winner = side; this._editDraft.endType = null; this.renderRackEditor(); },
  editMaker(side) { this._editDraft.maker = side; this._editDraft.endType = null; this.renderRackEditor(); },
  editEndType(type) { this._editDraft.endType = type; this.renderRackEditor(); },
  cancelRackEdit() { this._editDraft = null; closeModal(); },

  async saveRackEdit() {
    const m = currentMatch;
    const d = this._editDraft;
    const rack = m.racks[this._editIndex];
    if (!d || !rack) return;
    if (!d.endType) { showToast('Pick how the rack ended'); return; }
    if (d.endType === 'STALEMATE' && (m.format === '8-ball' ? d.maker : d.winner) !== null) {
      showToast('A stalemate has no winner'); return;
    }

    // In 9-ball every winning ending means the winner potted the 9, so the
    // 9 must sit in their section. This catches a corrected scorecard that
    // contradicts itself.
    if (m.format === '9-ball' && d.winner) {
      const nine = d.balls.find(b => b.number === 9);
      const name = d.winner === 'home' ? m.homePlayer.name : m.awayPlayer.name;
      if (!nine || nine.dead || nine.pocketedBy !== d.winner) {
        showToast(`The 9-ball has to be in ${name}'s section for them to win this rack`);
        return;
      }
    }

    rack.balls = m.format === '9-ball'
      ? d.balls.map(b => ({ number: b.number, pocketedBy: b.dead ? null : (b.pocketedBy || null), dead: !!b.dead }))
      : [];
    rack.innings = d.innings;
    rack.homeDefensiveShots = d.homeDefensiveShots;
    rack.awayDefensiveShots = d.awayDefensiveShots;
    rack.homeTimeouts = d.homeTimeouts;
    rack.awayTimeouts = d.awayTimeouts;

    let winner = d.winner;
    if (m.format === '8-ball') {
      const opt = this.endTypeOptions8(d.maker).find(o => o.type === d.endType);
      winner = opt ? opt.winner : null;
    }
    endRack(m, rack, d.endType, winner);
    await saveMatch(m);
    this._editDraft = null;
    closeModal();
    this.renderMatch();
    showToast('Rack updated');
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

  // ── Plain-text summaries (email / copy into the official app) ──
  showMatchText() {
    if (!currentMatch) return;
    const text = formatMatchSummary(currentMatch);
    showModal(`<div class="modal-title">Match Summary <span class="modal-close" onclick="closeModal()">×</span></div>
      <p class="text-sm text-dim mb-8">Email it, or copy it and type it into the official app.</p>
      <textarea class="report-text" id="match-text" readonly>${esc(text)}</textarea>
      <div class="btn-row mt-8">
        <button class="btn btn-primary" onclick="ui.copyMatchText()">Copy</button>
        <button class="btn btn-secondary" onclick="ui.emailMatchText()">Email</button>
      </div>
      <div style="height:16px;"></div>
    `);
  },

  async copyMatchText() {
    const text = formatMatchSummary(currentMatch);
    const ok = await copyText(text);
    if (ok) { showToast('Summary copied'); return; }
    // Clipboard blocked (file:// or no permission): leave it selected so the
    // user can just press their keyboard/app Copy button.
    const ta = document.getElementById('match-text');
    if (ta) { ta.focus(); ta.select(); }
    showToast('Copy blocked here — text selected, press Copy');
  },

  async emailMatchText() {
    const m = currentMatch;
    const subject = `APA ${m.format === '9-ball' ? '9-ball' : '8-ball'} — ${m.homePlayer.name} vs ${m.awayPlayer.name}`;
    await emailText(subject, formatMatchSummary(m));
  },

  // ── Report view: every match on one page ──
  async renderReport() {
    const all = await getAllMatches();
    this._reportMatches = all.filter(m => m.status === 'completed')
      .sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt));

    if (!this._reportRange) this._reportRange = 'all';
    if (!this._reportSel) this._reportSel = new Set(this._reportMatches.map(m => m.id));

    const range = this._reportRange;
    const now = Date.now();
    const inRange = this._reportMatches.filter(m => {
      const ts = m.completedAt || m.createdAt || 0;
      if (range === 'today') return new Date(ts).toDateString() === new Date(now).toDateString();
      if (range === 'week') return (now - ts) < 7 * 86400000;
      return true;
    });
    // Anything not in range cannot stay selected.
    const idsInRange = new Set(inRange.map(m => m.id));
    [...this._reportSel].forEach(id => { if (!idsInRange.has(id)) this._reportSel.delete(id); });

    const rows = inRange.length ? inRange.map(m => {
      const fs = m.finalScore || { home: 0, away: 0 };
      const when = new Date(m.completedAt || m.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const result = m.winner ? `${m.winner === 'home' ? m.homePlayer.name : m.awayPlayer.name} won` : (m.forfeit ? 'forfeit' : 'no result');
      const middle = m.forfeit ? 'forfeit' : `${fs.home}-${fs.away}`;
      return `<div class="pick-row">
        <input type="checkbox" ${this._reportSel.has(m.id) ? 'checked' : ''} onchange="ui.toggleReportMatch('${m.id}', this.checked)">
        <div class="pick-main">
          <div class="pick-title">${esc(m.homePlayer.name)} ${middle} ${esc(m.awayPlayer.name)}</div>
          <div class="pick-sub">${m.format === '9-ball' ? '9-ball' : '8-ball'} · ${when} · ${esc(result)}</div>
        </div>
      </div>`;
    }).join('') : '<p class="text-sm text-dim">No completed matches in this range.</p>';

    $('report-content').innerHTML = `
      <div class="card">
        <div class="section-title" style="margin-top:0;">Include</div>
        <div class="seg">
          <button class="${range === 'today' ? 'active' : ''}" onclick="ui.setReportRange('today')">Today</button>
          <button class="${range === 'week' ? 'active' : ''}" onclick="ui.setReportRange('week')">7 days</button>
          <button class="${range === 'all' ? 'active' : ''}" onclick="ui.setReportRange('all')">All</button>
        </div>
        <div class="btn-row">
          <button class="btn btn-secondary" style="font-size:0.8rem;padding:8px;" onclick="ui.selectAllReport(true)">Select all</button>
          <button class="btn btn-secondary" style="font-size:0.8rem;padding:8px;" onclick="ui.selectAllReport(false)">Clear</button>
        </div>
        <div class="mt-8">${rows}</div>
      </div>
      <div class="card">
        <div class="form-group">
          <label>Report title</label>
          <input type="text" id="report-label" value="${esc(this._reportLabel || 'APA MATCH SUMMARY')}" oninput="ui.setReportLabel(this.value)">
        </div>
        <label style="display:flex;align-items:center;gap:10px;margin-bottom:12px;color:var(--text);text-transform:none;letter-spacing:0;">
          <input type="checkbox" id="report-racks" ${this._reportRacks !== false ? 'checked' : ''} onchange="ui.setReportRacks(this.checked)" style="width:20px;height:20px;accent-color:var(--primary);">
          <span class="text-sm">Rack-by-rack detail (who won each rack + innings)</span>
        </label>
        <textarea class="report-text" id="report-text" readonly></textarea>
        <div class="btn-row mt-8">
          <button class="btn btn-primary" onclick="ui.copyReport()">Copy</button>
          <button class="btn btn-secondary" onclick="ui.emailReport()">Email</button>
          <button class="btn btn-secondary" onclick="ui.shareReport()">Share</button>
        </div>
      </div>`;

    this.refreshReportText();
  },

  selectedReportMatches() {
    const sel = this._reportSel || new Set();
    return (this._reportMatches || []).filter(m => sel.has(m.id));
  },

  buildReportText() {
    return formatSessionSummary(this.selectedReportMatches(), {
      label: this._reportLabel || 'APA MATCH SUMMARY',
      generatedAt: Date.now(),
      includeRacks: this._reportRacks !== false
    });
  },

  setReportRacks(on) {
    this._reportRacks = on;
    this.refreshReportText();
  },

  refreshReportText() {
    const ta = document.getElementById('report-text');
    if (ta) ta.value = this.buildReportText();
  },

  setReportRange(range) {
    this._reportRange = range;
    // Switching range starts from "everything visible", which is what people expect.
    this._reportSel = null;
    this.renderReport();
  },

  toggleReportMatch(id, on) {
    if (!this._reportSel) this._reportSel = new Set();
    if (on) this._reportSel.add(id); else this._reportSel.delete(id);
    this.refreshReportText();
  },

  selectAllReport(on) {
    const now = Date.now();
    const inRange = (this._reportMatches || []).filter(m => {
      const ts = m.completedAt || m.createdAt || 0;
      if (this._reportRange === 'today') return new Date(ts).toDateString() === new Date(now).toDateString();
      if (this._reportRange === 'week') return (now - ts) < 7 * 86400000;
      return true;
    });
    this._reportSel = new Set(on ? inRange.map(m => m.id) : []);
    // Re-render to update the checkboxes.
    this.renderReport();
  },

  setReportLabel(v) {
    this._reportLabel = v;
    this.refreshReportText();
  },

  async copyReport() {
    const ok = await copyText(this.buildReportText());
    if (ok) { showToast('Summary copied'); return; }
    const ta = document.getElementById('report-text');
    if (ta) { ta.focus(); ta.select(); }
    showToast('Copy blocked here — text selected, press Copy');
  },

  async emailReport() {
    await emailText(this._reportLabel || 'APA MATCH SUMMARY', this.buildReportText());
  },

  async shareReport() {
    const text = this.buildReportText();
    if (navigator.share) {
      try { await navigator.share({ title: this._reportLabel || 'APA MATCH SUMMARY', text }); return; }
      catch (e) { /* user cancelled */ }
    }
    const ok = await copyText(text);
    showToast(ok ? 'Sharing not available — summary copied' : 'Could not share');
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
  /** Wipe the service worker + caches and reload. This is the escape hatch
   *  when a phone keeps showing an old build. */
  async forceUpdate() {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    } catch (e) { /* private mode, etc. */ }
    location.reload();
  },


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
  const v = document.getElementById('app-version');
  if (v) v.textContent = APP_VERSION;
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
