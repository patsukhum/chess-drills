import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { getGames, getGamePgn, saveGame, importGames, deleteGame, updateGameTags, updateGameName } from '../logic/games.js';
import { pgnToReplayData, splitPgn } from '../logic/pgn.js';

const PAGE_SIZE = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

function ResultBadge({ result }) {
  if (!result) return null;
  const cfg = { win: ['W', '#2d7d2d'], loss: ['L', '#aa2222'], draw: ['D', '#666'] };
  const [label, bg] = cfg[result] || ['?', '#555'];
  return <span className="result-badge" style={{ background: bg }}>{label}</span>;
}

function TagBadge({ label, onRemove }) {
  return (
    <span className="tag-badge">
      {label}
      {onRemove && (
        <button className="tag-badge-remove" onClick={onRemove} title="Remove tag">×</button>
      )}
    </span>
  );
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

function GameViewer({ game, replayData, onBack, onDelete, onUpdateTags, onUpdateName }) {
  const [posIdx, setPosIdx] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(game.name);
  const [newTag, setNewTag] = useState('');
  const movelistRef = useRef(null);
  const boardWrapRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(400);

  const { fens, moves, introComment } = replayData;
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

  function handleSaveName() {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== game.name) onUpdateName(game.id, trimmed);
    setEditingName(false);
  }

  function handleAddTag(e) {
    e.preventDefault();
    const tag = newTag.trim();
    if (!tag || game.tags.includes(tag)) { setNewTag(''); return; }
    onUpdateTags(game.id, [...game.tags, tag]);
    setNewTag('');
  }

  function handleRemoveTag(tag) {
    onUpdateTags(game.id, game.tags.filter(t => t !== tag));
  }

  const autoTags = [
    game.opening && { key: 'opening', label: game.opening },
    game.eco && { key: 'eco', label: game.eco },
    game.opponent && { key: 'opponent', label: `vs ${game.opponent}` },
    game.time_control && { key: 'tc', label: game.time_control },
    game.game_date && { key: 'date', label: game.game_date.replace(/\./g, '-') },
  ].filter(Boolean);

  return (
    <div className="game-viewer-screen">
      <div className="game-viewer-nav">
        <button className="back-btn" onClick={onBack}>← Games</button>
        {editingName ? (
          <input
            className="game-name-input"
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setNameVal(game.name); setEditingName(false); } }}
            autoFocus
            maxLength={80}
          />
        ) : (
          <button className="game-name-title" onClick={() => setEditingName(true)} title="Click to rename">
            {game.name}
          </button>
        )}
        <button className="viewer-delete-btn" onClick={() => onDelete(game.id)} title="Delete game">✕</button>
      </div>

      <div className="viewer-tags">
        <ResultBadge result={game.result} />
        {autoTags.map(t => <TagBadge key={t.key} label={t.label} />)}
        {game.tags.map(t => <TagBadge key={t} label={t} onRemove={() => handleRemoveTag(t)} />)}
        {introComment && (
          <span className="viewer-intro-comment">{introComment}</span>
        )}
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

          <form className="viewer-tag-form" onSubmit={handleAddTag}>
            <input
              className="viewer-tag-input"
              placeholder="Add tag…"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              maxLength={30}
            />
            <button className="viewer-tag-add-btn" type="submit" disabled={!newTag.trim()}>Add</button>
          </form>
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

// ── Game row ──────────────────────────────────────────────────────────────────

function GameRow({ game, onOpen, onDelete }) {
  return (
    <div className="game-row">
      <ResultBadge result={game.result} />
      <div className="game-row-body" onClick={() => onOpen(game.id)}>
        <div className="game-row-main">
          <span className="game-row-name">{game.name}</span>
          {game.opening && <span className="game-row-opening">{game.opening}</span>}
        </div>
        <div className="game-row-meta">
          {game.game_date && <span>{game.game_date.replace(/\./g, '-')}</span>}
          {game.time_control && <span>{game.time_control}</span>}
          {game.tags.map(t => <TagBadge key={t} label={t} />)}
        </div>
      </div>
      <button className="game-row-delete" onClick={() => onDelete(game.id)} title="Delete">✕</button>
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
  const [viewGame, setViewGame] = useState(null);   // { game, replayData }
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
  }, [filterResult]);

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
    const added = [];
    for (const part of parts) {
      const g = await saveGame(userId, part, playerName);
      added.push(g);
    }
    // Reload first page
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

  async function handleUpdateTags(gameId, tags) {
    await updateGameTags(gameId, tags);
    setViewGame(prev => prev ? { ...prev, game: { ...prev.game, tags } } : prev);
    setGames(gs => gs.map(g => g.id === gameId ? { ...g, tags } : g));
  }

  async function handleUpdateName(gameId, name) {
    await updateGameName(gameId, name);
    setViewGame(prev => prev ? { ...prev, game: { ...prev.game, name } } : prev);
    setGames(gs => gs.map(g => g.id === gameId ? { ...g, name } : g));
  }

  if (viewGame) {
    return (
      <div className="game-viewer-wrap">
        <GameViewer
          game={viewGame.game}
          replayData={viewGame.replayData}
          onBack={() => setViewGame(null)}
          onDelete={handleDelete}
          onUpdateTags={handleUpdateTags}
          onUpdateName={handleUpdateName}
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
