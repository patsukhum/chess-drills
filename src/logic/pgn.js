import { Chess } from 'chess.js';

function splitGames(pgn) {
  // Split multi-game PGN on blank line followed by a tag bracket
  return pgn.trim().split(/\n\n(?=\[)/).map(g => g.trim()).filter(Boolean);
}

function cleanPgn(pgn) {
  // Remove Lichess graphic annotation comments: { [%csl ...] } { [%cal ...] }
  // These appear as standalone comment blocks and cause chess.js to choke on
  // consecutive {} comments after the same move.
  return pgn.replace(/\{\s*\[%[^\]]*\][^}]*\}/g, '').replace(/[ \t]+/g, ' ').trim();
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
