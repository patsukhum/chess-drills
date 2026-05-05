import { supabase } from '../lib/supabase.js';

const PAGE_SIZE = 30;
const BATCH_SIZE = 200;

const LIST_COLS = 'id, platform, platform_game_id, platform_username, name, opening, eco, result, player_color, opponent, opponent_rating, time_control, time_control_category, game_date, played_at, created_at';

// ── Opening helpers ───────────────────────────────────────────────────────────

// Convert Chess.com ECOUrl slug to "Family: Variation" format.
// e.g. "Sicilian-Defense-Najdorf-Variation" → "Sicilian Defense: Najdorf Variation"
function ecoUrlToOpening(url) {
  const slug = url.split('/').pop().replace(/-/g, ' ');
  // Split after the first occurrence of a common family-ending word
  const m = slug.match(/^(.+?(?:Defense|Opening|Gambit|Attack|Game|System|Declined|Accepted|Exchange|Indian|Formation))\s+(.+)$/i);
  return m ? `${m[1]}: ${m[2]}` : slug;
}

// ── Time control ──────────────────────────────────────────────────────────────

export function categorizeTimeControl(tcHeader) {
  if (!tcHeader || tcHeader === '-') return null;
  // "600+5", "180", "60+0"
  const parts = tcHeader.split('+');
  const base = parseInt(parts[0]);
  const inc = parts.length > 1 ? parseInt(parts[1]) : 0;
  if (isNaN(base)) return null;
  // Estimated total time = base + 40 * increment
  const est = base + 40 * inc;
  if (est < 180) return 'bullet';
  if (est < 600) return 'blitz';
  if (est < 1800) return 'rapid';
  return 'classical';
}

// ── Metadata extraction ───────────────────────────────────────────────────────

function tag(pgn, name) {
  const m = pgn.match(new RegExp(`\\[${name}\\s+"([^"]*)"\\]`));
  return m ? (m[1] !== '?' ? m[1] : null) : null;
}

export function extractOnlineGameMeta(pgn, platform, username) {
  const white = tag(pgn, 'White') || '';
  const black = tag(pgn, 'Black') || '';
  const whiteElo = tag(pgn, 'WhiteElo');
  const blackElo = tag(pgn, 'BlackElo');
  const resultHeader = tag(pgn, 'Result');
  // Lichess: [Opening "Family: Variation"], Chess.com: [ECOUrl ".../Sicilian-Defense-Najdorf-Variation"]
  const ecoUrl = tag(pgn, 'ECOUrl');
  const openingFromUrl = ecoUrl ? ecoUrlToOpening(ecoUrl) : null;
  const opening = tag(pgn, 'Opening') || openingFromUrl || null;
  const eco = tag(pgn, 'ECO') || null;
  const tcHeader = tag(pgn, 'TimeControl') || null;
  const utcDate = tag(pgn, 'UTCDate');
  const utcTime = tag(pgn, 'UTCTime');
  const dateHeader = tag(pgn, 'Date');
  const gameDate = utcDate || dateHeader || null;

  // Platform game ID from Site/Link header
  let platform_game_id = null;
  const site = tag(pgn, 'Site') || '';
  if (platform === 'lichess') {
    // https://lichess.org/GAMEID or https://lichess.org/GAMEID/white
    const m = site.match(/lichess\.org\/([a-zA-Z0-9]{8})/);
    platform_game_id = m ? m[1] : site.split('/').pop();
  } else {
    // Chess.com: [Site "Chess.com"] + [Link "https://www.chess.com/game/live/GAMEID"]
    const link = tag(pgn, 'Link') || site;
    const m = link.match(/chess\.com\/game\/(?:live|daily)\/(\d+)/);
    platform_game_id = m ? m[1] : null;
  }
  if (!platform_game_id) return null;

  // Player color
  const lc = username.toLowerCase();
  let player_color = null;
  if (white.toLowerCase() === lc) player_color = 'white';
  else if (black.toLowerCase() === lc) player_color = 'black';

  // Result
  let result = null;
  if (resultHeader && player_color) {
    if (resultHeader === '1/2-1/2') result = 'draw';
    else if (resultHeader === '1-0') result = player_color === 'white' ? 'win' : 'loss';
    else if (resultHeader === '0-1') result = player_color === 'black' ? 'win' : 'loss';
  }

  const opponent = player_color === 'white' ? (black || null) : player_color === 'black' ? (white || null) : null;
  const oppEloStr = player_color === 'white' ? blackElo : player_color === 'black' ? whiteElo : null;
  const opponent_rating = oppEloStr ? (parseInt(oppEloStr) || null) : null;

  const name = opponent ? `vs ${opponent}` : white && black ? `${white} vs ${black}` : 'Game';
  const time_control_category = categorizeTimeControl(tcHeader);

  // played_at timestamp
  let played_at = null;
  if (utcDate && utcDate !== '????.??.??') {
    const d = utcDate.replace(/\./g, '-');
    played_at = utcTime ? new Date(`${d}T${utcTime}Z`).toISOString() : new Date(`${d}T00:00:00Z`).toISOString();
  } else if (dateHeader && dateHeader !== '????.??.??') {
    const d = dateHeader.replace(/\./g, '-');
    played_at = new Date(`${d}T00:00:00Z`).toISOString();
  }

  return {
    platform_game_id,
    platform_username: username,
    name,
    opening,
    eco,
    result,
    player_color,
    opponent,
    opponent_rating,
    time_control: tcHeader,
    time_control_category,
    game_date: gameDate,
    played_at,
  };
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchLichessGames(username, { max = 5000, since = null } = {}) {
  let url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&opening=true&clocks=true&evals=false`;
  if (since) url += `&since=${since}`;
  const resp = await fetch(url, { headers: { Accept: 'application/x-chess-pgn' } });
  if (resp.status === 404) throw new Error(`Lichess user "${username}" not found`);
  if (!resp.ok) throw new Error(`Lichess error: ${resp.status}`);
  const text = await resp.text();
  return text.trim().split(/\n\n(?=\[)/).filter(Boolean);
}

export async function fetchChessComGames(username, { max = 5000, onProgress } = {}) {
  const archResp = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`);
  if (archResp.status === 404) throw new Error(`Chess.com user "${username}" not found`);
  if (!archResp.ok) throw new Error(`Chess.com error: ${archResp.status}`);
  const { archives } = await archResp.json();
  if (!archives?.length) return [];

  const pgns = [];
  // Iterate newest→oldest archives, stop once we have enough
  for (let i = archives.length - 1; i >= 0 && pgns.length < max; i--) {
    const monthResp = await fetch(archives[i]);
    if (!monthResp.ok) continue;
    const { games: monthGames } = await monthResp.json();
    if (monthGames) {
      for (const g of [...monthGames].reverse()) {
        if (g.pgn) pgns.push(g.pgn);
        if (pgns.length >= max) break;
      }
    }
    onProgress?.(pgns.length);
  }
  return pgns;
}

// ── Import & upsert ───────────────────────────────────────────────────────────

export async function importOnlineGames(userId, platform, username, { max = 5000, since = null, onProgress } = {}) {
  const pgnList = platform === 'lichess'
    ? await fetchLichessGames(username, { max, since })
    : await fetchChessComGames(username, { max, onProgress });

  const records = [];
  for (const pgn of pgnList) {
    const meta = extractOnlineGameMeta(pgn, platform, username);
    if (!meta) continue;
    records.push({ user_id: userId, platform, pgn, ...meta });
  }

  let saved = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('online_games')
      .upsert(batch, { onConflict: 'user_id,platform,platform_game_id' });
    if (error) throw error;
    saved += batch.length;
    onProgress?.(saved, records.length);
  }

  return { fetched: pgnList.length, saved: records.length };
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getOnlineGames(userId, { page = 0, search = '', filterResult = 'all', filterPlatform = 'all', filterTC = 'all' } = {}) {
  let query = supabase
    .from('online_games')
    .select(LIST_COLS, { count: 'exact' })
    .eq('user_id', userId)
    .order('played_at', { ascending: false, nullsFirst: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (filterResult !== 'all') query = query.eq('result', filterResult);
  if (filterPlatform !== 'all') query = query.eq('platform', filterPlatform);
  if (filterTC !== 'all') query = query.eq('time_control_category', filterTC);
  if (search) query = query.or(`opponent.ilike.%${search}%,opening.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return { games: [], total: 0 };
  return { games: data, total: count };
}

export async function getOnlineGamePgn(gameId) {
  const { data, error } = await supabase
    .from('online_games')
    .select('pgn')
    .eq('id', gameId)
    .single();
  if (error) throw error;
  return data.pgn;
}

export async function getLastPlayedAt(userId, platform, username) {
  const { data } = await supabase
    .from('online_games')
    .select('played_at')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('platform_username', username)
    .order('played_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.played_at ? new Date(data.played_at).getTime() : null;
}

export { PAGE_SIZE };
