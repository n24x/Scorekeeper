/**
 * APA Scorekeeper - Local Storage (IndexedDB)
 * Stores teams, players, and matches locally on the device.
 * No server required — fully offline.
 */

const DB_NAME = 'apa-scorekeeper';
const DB_VERSION = 1;

const STORES = {
  TEAMS: 'teams',
  PLAYERS: 'players',
  MATCHES: 'matches',
  SETTINGS: 'settings'
};

let dbPromise = null;

/** Open (and upgrade) the database */
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Teams store
      if (!db.objectStoreNames.contains(STORES.TEAMS)) {
        const teamStore = db.createObjectStore(STORES.TEAMS, { keyPath: 'id', autoIncrement: true });
        teamStore.createIndex('name', 'name', { unique: false });
      }

      // Players store
      if (!db.objectStoreNames.contains(STORES.PLAYERS)) {
        const playerStore = db.createObjectStore(STORES.PLAYERS, { keyPath: 'id', autoIncrement: true });
        playerStore.createIndex('teamId', 'teamId', { unique: false });
        playerStore.createIndex('name', 'name', { unique: false });
      }

      // Matches store
      if (!db.objectStoreNames.contains(STORES.MATCHES)) {
        const matchStore = db.createObjectStore(STORES.MATCHES, { keyPath: 'id' });
        matchStore.createIndex('createdAt', 'createdAt', { unique: false });
        matchStore.createIndex('status', 'status', { unique: false });
      }

      // Settings store (key-value)
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Generic CRUD helper */
async function dbAction(storeName, action, ...args) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store[action](...args);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(storeName) {
  return dbAction(storeName, 'getAll');
}

async function dbGet(storeName, id) {
  return dbAction(storeName, 'get', id);
}

async function dbAdd(storeName, obj) {
  return dbAction(storeName, 'add', obj);
}

async function dbPut(storeName, obj) {
  return dbAction(storeName, 'put', obj);
}

async function dbDelete(storeName, id) {
  return dbAction(storeName, 'delete', id);
}

// ═══════════════════════════════════════════════════════════════════
// Teams
// ═══════════════════════════════════════════════════════════════════

async function saveTeam(team) {
  if (!team.createdAt) team.createdAt = Date.now();
  team.updatedAt = Date.now();
  return dbPut(STORES.TEAMS, team);
}

async function getTeam(id) {
  return dbGet(STORES.TEAMS, id);
}

async function getAllTeams() {
  return dbGetAll(STORES.TEAMS);
}

async function deleteTeam(id) {
  // Also delete all players on this team
  const players = await getPlayersByTeam(id);
  for (const p of players) {
    await dbDelete(STORES.PLAYERS, p.id);
  }
  return dbDelete(STORES.TEAMS, id);
}

// ═══════════════════════════════════════════════════════════════════
// Players
// ═══════════════════════════════════════════════════════════════════

async function savePlayer(player) {
  if (!player.createdAt) player.createdAt = Date.now();
  player.updatedAt = Date.now();
  return dbPut(STORES.PLAYERS, player);
}

async function getPlayer(id) {
  return dbGet(STORES.PLAYERS, id);
}

async function getAllPlayers() {
  return dbGetAll(STORES.PLAYERS);
}

async function getPlayersByTeam(teamId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PLAYERS, 'readonly');
    const index = tx.objectStore(STORES.PLAYERS).index('teamId');
    const req = index.getAll(teamId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deletePlayer(id) {
  return dbDelete(STORES.PLAYERS, id);
}

// ═══════════════════════════════════════════════════════════════════
// Matches
// ═══════════════════════════════════════════════════════════════════

async function saveMatch(match) {
  match.updatedAt = Date.now();
  return dbPut(STORES.MATCHES, match);
}

async function getMatch(id) {
  return dbGet(STORES.MATCHES, id);
}

async function getAllMatches() {
  return dbGetAll(STORES.MATCHES);
}

async function getMatchesByStatus(status) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MATCHES, 'readonly');
    const index = tx.objectStore(STORES.MATCHES).index('status');
    const req = index.getAll(status);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteMatch(id) {
  return dbDelete(STORES.MATCHES, id);
}

// ═══════════════════════════════════════════════════════════════════
// Settings (key-value)
// ═══════════════════════════════════════════════════════════════════

async function getSetting(key, defaultValue = null) {
  const result = await dbGet(STORES.SETTINGS, key);
  return result ? result.value : defaultValue;
}

async function setSetting(key, value) {
  return dbPut(STORES.SETTINGS, { key, value });
}

// ═══════════════════════════════════════════════════════════════════
// Export / Import (JSON backup)
// ═══════════════════════════════════════════════════════════════════

async function exportAllData() {
  const teams = await getAllTeams();
  const players = await getAllPlayers();
  const matches = await getAllMatches();
  const settings = await dbGetAll(STORES.SETTINGS);
  return {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    teams, players, matches, settings
  };
}

async function importAllData(data) {
  // Clear existing data then import
  const db = await openDB();
  const tx = db.transaction([STORES.TEAMS, STORES.PLAYERS, STORES.MATCHES, STORES.SETTINGS], 'readwrite');

  await Promise.all([
    new Promise((res, rej) => { const r = tx.objectStore(STORES.TEAMS).clear(); r.onsuccess = res; r.onerror = rej; }),
    new Promise((res, rej) => { const r = tx.objectStore(STORES.PLAYERS).clear(); r.onsuccess = res; r.onerror = rej; }),
    new Promise((res, rej) => { const r = tx.objectStore(STORES.MATCHES).clear(); r.onsuccess = res; r.onerror = rej; }),
    new Promise((res, rej) => { const r = tx.objectStore(STORES.SETTINGS).clear(); r.onsuccess = res; r.onerror = rej; }),
  ]);

  for (const team of (data.teams || [])) {
    tx.objectStore(STORES.TEAMS).add(team);
  }
  for (const player of (data.players || [])) {
    tx.objectStore(STORES.PLAYERS).add(player);
  }
  for (const match of (data.matches || [])) {
    tx.objectStore(STORES.MATCHES).add(match);
  }
  for (const setting of (data.settings || [])) {
    tx.objectStore(STORES.SETTINGS).add(setting);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

if (typeof module !== 'undefined') module.exports = {
  openDB, saveTeam, getTeam, getAllTeams, deleteTeam,
  savePlayer, getPlayer, getAllPlayers, getPlayersByTeam, deletePlayer,
  saveMatch, getMatch, getAllMatches, getMatchesByStatus, deleteMatch,
  getSetting, setSetting,
  exportAllData, importAllData
};
