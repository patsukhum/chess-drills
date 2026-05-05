import { supabase } from '../lib/supabase.js';
import { splitPgn, parseChapterNameMeta } from './pgn.js';

const LOCAL_KEY = 'chess_drill_games';
const PAGE_SIZE = 20;

const LIST_COLS = 'id, name, opening, eco, result, player_color, opponent, opponent_rating, time_control, game_date, phase, notes, tags, created_at';

function localGames() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}
function saveLocalGames(arr) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));
}

export function extractPgnMetadata(pgn, playerName) {
  const h = tag => {
    const m = pgn.match(new RegExp(`\\[${tag}\\s+"([^"]+)"\\]`));
    return m ? m[1] : null;
  };

  const opening = h('Opening') || null;
  const eco = h('ECO') || null;
  const white = h('White') || '';
  const black = h('Black') || '';
  const resultHeader = h('Result') || null;
  const time_control_header = h('TimeControl') || null;
  const game_date = h('UTCDate') || h('Date') || null;
  const event = h('Event') || null;
  const chapterName = h('ChapterName') || null;
  const whiteElo = h('WhiteElo');
  const blackElo = h('BlackElo');

  // Parse chapter name for richer metadata (result, opponent, rating, time control)
  const cm = parseChapterNameMeta(chapterName);

  // Player color: infer from chapter-name result + PGN Result header
  let player_color = null;
  if (cm.result && resultHeader && resultHeader !== '*' && resultHeader !== '1/2-1/2') {
    if (cm.result === 'win'  && resultHeader === '1-0') player_color = 'white';
    if (cm.result === 'win'  && resultHeader === '0-1') player_color = 'black';
    if (cm.result === 'loss' && resultHeader === '1-0') player_color = 'black';
    if (cm.result === 'loss' && resultHeader === '0-1') player_color = 'white';
  }
  // Fallback: match by player name against White/Black headers
  if (!player_color && playerName) {
    const lc = playerName.toLowerCase();
    if (white.toLowerCase() === lc) player_color = 'white';
    else if (black.toLowerCase() === lc) player_color = 'black';
  }

  // Opponent from color (White/Black header names)
  const opponent_from_header = player_color === 'white' ? (black || null) : (player_color === 'black' ? (white || null) : null);
  const opponent_rating_from_elo = (() => {
    const s = player_color === 'white' ? blackElo : (player_color === 'black' ? whiteElo : null);
    return s ? parseInt(s) || null : null;
  })();

  // Chapter name takes precedence for opponent/rating/time_control
  const opponent = cm.opponent || opponent_from_header;
  const opponent_rating = cm.opponent_rating || opponent_rating_from_elo;
  const time_control = time_control_header || cm.time_control || null;

  // Result: chapter name is most reliable (handles * games)
  let result = cm.result || null;
  if (!result && resultHeader && player_color) {
    if (resultHeader === '1/2-1/2') result = 'draw';
    else if (resultHeader === '1-0') result = player_color === 'white' ? 'win' : 'loss';
    else if (resultHeader === '0-1') result = player_color === 'black' ? 'win' : 'loss';
  }

  let name = chapterName || null;
  if (!name && opponent) {
    name = event && event !== '?' ? `${event} vs ${opponent}` : `vs ${opponent}`;
  }
  if (!name && white && black && white !== '?' && black !== '?') {
    name = `${white} vs ${black}`;
  }
  if (!name) name = 'Untitled';

  return { name, opening, eco, result, player_color, opponent, opponent_rating, time_control, game_date };
}

export async function getGames(userId, { page = 0, search = '', filterResult = 'all' } = {}) {
  if (!userId) {
    let games = localGames().map(({ pgn: _pgn, ...rest }) => rest);
    if (search) {
      const q = search.toLowerCase();
      games = games.filter(g =>
        g.name?.toLowerCase().includes(q) ||
        g.opening?.toLowerCase().includes(q) ||
        g.opponent?.toLowerCase().includes(q) ||
        g.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    if (filterResult !== 'all') games = games.filter(g => g.result === filterResult);
    const total = games.length;
    return { games: games.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), total };
  }

  let query = supabase
    .from('user_games')
    .select(LIST_COLS, { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (filterResult !== 'all') query = query.eq('result', filterResult);
  if (search) {
    query = query.or(`name.ilike.%${search}%,opponent.ilike.%${search}%,opening.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return { games: [], total: 0 };
  return { games: data, total: count };
}

export async function getGamePgn(gameId) {
  if (String(gameId).startsWith('local_')) {
    const game = localGames().find(g => g.id === gameId);
    if (!game) throw new Error('Game not found');
    return game.pgn;
  }
  const { data, error } = await supabase
    .from('user_games')
    .select('pgn')
    .eq('id', gameId)
    .single();
  if (error) throw error;
  return data.pgn;
}

async function _saveOne(userId, pgn, playerName, overrides = {}) {
  const meta = extractPgnMetadata(pgn, playerName);
  const record = { ...meta, ...overrides, pgn, tags: [], phase: null, notes: null };

  if (!userId) {
    const entry = { ...record, id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`, created_at: new Date().toISOString() };
    saveLocalGames([entry, ...localGames()]);
    const { pgn: _pgn, ...rest } = entry;
    return rest;
  }

  const { data, error } = await supabase
    .from('user_games')
    .insert({ user_id: userId, ...record })
    .select(LIST_COLS)
    .single();
  if (error) throw error;
  return data;
}

export async function saveGame(userId, pgn, playerName, overrides = {}) {
  return _saveOne(userId, pgn, playerName, overrides);
}

export async function deleteGame(gameId) {
  if (String(gameId).startsWith('local_')) {
    saveLocalGames(localGames().filter(g => g.id !== gameId));
    return;
  }
  await supabase.from('user_games').delete().eq('id', gameId);
}

export async function updateGameField(gameId, fields) {
  if (String(gameId).startsWith('local_')) {
    saveLocalGames(localGames().map(g => g.id === gameId ? { ...g, ...fields } : g));
    return;
  }
  await supabase.from('user_games').update(fields).eq('id', gameId);
}
