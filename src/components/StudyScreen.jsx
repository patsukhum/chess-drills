import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { getStudies, saveStudy, getStudyPgn, deleteStudy } from '../logic/study.js';
import { pgnToChapters } from '../logic/pgn.js';

// ── Study list + upload ──────────────────────────────────────────────────────

function StudyList({ studies, onUpload, onPractice, onDelete, onBack }) {
  const [name, setName] = useState('');
  const [pgn, setPgn] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload() {
    if (!name.trim() || !pgn.trim()) return;
    setUploading(true);
    setError('');
    try {
      await onUpload(name.trim(), pgn.trim());
      setName('');
      setPgn('');
    } catch {
      setError('Failed to save study. Please try again.');
    }
    setUploading(false);
  }

  return (
    <div className="study-screen">
      <div className="study-nav">
        <button className="back-btn" onClick={onBack}><span className="back-btn-icon">‹</span>Home</button>
        <h2 className="study-title">My Studies</h2>
      </div>

      <div className="study-upload-card">
        <h3 className="study-section-heading">Upload Study</h3>
        <input
          className="study-name-input"
          placeholder="Study name"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={60}
        />
        <textarea
          className="pgn-textarea"
          placeholder="Paste PGN here…"
          value={pgn}
          onChange={e => setPgn(e.target.value)}
          rows={6}
        />
        {error && <p className="study-error">{error}</p>}
        <button
          className="upload-btn"
          onClick={handleUpload}
          disabled={!name.trim() || !pgn.trim() || uploading}
        >
          {uploading ? 'Saving…' : 'Save Study'}
        </button>
      </div>

      {studies.length > 0 ? (
        <div className="study-list">
          {studies.map(study => (
            <div key={study.id} className="study-row">
              <span className="study-row-name">{study.name}</span>
              <div className="study-row-actions">
                <button className="practice-btn" onClick={() => onPractice(study.id)}>
                  Practice
                </button>
                <button className="delete-study-btn" onClick={() => onDelete(study.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-studies">No studies yet. Upload a PGN above to get started.</p>
      )}
    </div>
  );
}

// ── Chapter selection ────────────────────────────────────────────────────────

function StudyChapterSelect({ chapters, onSelect, onBack }) {
  return (
    <div className="study-screen">
      <div className="study-nav">
        <button className="back-btn" onClick={onBack}><span className="back-btn-icon">‹</span>Studies</button>
        <h2 className="study-title">Chapters</h2>
      </div>
      <div className="study-list">
        {chapters.map((ch, i) => (
          <div key={i} className="study-row">
            <span className="study-row-name">{ch.name || `Chapter ${i + 1}`}</span>
            <button className="practice-btn" onClick={() => onSelect(i)}>Practice</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Move list (Lichess-style) ─────────────────────────────────────────────────

function MoveList({ positions, logCount, introComment, movelistRef }) {
  const activeIdx = logCount - 1;

  // Group positions into rows: { moveNum, white: {idx,san,comment}|null, black: {idx,san,comment}|null }
  // white===null means the chapter starts on black's move (show "…" placeholder)
  const rows = useMemo(() => {
    const result = [];
    let i = 0;
    while (i < positions.length) {
      const fenParts = positions[i].fen.split(' ');
      const moveNum = parseInt(fenParts[5]);
      const turn = fenParts[1];

      if (turn === 'w') {
        const wi = i;
        const bi = i + 1 < positions.length ? i + 1 : null;
        result.push({
          moveNum,
          white: { idx: wi, san: positions[wi].san, comment: positions[wi].comment },
          black: bi !== null ? { idx: bi, san: positions[bi].san, comment: positions[bi].comment } : null,
        });
        i += bi !== null ? 2 : 1;
      } else {
        result.push({
          moveNum,
          white: null,
          black: { idx: i, san: positions[i].san, comment: positions[i].comment },
        });
        i++;
      }
    }
    return result;
  }, [positions]);

  // Auto-scroll to the active move cell
  useEffect(() => {
    if (!movelistRef.current || activeIdx < 0) return;
    const el = movelistRef.current.querySelector('.movelist-cell--active');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [logCount]);

  return (
    <div className="study-movelist" ref={movelistRef}>
      {rows.map((row, ri) => {
        const wPlayed = row.white !== null && row.white.idx < logCount;
        const bPlayed = row.black !== null && row.black.idx < logCount;
        // Hide rows where nothing has been played yet
        if (!wPlayed && !bPlayed) return null;

        const wActive = row.white !== null && row.white.idx === activeIdx;
        const bActive = row.black !== null && row.black.idx === activeIdx;

        // Collect annotations to show below this row
        const annotations = [];
        if (ri === 0 && introComment && logCount > 0) {
          annotations.push(introComment);
        }
        if (wPlayed && row.white.comment) annotations.push(row.white.comment);
        if (bPlayed && row.black.comment) annotations.push(row.black.comment);

        return (
          <div key={ri} className="movelist-row-group">
            <div className="movelist-row">
              <span className="movelist-num">{row.moveNum}.</span>
              <span className={`movelist-cell${wActive ? ' movelist-cell--active' : ''}${row.white === null ? ' movelist-cell--placeholder' : ''}`}>
                {row.white === null ? '…' : (wPlayed ? row.white.san : '')}
              </span>
              <span className={`movelist-cell${bActive ? ' movelist-cell--active' : ''}`}>
                {bPlayed ? row.black.san : ''}
              </span>
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

// ── Practice ─────────────────────────────────────────────────────────────────

function StudyPractice({ chapter, onBack, onNext }) {
  const { positions, introComment, name } = chapter;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalDests, setLegalDests] = useState([]);
  const [feedback, setFeedback] = useState(null); // null | 'correct' | 'wrong'
  const [wrongSquare, setWrongSquare] = useState(null);
  const [showSolution, setShowSolution] = useState(false);
  const [logCount, setLogCount] = useState(0);

  const movelistRef = useRef(null);
  const boardWrapRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(400);

  const isDone = currentIdx >= positions.length;
  const current = isDone ? null : positions[currentIdx];

  const userColor = useMemo(() => {
    if (!positions.length) return 'w';
    const c = new Chess();
    c.load(positions[0].fen);
    return c.turn();
  }, [positions]);

  // Measure board wrap synchronously before first paint, then track resizes
  // Re-runs on isDone change because the board wrap DOM element is replaced
  useLayoutEffect(() => {
    if (boardWrapRef.current) {
      setBoardWidth(boardWrapRef.current.offsetWidth || 400);
    }
  }, [isDone]);

  useEffect(() => {
    if (!boardWrapRef.current) return;
    const obs = new ResizeObserver(entries => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) setBoardWidth(w);
    });
    obs.observe(boardWrapRef.current);
    return () => obs.disconnect();
  }, [isDone]);

  const chess = useMemo(() => {
    if (!current) return null;
    const c = new Chess();
    c.load(current.fen);
    return c;
  }, [current?.fen]);

  // FEN of the board after the last move — shown on the chapter complete screen
  const finalFen = useMemo(() => {
    if (!positions.length) return null;
    const last = positions[positions.length - 1];
    try {
      const c = new Chess();
      c.load(last.fen);
      c.move({ from: last.from, to: last.to, ...(last.promotion ? { promotion: last.promotion } : {}) });
      return c.fen();
    } catch {
      return last.fen;
    }
  }, [positions]);

  const orientation = userColor === 'b' ? 'black' : 'white';
  const isComputerTurn = !isDone && chess?.turn() !== userColor;

  // Auto-play computer move
  useEffect(() => {
    if (!isComputerTurn || isDone) return;
    const timer = setTimeout(() => {
      setLogCount(c => c + 1);
      setCurrentIdx(i => i + 1);
      setSelectedSquare(null);
      setLegalDests([]);
      setFeedback(null);
      setShowSolution(false);
      setWrongSquare(null);
    }, 800);
    return () => clearTimeout(timer);
  }, [currentIdx, isComputerTurn, isDone]);

  // Show-solution path: advance without requiring correct click
  const advance = useCallback(() => {
    setLogCount(c => c + 1);
    setCurrentIdx(i => i + 1);
    setSelectedSquare(null);
    setLegalDests([]);
    setFeedback(null);
    setShowSolution(false);
    setWrongSquare(null);
  }, []);

  // Drag-and-drop: correct move advances immediately (no snap-back), wrong snaps back
  const handlePieceDrop = useCallback(({ sourceSquare, targetSquare }) => {
    if (!chess || !current || isComputerTurn || showSolution || feedback === 'correct') return false;
    const piece = chess.get(sourceSquare);
    if (!piece || piece.color !== chess.turn()) return false;
    const legalMoves = chess.moves({ square: sourceSquare, verbose: true });
    if (!legalMoves.find(m => m.to === targetSquare)) return false;

    if (sourceSquare === current.from && targetSquare === current.to) {
      setSelectedSquare(null);
      setLegalDests([]);
      setLogCount(c => c + 1);
      setCurrentIdx(i => i + 1);
      setFeedback(null);
      setShowSolution(false);
      setWrongSquare(null);
      return true;
    } else {
      setFeedback('wrong');
      setWrongSquare(targetSquare);
      setSelectedSquare(null);
      setLegalDests([]);
      setTimeout(() => { setFeedback(null); setWrongSquare(null); }, 700);
      return false;
    }
  }, [chess, current, isComputerTurn, showSolution, feedback]);

  const handleSquareClick = useCallback(({ square }) => {
    if (!chess || !current || isComputerTurn || showSolution || feedback === 'correct') return;

    const piece = chess.get(square);
    const isMyPiece = piece && piece.color === chess.turn();

    if (selectedSquare) {
      if (square === selectedSquare) {
        setSelectedSquare(null);
        setLegalDests([]);
        return;
      }

      if (legalDests.includes(square)) {
        if (selectedSquare === current.from && square === current.to) {
          setFeedback('correct');
          setSelectedSquare(null);
          setLegalDests([]);
          setTimeout(() => {
            setLogCount(c => c + 1);
            setCurrentIdx(i => i + 1);
            setFeedback(null);
            setShowSolution(false);
            setWrongSquare(null);
          }, 600);
        } else {
          setFeedback('wrong');
          setWrongSquare(square);
          setSelectedSquare(null);
          setLegalDests([]);
          setTimeout(() => { setFeedback(null); setWrongSquare(null); }, 700);
        }
        return;
      }

      if (isMyPiece) {
        const moves = chess.moves({ square, verbose: true });
        setSelectedSquare(square);
        setLegalDests(moves.map(m => m.to));
        return;
      }

      setSelectedSquare(null);
      setLegalDests([]);
      return;
    }

    if (isMyPiece) {
      const moves = chess.moves({ square, verbose: true });
      setSelectedSquare(square);
      setLegalDests(moves.map(m => m.to));
    }
  }, [chess, current, isComputerTurn, selectedSquare, legalDests, showSolution, feedback]);

  const squareStyles = useMemo(() => {
    const styles = {};
    if (selectedSquare) {
      styles[selectedSquare] = { background: 'rgba(255, 215, 0, 0.5)' };
      for (const sq of legalDests) {
        styles[sq] = chess?.get(sq)
          ? { boxShadow: 'inset 0 0 0 3px rgba(255,215,0,0.7)' }
          : { background: 'radial-gradient(circle, rgba(0,0,0,0.18) 30%, transparent 31%)' };
      }
    }
    if (showSolution && current) {
      styles[current.from] = { background: 'rgba(100, 149, 237, 0.55)' };
      styles[current.to] = { background: 'rgba(100, 149, 237, 0.55)' };
    }
    if (wrongSquare) {
      styles[wrongSquare] = { background: 'rgba(220, 50, 50, 0.55)' };
    }
    if (feedback === 'correct' && current) {
      styles[current.from] = { background: 'rgba(50, 200, 80, 0.55)' };
      styles[current.to] = { background: 'rgba(50, 200, 80, 0.55)' };
    }
    return styles;
  }, [selectedSquare, legalDests, showSolution, wrongSquare, feedback, current, chess]);

  const moveList = (
    <MoveList
      positions={positions}
      logCount={logCount}
      introComment={introComment}
      movelistRef={movelistRef}
    />
  );

  if (isDone) {
    return (
      <div className="study-practice">
        <div className="study-nav">
          <button className="back-btn" onClick={onBack}><span className="back-btn-icon">‹</span>Chapters</button>
          <span className="study-chapter-name">{name}</span>
        </div>
        <div className="study-practice-layout">
          <div className="study-practice-left">
            <div className="study-board-wrap" ref={boardWrapRef}>
              {boardWidth > 0 && finalFen && (
                <Chessboard
                  options={{
                    position: finalFen,
                    boardOrientation: orientation,
                    allowDragging: false,
                    boardWidth: boardWidth,
                    animationDurationInMs: 0,
                    boardStyle: { borderRadius: '4px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' },
                  }}
                />
              )}
            </div>
            <div className="study-complete-card">
              <div className="study-complete-icon">✓</div>
              <h2>Chapter Complete!</h2>
              {onNext ? (
                <button className="next-btn" onClick={onNext}>Next Chapter →</button>
              ) : (
                <button className="practice-btn" onClick={onBack}>Back to Chapters</button>
              )}
            </div>
          </div>
          {moveList}
        </div>
      </div>
    );
  }

  return (
    <div className="study-practice">
      <div className="study-nav">
        <button className="back-btn" onClick={onBack}>← Chapters</button>
        <span className="study-chapter-name">{name}</span>
        <span className="study-progress">{currentIdx + 1} / {positions.length}</span>
      </div>

      <div className="study-practice-layout">
        <div className="study-practice-left">
          <div className="study-board-wrap" ref={boardWrapRef}>
            {boardWidth > 0 && (
              <Chessboard
                options={{
                  position: current.fen,
                  boardOrientation: orientation,
                  onSquareClick: handleSquareClick,
                  onPieceDrop: handlePieceDrop,
                  squareStyles: squareStyles,
                  allowDragging: true,
                  boardWidth: boardWidth,
                  animationDurationInMs: 250,
                  boardStyle: { borderRadius: '4px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' },
                }}
              />
            )}
          </div>

          <div className="study-controls">
            {isComputerTurn ? (
              <p className="study-computer-thinking">…</p>
            ) : (
              <>
                {feedback === 'wrong' && (
                  <p className="study-feedback study-feedback--wrong">Wrong — try again</p>
                )}
                {!showSolution ? (
                  <button className="show-solution-btn" onClick={() => setShowSolution(true)}>
                    Show Solution
                  </button>
                ) : (
                  <div className="solution-bar">
                    <span className="solution-move">{current.san}</span>
                    <button className="next-btn" onClick={advance}>Next →</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {moveList}
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function StudyScreen({ userId, onBack }) {
  const [view, setView] = useState('list'); // 'list' | 'chapters' | 'practice'
  const [studies, setStudies] = useState([]);
  const [chapters, setChapters] = useState(null);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStudies(userId).then(setStudies);
  }, [userId]);

  async function handleUpload(name, pgn) {
    const study = await saveStudy(userId, name, pgn);
    setStudies(prev => [study, ...prev]);
  }

  async function handlePractice(studyId) {
    setLoading(true);
    try {
      const { pgn } = await getStudyPgn(studyId);
      setChapters(pgnToChapters(pgn));
      setChapterIdx(0);
      setView('chapters');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(studyId) {
    await deleteStudy(studyId);
    setStudies(prev => prev.filter(s => s.id !== studyId));
  }

  function handleSelectChapter(idx) {
    setChapterIdx(idx);
    setView('practice');
  }

  function handleNextChapter() {
    if (chapterIdx + 1 < chapters.length) {
      setChapterIdx(i => i + 1);
    } else {
      setView('chapters');
    }
  }

  if (loading) {
    return (
      <div className="study-screen">
        <p className="study-loading">Loading study…</p>
      </div>
    );
  }

  if (view === 'practice' && chapters) {
    return (
      <StudyPractice
        key={chapterIdx}
        chapter={chapters[chapterIdx]}
        onBack={() => setView('chapters')}
        onNext={chapterIdx + 1 < chapters.length ? handleNextChapter : null}
      />
    );
  }

  if (view === 'chapters' && chapters) {
    return (
      <StudyChapterSelect
        chapters={chapters}
        onSelect={handleSelectChapter}
        onBack={() => { setView('list'); setChapters(null); }}
      />
    );
  }

  return (
    <StudyList
      studies={studies}
      onUpload={handleUpload}
      onPractice={handlePractice}
      onDelete={handleDelete}
      onBack={onBack}
    />
  );
}
