import { Chess } from 'chess.js';

function splitGames(pgn) {
  // Split multi-game PGN on blank line followed by a tag bracket
  return pgn.trim().split(/\n\n(?=\[)/).map(g => g.trim()).filter(Boolean);
}

function cleanPgn(pgn) {
  // Remove Lichess graphic annotation comments: { [%csl ...] } { [%cal ...] }
  // Then merge any remaining consecutive {} comment blocks into one — chess.js
  // chokes when two comment tokens appear after the same move.
  return pgn
    .replace(/\{\s*\[%[^\]]*\][^}]*\}/g, '')
    .replace(/\}\s*\{/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function parseGame(rawGame) {
  const fenMatch = rawGame.match(/\[FEN\s+"([^"]+)"\]/);
  const startFen = fenMatch ? fenMatch[1] : null;
  const chapterMatch = rawGame.match(/\[ChapterName\s+"([^"]+)"\]/);
  const name = chapterMatch ? chapterMatch[1] : null;

  const gamePgn = cleanPgn(rawGame);
  const chess = new Chess();
  chess.loadPgn(gamePgn);
  const history = chess.history({ verbose: true });
  if (history.length === 0) return null;

  // Build FEN→comment map; strip any residual [%...] annotation markers
  const commentsByFen = {};
  for (const { fen, comment } of chess.getComments()) {
    const text = comment.replace(/\[%[^\]]*\]/g, '').trim();
    if (text) commentsByFen[fen] = text;
  }

  const replay = startFen ? new Chess(startFen) : new Chess();
  // Comment before the first move is keyed by the starting FEN
  const introComment = commentsByFen[replay.fen()] ?? null;

  const positions = [];
  for (const move of history) {
    const entry = {
      fen: replay.fen(),
      from: move.from,
      to: move.to,
      promotion: move.promotion || null,
      san: move.san,
      comment: null,
    };
    replay.move(move);
    // Comment in PGN follows the move, keyed by the FEN after the move
    entry.comment = commentsByFen[replay.fen()] ?? null;
    positions.push(entry);
  }

  return { name, introComment, positions };
}

export function pgnToChapters(pgn) {
  const chapters = [];
  for (const rawGame of splitGames(pgn)) {
    try {
      const chapter = parseGame(rawGame);
      if (chapter) chapters.push(chapter);
    } catch (e) {
      console.warn('Skipping unparseable game:', e);
    }
  }
  return chapters;
}

export function pgnToPositions(pgn) {
  return pgnToChapters(pgn).flatMap(ch => ch.positions);
}

export function splitPgn(pgn) {
  return splitGames(pgn);
}

// Parse metadata encoded in Lichess study chapter names like:
//   "(G45 Sat) R1 Won vs Darren 1400"
//   "R2 W 1620 Nikolai VARFOLOMEEV"
//   "(Classical) Lost vs 2100 Gutnik"
export function parseChapterNameMeta(name) {
  if (!name) return {};

  let clean = name.replace(/^\*+/, '').trim();

  // Time control from parentheses: (G45 Sat), (Thurs G25), (Classical)
  let time_control = null;
  const parenMatch = clean.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inner = parenMatch[1];
    const gMatch = inner.match(/G(\d+)/i);
    if (gMatch) time_control = `G${gMatch[1]}`;
    else if (/classical/i.test(inner)) time_control = 'Classical';
    clean = clean.replace(parenMatch[0], '').trim();
  }

  // Result — longer keywords first, then single uppercase letters
  let result = null;
  if (/\b(won|win)\b/i.test(clean))       result = 'win';
  else if (/\b(lost|loss)\b/i.test(clean)) result = 'loss';
  else if (/\b(drew|draw)\b/i.test(clean)) result = 'draw';
  else if (/\bW\b/.test(clean))            result = 'win';
  else if (/\bL\b/.test(clean))            result = 'loss';
  else if (/\bD\b/.test(clean))            result = 'draw';

  // Opponent name and rating
  let opponent = null;
  let opponent_rating = null;

  const vsMatch = clean.match(/\bvs\s+(.+)/i);
  if (vsMatch) {
    const afterVs = vsMatch[1].trim();
    const rm = afterVs.match(/\b(\d{3,4})\b/);
    if (rm) {
      const n = parseInt(rm[1]);
      if (n >= 400 && n <= 3500) opponent_rating = n;
    }
    const nameOnly = afterVs.replace(/\b\d{3,4}\b/g, '').replace(/\s+/g, ' ').trim();
    if (nameOnly) opponent = nameOnly;
  } else {
    // No "vs" — strip round markers and result words, then separate rating from name
    const stripped = clean
      .replace(/\bR\d+\b/g, '')
      .replace(/\b(won|win|lost|loss|drew|draw)\b/gi, '')
      .replace(/\bW\b|\bL\b|\bD\b/g, '')
      .replace(/\s*-+\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const rm = stripped.match(/\b(\d{3,4})\b/);
    if (rm) {
      const n = parseInt(rm[1]);
      if (n >= 400 && n <= 3500) {
        opponent_rating = n;
        const nameOnly = stripped.replace(rm[0], '').replace(/\s+/g, ' ').trim();
        if (nameOnly.length > 1) opponent = nameOnly;
      }
    } else if (stripped.length > 1) {
      opponent = stripped;
    }
  }

  return { time_control, result, opponent, opponent_rating };
}

export function pgnToReplayData(pgn) {
  let chapter;
  try {
    chapter = parseGame(cleanPgn(pgn));
  } catch {
    return null;
  }
  if (!chapter) return null;
  const { positions, introComment } = chapter;

  const fenMatch = pgn.match(/\[FEN\s+"([^"]+)"\]/);
  const startFen = fenMatch ? fenMatch[1] : null;
  const replay = startFen ? new Chess(startFen) : new Chess();

  const fens = [replay.fen()];
  for (const pos of positions) {
    try {
      replay.move({ from: pos.from, to: pos.to, ...(pos.promotion ? { promotion: pos.promotion } : {}) });
    } catch {
      break;
    }
    fens.push(replay.fen());
  }

  const moves = positions.slice(0, fens.length - 1).map(p => ({
    san: p.san,
    comment: p.comment,
    from: p.from,
    to: p.to,
  }));

  return { fens, moves, introComment };
}
