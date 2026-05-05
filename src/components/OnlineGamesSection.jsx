import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import {
  importOnlineGames,
  getOnlineGames,
  getOnlineGamePgn,
  getLastPlayedAt,
  PAGE_SIZE,
} from '../logic/onlineGames.js';
import { pgnToReplayData } from '../logic/pgn.js';

const TC_LABELS = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classical: 'Classical' };
const PLATFORMS = [
  { id: 'lichess', label: 'Lichess' },
  { id: 'chess.com', label: 'Chess.com' },
];

const PLATFORM_LOGO = {
  lichess: 'https://lichess.org/assets/logo/lichess-favicon-32.png',
  'chess.com': 'https://www.chess.com/favicon.ico',
};

// "180+2" → "3+2", "600+0" → "10", "90+0" → "1:30"
function formatTC(tc) {
  if (!tc) return null;
  const m = tc.match(/^(\d+)(?:\+(\d+))?$/);
  if (!m) return tc;
  const baseSec = parseInt(m[1]);
  const inc = m[2] ? parseInt(m[2]) : 0;
  const mins = Math.floor(baseSec / 60);
  const secs = baseSec % 60;
  const timeStr = secs > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${mins}`;
  return inc > 0 ? `${timeStr}+${inc}` : timeStr;
}

// "0:05:00" → "5:00", "0:00:45" → "0:45"
function formatClock(clk) {
  if (!clk) return null;
  const [hStr, mStr, sStr] = clk.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const s = parseInt(sStr, 10);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function loadStoredAccounts() {
  try { return JSON.parse(localStorage.getItem('online_accounts') || '{}'); } catch { return {}; }
}
function saveStoredAccounts(acc) {
  localStorage.setItem('online_accounts', JSON.stringify(acc));
}

// ── Lightweight game row ──────────────────────────────────────────────────────

function OnlineGameRow({ game, onOpen }) {
  const colorCircle = game.player_color === 'white' ? '⚪' : game.player_color === 'black' ? '⚫' : null;
  const resultClass = game.result ? `game-row--${game.result}` : '';
  const dateStr = game.played_at ? new Date(game.played_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  const openingParts = game.opening ? game.opening.split(': ') : [];
  const openingFamily = openingParts[0] || null;
  const openingVariation = openingParts[1] || null;
  const tc = formatTC(game.time_control);

  return (
    <div className={`game-row ${resultClass}`} onClick={() => onOpen(game.id)} style={{ cursor: 'pointer' }}>
      <div className="game-row-body">
        {colorCircle && <span className="game-row-color">{colorCircle}</span>}
        <span className="game-row-name">
          {game.opponent || game.name}
          {game.opponent_rating ? <span className="game-row-rating"> ({game.opponent_rating})</span> : null}
        </span>
        <div className="game-row-chips">
          {openingFamily && <span className="game-row-chip">{openingFamily}</span>}
          {openingVariation && <span className="game-row-chip game-row-chip--muted">{openingVariation}</span>}
          {tc && <span className="game-row-chip game-row-chip--muted">{tc}</span>}
          {dateStr && <span className="game-row-chip game-row-chip--muted">{dateStr}</span>}
          <img
            src={PLATFORM_LOGO[game.platform]}
            alt={game.platform}
            className="online-platform-logo"
          />
        </div>
      </div>
    </div>
  );
}

// ── Move list ─────────────────────────────────────────────────────────────────

function ViewerMoveList({ moves, fens, posIdx, onJump, listRef }) {
  const activeIdx = posIdx - 1;

  const rows = useMemo(() => {
    const result = [];
    let i = 0;
    while (i < moves.length) {
      const parts = fens[i].split(' ');
      const moveNum = parseInt(parts[5]);
      const turn = parts[1];
      if (turn === 'w') {
        result.push({
          moveNum,
          white: { idx: i, san: moves[i].san, clk: moves[i].clk },
          black: i + 1 < moves.length ? { idx: i + 1, san: moves[i + 1].san, clk: moves[i + 1].clk } : null,
        });
        i += i + 1 < moves.length ? 2 : 1;
      } else {
        result.push({ moveNum, white: null, black: { idx: i, san: moves[i].san, clk: moves[i].clk } });
        i++;
      }
    }
    return result;
  }, [moves, fens]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('.movelist-cell--active');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [posIdx]);

  return (
    <div className="study-movelist" ref={listRef}>
      {rows.map((row, ri) => (
        <div key={ri} className="movelist-row-group">
          <div className="movelist-row">
            <span className="movelist-num">{row.moveNum}.</span>
            {row.white ? (
              <button
                className={`movelist-cell movelist-cell--btn${row.white.idx === activeIdx ? ' movelist-cell--active' : ''}`}
                onClick={() => onJump(row.white.idx + 1)}
              >
                {row.white.san}
              </button>
            ) : (
              <span className="movelist-cell movelist-cell--placeholder">…</span>
            )}
            {row.black ? (
              <button
                className={`movelist-cell movelist-cell--btn${row.black.idx === activeIdx ? ' movelist-cell--active' : ''}`}
                onClick={() => onJump(row.black.idx + 1)}
              >
                {row.black.san}
              </button>
            ) : (
              <span className="movelist-cell" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Clock panel (above/below board) ──────────────────────────────────────────

function ClockPanel({ name, rating, clk }) {
  return (
    <div className="clock-panel">
      <div className="clock-panel-info">
        <span className="clock-panel-name">{name}</span>
        {rating && <span className="clock-panel-rating">{rating}</span>}
      </div>
      {clk && <div className="clock-panel-time">{formatClock(clk)}</div>}
    </div>
  );
}

// ── Mini viewer (read-only, no editing) ──────────────────────────────────────

function OnlineGameViewer({ game, replayData, onBack }) {
  const [posIdx, setPosIdx] = useState(0);
  const boardWrapRef = useRef(null);
  const movelistRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(400);

  const { fens, moves } = replayData;
  const totalPos = fens.length;
  const prev = useCallback(() => setPosIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setPosIdx(i => Math.min(totalPos - 1, i + 1)), [totalPos]);

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  useLayoutEffect(() => {
    if (boardWrapRef.current) setBoardWidth(boardWrapRef.current.offsetWidth || 400);
  }, []);

  useEffect(() => {
    if (!boardWrapRef.current) return;
    const obs = new ResizeObserver(entries => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) setBoardWidth(w);
    });
    obs.observe(boardWrapRef.current);
    return () => obs.disconnect();
  }, []);

  const squareStyles = useMemo(() => {
    if (posIdx === 0) return {};
    const { from, to } = moves[posIdx - 1];
    return {
      [from]: { background: 'rgba(255, 215, 0, 0.35)' },
      [to]: { background: 'rgba(255, 215, 0, 0.55)' },
    };
  }, [posIdx, moves]);

  const orientation = game.player_color === 'black' ? 'black' : 'white';
  const colorCircle = game.player_color === 'white' ? '⚪' : game.player_color === 'black' ? '⚫' : null;
  const dateStr = game.played_at ? new Date(game.played_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  // Compute white/black clocks at current position
  const { whiteClock, blackClock } = useMemo(() => {
    let w = null, b = null;
    for (let i = 0; i < posIdx && i < moves.length; i++) {
      const turn = fens[i].split(' ')[1];
      if (turn === 'w') w = moves[i].clk;
      else b = moves[i].clk;
    }
    return { whiteClock: w, blackClock: b };
  }, [posIdx, moves, fens]);

  const hasClocks = moves.some(m => m.clk);
  const topClock = orientation === 'white' ? blackClock : whiteClock;
  const bottomClock = orientation === 'white' ? whiteClock : blackClock;
  const opponentName = game.opponent || '?';
  const playerName = game.platform_username || '';

  return (
    <div className="game-viewer-screen">
      <div className="game-viewer-nav">
        <button className="back-btn" onClick={onBack}><span className="back-btn-icon">‹</span>Online Games</button>
        <div className="game-viewer-title-row">
          {colorCircle && <span className="viewer-color-circle">{colorCircle}</span>}
          <span className="game-name-title" style={{ cursor: 'default' }}>{game.name}</span>
        </div>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '4px 0 8px', fontSize: '0.82rem', color: 'var(--text-muted)', alignItems: 'center' }}>
        {game.opening && <span>{game.opening}</span>}
        {dateStr && <span>· {dateStr}</span>}
        {game.time_control && <span>· {formatTC(game.time_control)}</span>}
        <img src={PLATFORM_LOGO[game.platform]} alt={game.platform} className="online-platform-logo" />
      </div>

      <div className="study-practice-layout">
        <div className="study-practice-left">
          {hasClocks && (
            <ClockPanel
              name={opponentName}
              rating={game.opponent_rating}
              clk={topClock}
            />
          )}
          <div className="study-board-wrap" ref={boardWrapRef}>
            {boardWidth > 0 && (
              <Chessboard
                options={{
                  position: fens[posIdx],
                  boardOrientation: orientation,
                  allowDragging: false,
                  boardWidth,
                  squareStyles,
                  animationDurationInMs: 150,
                  boardStyle: { borderRadius: '4px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' },
                }}
              />
            )}
          </div>
          {hasClocks && (
            <ClockPanel
              name={playerName}
              rating={null}
              clk={bottomClock}
            />
          )}
          <div className="viewer-controls">
            <button className="viewer-nav-btn" onClick={() => setPosIdx(0)} disabled={posIdx === 0} title="Start">⇤</button>
            <button className="viewer-nav-btn" onClick={prev} disabled={posIdx === 0} title="Previous (←)">‹</button>
            <span className="viewer-pos-label">{posIdx} / {totalPos - 1}</span>
            <button className="viewer-nav-btn" onClick={next} disabled={posIdx === totalPos - 1} title="Next (→)">›</button>
            <button className="viewer-nav-btn" onClick={() => setPosIdx(totalPos - 1)} disabled={posIdx === totalPos - 1} title="End">⇥</button>
          </div>
        </div>

        <ViewerMoveList
          moves={moves}
          fens={fens}
          posIdx={posIdx}
          onJump={setPosIdx}
          listRef={movelistRef}
        />
      </div>
    </div>
  );
}

// ── Account setup panel ───────────────────────────────────────────────────────

function AccountSetup({ userId, accounts, onAccountsChange }) {
  const [drafts, setDrafts] = useState({ lichess: accounts.lichess || '', 'chess.com': accounts['chess.com'] || '' });
  const [status, setStatus] = useState({ lichess: null, 'chess.com': null });
  const [progress, setProgress] = useState({ lichess: null, 'chess.com': null });

  async function handleImport(platform) {
    const username = drafts[platform].trim();
    if (!username) return;
    setStatus(s => ({ ...s, [platform]: 'importing' }));
    setProgress(p => ({ ...p, [platform]: { done: 0, total: null } }));
    try {
      const result = await importOnlineGames(userId, platform, username, {
        max: 5000,
        onProgress: (done, total) => setProgress(p => ({ ...p, [platform]: { done, total } })),
      });
      const newAccounts = { ...accounts, [platform]: username };
      saveStoredAccounts(newAccounts);
      onAccountsChange(newAccounts);
      setStatus(s => ({ ...s, [platform]: `Imported ${result.saved} games` }));
    } catch (err) {
      setStatus(s => ({ ...s, [platform]: `Error: ${err.message}` }));
    }
    setProgress(p => ({ ...p, [platform]: null }));
  }

  async function handleSync(platform) {
    const username = accounts[platform];
    if (!username) return;
    setStatus(s => ({ ...s, [platform]: 'syncing' }));
    setProgress(p => ({ ...p, [platform]: { done: 0, total: null } }));
    try {
      const since = await getLastPlayedAt(userId, platform, username);
      const result = await importOnlineGames(userId, platform, username, {
        max: 5000,
        since: since ? since + 1 : null,
        onProgress: (done, total) => setProgress(p => ({ ...p, [platform]: { done, total } })),
      });
      setStatus(s => ({ ...s, [platform]: `Synced ${result.saved} new games` }));
    } catch (err) {
      setStatus(s => ({ ...s, [platform]: `Error: ${err.message}` }));
    }
    setProgress(p => ({ ...p, [platform]: null }));
  }

  return (
    <div className="online-accounts">
      {PLATFORMS.map(({ id, label }) => {
        const isLinked = !!accounts[id];
        const isActive = status[id] === 'importing' || status[id] === 'syncing';
        const prog = progress[id];
        return (
          <div key={id} className="online-account-row">
            <span className="online-account-platform-label">
              <img src={PLATFORM_LOGO[id]} alt={label} className="online-platform-logo" />
              {label}
            </span>
            {isLinked ? (
              <>
                <span className="online-account-name">{accounts[id]}</span>
                <button
                  className="upload-btn"
                  onClick={() => handleSync(id)}
                  disabled={isActive}
                  style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                >
                  {status[id] === 'syncing' ? 'Syncing…' : 'Sync'}
                </button>
                <button
                  className="modal-cancel-btn"
                  onClick={() => {
                    const newAcc = { ...accounts };
                    delete newAcc[id];
                    saveStoredAccounts(newAcc);
                    onAccountsChange(newAcc);
                    setDrafts(d => ({ ...d, [id]: '' }));
                    setStatus(s => ({ ...s, [id]: null }));
                  }}
                  style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                >
                  Unlink
                </button>
              </>
            ) : (
              <>
                <input
                  className="games-search"
                  style={{ flex: 1, maxWidth: 200 }}
                  placeholder={`${label} username`}
                  value={drafts[id]}
                  onChange={e => setDrafts(d => ({ ...d, [id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleImport(id); }}
                  disabled={isActive}
                />
                <button
                  className="upload-btn"
                  onClick={() => handleImport(id)}
                  disabled={!drafts[id].trim() || isActive}
                  style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                >
                  {status[id] === 'importing' ? 'Importing…' : 'Import'}
                </button>
              </>
            )}
            {prog && (
              <span className="online-progress">
                {prog.total ? `${prog.done} / ${prog.total}` : `${prog.done} games…`}
              </span>
            )}
            {status[id] && status[id] !== 'importing' && status[id] !== 'syncing' && (
              <span className={`online-status ${status[id].startsWith('Error') ? 'online-status--error' : 'online-status--ok'}`}>
                {status[id]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Online Games section ─────────────────────────────────────────────────

export default function OnlineGamesSection({ userId }) {
  const [accounts, setAccounts] = useState(loadStoredAccounts);
  const [games, setGames] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterResult, setFilterResult] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterTC, setFilterTC] = useState('all');
  const [loading, setLoading] = useState(false);
  const [viewGame, setViewGame] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const searchTimeout = useRef(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasAccounts = !!(accounts.lichess || accounts['chess.com']);

  const loadGames = useCallback(async (p = 0, q = search, fr = filterResult, fp = filterPlatform, ftc = filterTC) => {
    if (!userId) return;
    setLoading(true);
    const r = await getOnlineGames(userId, { page: p, search: q, filterResult: fr, filterPlatform: fp, filterTC: ftc });
    setGames(r.games);
    setTotal(r.total);
    setLoading(false);
  }, [userId, search, filterResult, filterPlatform, filterTC]);

  useEffect(() => {
    if (userId) loadGames(0, search, filterResult, filterPlatform, filterTC);
    setPage(0);
  }, [userId, filterResult, filterPlatform, filterTC]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadGames(0, search, filterResult, filterPlatform, filterTC);
      setPage(0);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [search]);

  // Reload after import/sync
  function handleAccountsChange(newAccounts) {
    setAccounts(newAccounts);
    loadGames(0, search, filterResult, filterPlatform, filterTC);
    setPage(0);
  }

  async function handleOpenGame(gameId) {
    setViewLoading(true);
    try {
      const pgn = await getOnlineGamePgn(gameId);
      const replayData = pgnToReplayData(pgn);
      if (!replayData || replayData.fens.length < 2) {
        alert("Could not parse this game's PGN.");
        return;
      }
      const game = games.find(g => g.id === gameId);
      setViewGame({ game, replayData });
    } catch {
      alert('Failed to load game.');
    } finally {
      setViewLoading(false);
    }
  }

  function handlePageChange(newPage) {
    setPage(newPage);
    loadGames(newPage, search, filterResult, filterPlatform, filterTC);
  }

  if (viewGame) {
    return (
      <div className="game-viewer-wrap">
        <OnlineGameViewer
          game={viewGame.game}
          replayData={viewGame.replayData}
          onBack={() => setViewGame(null)}
        />
      </div>
    );
  }

  const hasGames = total > 0 || loading;

  return (
    <div className="games-screen">
      <AccountSetup userId={userId} accounts={accounts} onAccountsChange={handleAccountsChange} />

      {(hasGames || search) && (
        <>
          <div className="games-toolbar">
            <input
              className="games-search"
              placeholder="Search by opponent or opening…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="online-filter-row">
            <div className="online-filter-group">
              <span className="online-filter-label">Result</span>
              <div className="games-filter-tabs">
                {['all', 'win', 'loss', 'draw'].map(f => (
                  <button
                    key={f}
                    className={`games-filter-tab${filterResult === f ? ' games-filter-tab--active' : ''}`}
                    onClick={() => setFilterResult(f)}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="online-filter-group">
              <span className="online-filter-label">Time</span>
              <div className="games-filter-tabs">
                {['all', 'bullet', 'blitz', 'rapid', 'classical'].map(f => (
                  <button
                    key={f}
                    className={`games-filter-tab${filterTC === f ? ' games-filter-tab--active' : ''}`}
                    onClick={() => setFilterTC(f)}
                  >
                    {f === 'all' ? 'All' : TC_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
            <div className="online-filter-group">
              <span className="online-filter-label">Platform</span>
              <div className="games-filter-tabs">
                {['all', 'lichess', 'chess.com'].map(f => (
                  <button
                    key={f}
                    className={`games-filter-tab${filterPlatform === f ? ' games-filter-tab--active' : ''}`}
                    onClick={() => setFilterPlatform(f)}
                  >
                    {f === 'all' ? 'All' : f === 'lichess' ? 'Lichess' : 'Chess.com'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {viewLoading && <p className="study-loading">Loading game…</p>}

      {loading ? (
        <p className="study-loading">Loading…</p>
      ) : games.length === 0 ? (
        <div className="games-empty">
          <p>
            {search || filterResult !== 'all' || filterTC !== 'all' || filterPlatform !== 'all'
              ? 'No games match your filters.'
              : 'No games yet. Import from Lichess or Chess.com above.'}
          </p>
        </div>
      ) : (
        <>
          <div className="games-list">
            {games.map(game => (
              <OnlineGameRow key={game.id} game={game} onOpen={handleOpenGame} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="games-pagination">
              <button className="page-btn" onClick={() => handlePageChange(page - 1)} disabled={page === 0}>‹ Prev</button>
              <span className="page-label">Page {page + 1} of {totalPages}</span>
              <button className="page-btn" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages - 1}>Next ›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
