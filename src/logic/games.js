import { supabase } from '../lib/supabase.js';
import { splitPgn } from './pgn.js';

const LOCAL_KEY = 'chess_drill_games';
const PAGE_SIZE = 20;

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
  const time_control = h('TimeControl') || null;
  const game_date = h('UTCDate') || h('Date') || null;
  const event = h('Event') || null;
  const chapterName = h('ChapterName') || null;

  let player_color = null;
  if (playerName) {
    const lc = playerName.toLowerCase();
    if (white.toLowerCase() === lc) player_color = 'white';
    else if (black.toLowerCase() === lc) player_color = 'black';
  }

  const opponent = player_color === 'white' ? (black || null) : (player_color === 'black' ? (white || null) : null);

  let result = null;
  if (resultHeader && player_color) {
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

  return { name, opening, eco, result, player_color, opponent, time_control, game_date };
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
    .select('id, name, opening, eco, result, player_color, opponent, time_control, game_date, tags, created_at', { count: 'exact' })
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

async function _saveOne(userId, pgn, playerName) {
  const meta = extractPgnMetadata(pgn, playerName);
  const record = { ...meta, pgn, tags: [] };

  if (!userId) {
    const entry = { ...record, id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`, created_at: new Date().toISOString() };
    saveLocalGames([entry, ...localGames()]);
    const { pgn: _pgn, ...rest } = entry;
    return rest;
  }

  const { data, error } = await supabase
    .from('user_games')
    .insert({ user_id: userId, ...record })
    .select('id, name, opening, eco, result, player_color, opponent, time_control, game_date, tags, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function saveGame(userId, pgn, playerName) {
  return _saveOne(userId, pgn, playerName);
}

export async function importGames(userId, pgn, playerName) {
  const parts = splitPgn(pgn);
  const results = [];
  for (const part of parts) {
    try {
      const g = await _saveOne(userId, part, playerName);
      results.push(g);
    } catch (e) {
      console.warn('Skipping game during import:', e);
    }
  }
  return results;
}

export async function deleteGame(gameId) {
  if (String(gameId).startsWith('local_')) {
    saveLocalGames(localGames().filter(g => g.id !== gameId));
    return;
  }
  await supabase.from('user_games').delete().eq('id', gameId);
}

export async function updateGameTags(gameId, tags) {
  if (String(gameId).startsWith('local_')) {
    saveLocalGames(localGames().map(g => g.id === gameId ? { ...g, tags } : g));
    return;
  }
  await supabase.from('user_games').update({ tags }).eq('id', gameId);
}

export async function updateGameName(gameId, name) {
  if (String(gameId).startsWith('local_')) {
    saveLocalGames(localGames().map(g => g.id === gameId ? { ...g, name } : g));
    return;
  }
  await supabase.from('user_games').update({ name }).eq('id', gameId);
}
