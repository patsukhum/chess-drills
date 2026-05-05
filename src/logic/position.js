import { findForkSquares, queenReaches, pieceAttacks } from './chess.js';

function rand() {
  return Math.floor(Math.random() * 8);
}

function isAdjacent(a, b) {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1;
}

function eq(a, b) {
  return a.row === b.row && a.col === b.col;
}

export function generatePosition(targetType = 'rook') {
  for (let i = 0; i < 2000; i++) {
    const king = { row: rand(), col: rand() };

    const target = { row: rand(), col: rand() };
    if (eq(target, king) || isAdjacent(target, king)) continue;
    // Target must not attack the king.
    if (pieceAttacks(target, king, targetType, [])) continue;

    const queen = { row: rand(), col: rand() };
    if (eq(queen, king) || eq(queen, target)) continue;
    // Queen must not be giving check or already attacking the target.
    if (queenReaches(queen, king, [target])) continue;
    if (queenReaches(queen, target, [king])) continue;

    if (findForkSquares(queen, king, target, targetType).length > 0) {
      return { queen, king, target, targetType };
    }
  }
  throw new Error('Could not generate a valid fork position');
}
