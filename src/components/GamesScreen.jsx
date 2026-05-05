import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { getGames, getGamePgn, saveGame, deleteGame, updateGameField } from '../logic/games.js';
import { pgnToReplayData, splitPgn, parseChapterNameMeta } from '../logic/pgn.js';

const PAGE_SIZE = 20;

const PHASE_OPTIONS = [
  { value: 'opening',          label: 'Opening' },
  { value: 'early_middlegame', label: 'Early Middlegame' },
  { value: 'middlegame',       label: 'Middlegame' },
  { value: 'late_middlegame',  label: 'Late Middlegame' },
  { value: 'endgame',          label: 'Endgame' },
];

function phaseLabel(value) {
  return PHASE_OPTIONS.find(o => o.value === value)?.label || '';
}

// ── Move list (viewer / read-only + clickable) ────────────────────────────────

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
          white: { idx: i, san: moves[i].san, comment: moves[i].comment },
          black: i + 1 < moves.length ? { idx: i + 1, san: moves[i + 1].san, comment: moves[i + 1].comment } : null,
        });
        i += i + 1 < moves.length ? 2 : 1;
      } else {
        result.push({
          moveNum,
          white: null,
          black: { idx: i, san: moves[i].san, comment: moves[i].comment },
        });
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
      {rows.map((row, ri) => {
        const wActive = row.white !== null && row.white.idx === activeIdx;
        const bActive = row.black !== null && row.black.idx === activeIdx;
        const annotations = [];
        if (row.white?.comment) annotations.push(row.white.comment);
        if (row.black?.comment) annotations.push(row.black.comment);

        return (
          <div key={ri} className="movelist-row-group">
            <div className="movelist-row">
              <span className="movelist-num">{row.moveNum}.</span>
              {row.white ? (
                <button
                  className={`movelist-cell movelist-cell--btn${wActive ? ' movelist-cell--active' : ''}`}
                  onClick={() => onJump(row.white.idx + 1)}
                >
                  {row.white.san}
                </button>
              ) : (
                <span className="movelist-cell movelist-cell--placeholder">…</span>
              )}
              {row.black ? (
                <button
                  className={`movelist-cell movelist-cell--btn${bActive ? ' movelist-cell--active' : ''}`}
                  onClick={() => onJump(row.black.idx + 1)}
                >
                  {row.black.san}
                </button>
              ) : (
                <span className="movelist-cell" />
              )}
            </div>
            {annotations.map((text, ai) => (
              <p key={ai} className="movelist-annotation">{text}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Game viewer ───────────────────────────────────────────────────────────────

function GameViewer({ game, replayData, onBack, onDelete, onUpdateField }) {
  const [posIdx, setPosIdx] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(game.name);
  const movelistRef = useRef(null);
  const boardWrapRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(400);

  // Local copies of editable fields (auto-save on blur)
  const [opening, setOpening] = useState(game.opening || '');
  const [oppRating, setOppRating] = useState(game.opponent_rating?.toString() || '');
  const [phase, setPhase] = useState(game.phase || '');
  const [notes, setNotes] = useState(game.notes || '');
  const [result, setResult] = useState(game.result || '');
  const [playerColor, setPlayerColor] = useState(game.player_color || '');

  const { fens, moves, introComment } = replayData;
  const totalPos = fens.length;

  const prev = useCallback(() => setPosIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setPosIdx(i => Math.min(totalPos - 1, i + 1)), [totalPos]);

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
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

  function saveName() {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== game.name) onUpdateField(game.id, { name: trimmed });
    setEditingName(false);
  }

  function saveOpening() {
    const val = opening.trim() || null;
    if (val !== (game.opening || null)) onUpdateField(game.id, { opening: val });
  }

  function saveOppRating() {
    const val = oppRating.trim() ? parseInt(oppRating) || null : null;
    if (val !== (game.opponent_rating || null)) onUpdateField(game.id, { opponent_rating: val });
  }

  function savePhase(val) {
    setPhase(val);
    onUpdateField(game.id, { phase: val || null });
  }

  function saveNotes() {
    const val = notes.trim() || null;
    if (val !== (game.notes || null)) onUpdateField(game.id, { notes: val });
  }

  function saveResult(val) {
    setResult(val);
    onUpdateField(game.id, { result: val || null });
  }

  function savePlayerColor(val) {
    setPlayerColor(val);
    onUpdateField(game.id, { player_color: val || null });
  }

  const colorCircle = playerColor === 'white' ? '⚪' : playerColor === 'black' ? '⚫' : null;

  return (
    <div className="game-viewer-screen">
      <div className="game-viewer-nav">
        <button className="back-btn" onClick={onBack}>← Games</button>
        <div className="game-viewer-title-row">
          {colorCircle && <span className="viewer-color-circle">{colorCircle}</span>}
          {editingName ? (
            <input
              className="game-name-input"
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameVal(game.name); setEditingName(false); } }}
              autoFocus
              maxLength={80}
            />
          ) : (
            <button className="game-name-title" onClick={() => setEditingName(true)} title="Click to rename">
              {game.name}
            </button>
          )}
        </div>
        <button className="viewer-delete-btn" onClick={() => onDelete(game.id)} title="Delete game">✕</button>
      </div>

      <div className="study-practice-layout">
        <div className="study-practice-left">
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

      {introComment && (
        <p className="viewer-intro-comment">{introComment}</p>
      )}

      <div className="game-details-panel">
        <div className="game-details-grid">
          <div className="game-detail-field">
            <label className="game-detail-label">Opening</label>
            <input
              className="game-detail-input"
              value={opening}
              onChange={e => setOpening(e.target.value)}
              onBlur={saveOpening}
              placeholder="e.g. Sicilian Defense"
              maxLength={80}
            />
          </div>
          <div className="game-detail-field">
            <label className="game-detail-label">Result</label>
            <div className="detail-toggle-group">
              {[['win','Win'],['draw','Draw'],['loss','Loss']].map(([v,l]) => (
                <button
                  key={v}
                  className={`detail-toggle detail-toggle--${v}${result === v ? ' detail-toggle--active' : ''}`}
                  onClick={() => saveResult(result === v ? '' : v)}
                  type="button"
                >{l}</button>
              ))}
            </div>
          </div>
          <div className="game-detail-field">
            <label className="game-detail-label">Played as</label>
            <div className="detail-toggle-group">
              {[['white','⚪ White'],['black','⚫ Black']].map(([v,l]) => (
                <button
                  key={v}
                  className={`detail-toggle${playerColor === v ? ' detail-toggle--active' : ''}`}
                  onClick={() => savePlayerColor(playerColor === v ? '' : v)}
                  type="button"
                >{l}</button>
              ))}
            </div>
          </div>
          <div className="game-detail-field">
            <label className="game-detail-label">Opponent Rating</label>
            <input
              className="game-detail-input"
              type="number"
              value={oppRating}
              onChange={e => setOppRating(e.target.value)}
              onBlur={saveOppRating}
              placeholder="e.g. 1850"
              min={0}
              max={3500}
            />
          </div>
          <div className="game-detail-field">
            <label className="game-detail-label">Decisive Phase</label>
            <select
              className="game-detail-select"
              value={phase}
              onChange={e => savePhase(e.target.value)}
            >
              <option value="">— not set —</option>
              {PHASE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="game-detail-field game-detail-field--full">
            <label className="game-detail-label">What happened?</label>
            <textarea
              className="game-detail-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder="e.g. Missed tactic in the middlegame, got outplayed positionally…"
              rows={3}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add game modal ────────────────────────────────────────────────────────────

function AddGameModal({ onAdd, onClose }) {
  const [pgn, setPgn] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = pgn.trim();
    if (!trimmed) return;
    setSaving(true);
    setError('');
    try {
      await onAdd(trimmed);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save. Check the PGN and try again.');
    }
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">Add Game(s)</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="modal-hint">Paste a single game or a multi-game PGN. Each game becomes a separate entry.</p>
        <form onSubmit={handleSubmit}>
          <textarea
            className="pgn-textarea"
            placeholder="[Event &quot;...&quot;]&#10;[White &quot;...&quot;]&#10;...&#10;1. e4 e5 ..."
            value={pgn}
            onChange={e => setPgn(e.target.value)}
            rows={10}
            autoFocus
          />
          {error && <p className="study-error">{error}</p>}
          <div className="modal-footer">
            <button type="button" className="modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button className="upload-btn" type="submit" disabled={!pgn.trim() || saving}>
              {saving ? 'Saving…' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Game row (single line) ────────────────────────────────────────────────────

function GameRow({ game, onOpen, onDelete }) {
  const colorCircle = game.player_color === 'white' ? '⚪' : game.player_color === 'black' ? '⚫' : null;
  const resultClass = game.result ? `game-row--${game.result}` : '';

  return (
    <div className={`game-row ${resultClass}`}>
      <div className="game-row-body" onClick={() => onOpen(game.id)}>
        {colorCircle && <span className="game-row-color">{colorCircle}</span>}
        <span className="game-row-name">
          {game.opponent || game.name}
          {game.opponent_rating ? <span className="game-row-rating"> ({game.opponent_rating})</span> : null}
        </span>
        <div className="game-row-chips">
          {game.opening && <span className="game-row-chip">{game.opening}</span>}
          {game.time_control && <span className="game-row-chip game-row-chip--muted">{game.time_control}</span>}
          {game.phase && <span className="game-row-chip game-row-chip--phase">{phaseLabel(game.phase)}</span>}
        </div>
      </div>
      <button className="game-row-delete" onClick={e => { e.stopPropagation(); onDelete(game.id); }} title="Delete">✕</button>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function GamesScreen({ userId, playerName, onBack }) {
  const [games, setGames] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterResult, setFilterResult] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [viewGame, setViewGame] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const searchTimeout = useRef(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  async function loadGames(p = page, q = search, f = filterResult) {
    setLoading(true);
    const result = await getGames(userId, { page: p, search: q, filterResult: f });
    setGames(result.games);
    setTotal(result.total);
    setLoading(false);
  }

  useEffect(() => {
    loadGames(0, search, filterResult);
    setPage(0);
  }, [filterResult, userId]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadGames(0, search, filterResult);
      setPage(0);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [search]);

  function handlePageChange(newPage) {
    setPage(newPage);
    loadGames(newPage, search, filterResult);
  }

  async function handleOpenGame(gameId) {
    setViewLoading(true);
    try {
      const pgn = await getGamePgn(gameId);
      const replayData = pgnToReplayData(pgn);
      if (!replayData || replayData.fens.length < 2) {
        alert('Could not parse this game\'s PGN.');
        return;
      }
      const game = games.find(g => g.id === gameId);
      setViewGame({ game: { ...game, pgn }, replayData });
    } catch {
      alert('Failed to load game.');
    } finally {
      setViewLoading(false);
    }
  }

  async function handleAdd(pgn) {
    const parts = splitPgn(pgn);
    let lastTimeControl = null;
    for (const part of parts) {
      const cnMatch = part.match(/\[ChapterName\s+"([^"]+)"\]/);
      const chapterName = cnMatch ? cnMatch[1] : '';
      const cm = parseChapterNameMeta(chapterName);
      // New section header resets or updates the propagated time control
      if (/\(/.test(chapterName.replace(/^\*+/, ''))) {
        lastTimeControl = cm.time_control; // null if section has no TC (e.g. U2000 MA)
      } else if (cm.time_control) {
        lastTimeControl = cm.time_control;
      }
      // Pass propagated TC only when the chapter itself doesn't encode one
      const overrides = (!cm.time_control && lastTimeControl) ? { time_control: lastTimeControl } : {};
      await saveGame(userId, part, playerName, overrides);
    }
    setPage(0);
    setSearch('');
    setFilterResult('all');
    await loadGames(0, '', 'all');
  }

  async function handleDelete(gameId) {
    if (!confirm('Delete this game?')) return;
    await deleteGame(gameId);
    if (viewGame?.game.id === gameId) setViewGame(null);
    loadGames(page, search, filterResult);
  }

  async function handleUpdateField(gameId, fields) {
    await updateGameField(gameId, fields);
    setViewGame(prev => prev ? { ...prev, game: { ...prev.game, ...fields } } : prev);
    setGames(gs => gs.map(g => g.id === gameId ? { ...g, ...fields } : g));
  }

  if (viewGame) {
    return (
      <div className="game-viewer-wrap">
        <GameViewer
          game={viewGame.game}
          replayData={viewGame.replayData}
          onBack={() => setViewGame(null)}
          onDelete={handleDelete}
          onUpdateField={handleUpdateField}
        />
      </div>
    );
  }

  return (
    <div className="games-screen">
      <div className="games-nav">
        <button className="back-btn" onClick={onBack}>← Home</button>
        <h2 className="study-title">My Games</h2>
        <button className="upload-btn" onClick={() => setShowAdd(true)}>+ Add Games</button>
      </div>

      <div className="games-toolbar">
        <input
          className="games-search"
          placeholder="Search by name, opening, opponent…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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

      {viewLoading && <p className="study-loading">Loading game…</p>}

      {loading ? (
        <p className="study-loading">Loading…</p>
      ) : games.length === 0 ? (
        <div className="games-empty">
          {total === 0 && !search && filterResult === 'all'
            ? <p>No games yet. Add your first game above!</p>
            : <p>No games match your search.</p>
          }
        </div>
      ) : (
        <div className="games-list">
          {games.map(game => (
            <GameRow
              key={game.id}
              game={game}
              onOpen={handleOpenGame}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="games-pagination">
          <button className="page-btn" onClick={() => handlePageChange(page - 1)} disabled={page === 0}>‹ Prev</button>
          <span className="page-label">Page {page + 1} of {totalPages}</span>
          <button className="page-btn" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages - 1}>Next ›</button>
        </div>
      )}

      {showAdd && <AddGameModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
