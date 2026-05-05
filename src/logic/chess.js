const DIRECTIONS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

function onBoard(row, col) {
  return row >= 0 && row <= 7 && col >= 0 && col <= 7;
}

function squareEq(a, b) {
  return a.row === b.row && a.col === b.col;
}

function hasBlocker(blockers, row, col) {
  return blockers.some(b => b.row === row && b.col === col);
}

function queenReachableSquares(queenPos, blockers) {
  const result = [];
  for (const [dr, dc] of DIRECTIONS) {
    let r = queenPos.row + dr;
    let c = queenPos.col + dc;
    while (onBoard(r, c)) {
      result.push({ row: r, col: c });
      if (hasBlocker(blockers, r, c)) break;
      r += dr;
      c += dc;
    }
  }
  return result;
}

export function queenReaches(from, target, blockers) {
  for (const [dr, dc] of DIRECTIONS) {
    let r = from.row + dr;
    let c = from.col + dc;
    while (onBoard(r, c)) {
      if (r === target.row && c === target.col) return true;
      if (hasBlocker(blockers, r, c)) break;
      r += dr;
      c += dc;
    }
  }
  return false;
}

function rookAttacks(pos, targetSq, blockers) {
  if (pos.row !== targetSq.row && pos.col !== targetSq.col) return false;
  const dr = Math.sign(targetSq.row - pos.row);
  const dc = Math.sign(targetSq.col - pos.col);
  let r = pos.row + dr;
  let c = pos.col + dc;
  while (r !== targetSq.row || c !== targetSq.col) {
    if (hasBlocker(blockers, r, c)) return false;
    r += dr;
    c += dc;
  }
  return true;
}

function bishopAttacks(pos, targetSq, blockers) {
  if (Math.abs(pos.row - targetSq.row) !== Math.abs(pos.col - targetSq.col)) return false;
  const dr = Math.sign(targetSq.row - pos.row);
  const dc = Math.sign(targetSq.col - pos.col);
  let r = pos.row + dr;
  let c = pos.col + dc;
  while (r !== targetSq.row || c !== targetSq.col) {
    if (hasBlocker(blockers, r, c)) return false;
    r += dr;
    c += dc;
  }
  return true;
}

function knightAttacks(pos, targetSq) {
  const dr = Math.abs(pos.row - targetSq.row);
  const dc = Math.abs(pos.col - targetSq.col);
  return (dr === 1 && dc === 2) || (dr === 2 && dc === 1);
}

// Dispatch to the right attack function based on piece type.
export function pieceAttacks(pos, targetSq, pieceType, blockers) {
  switch (pieceType) {
    case 'rook':   return rookAttacks(pos, targetSq, blockers);
    case 'bishop': return bishopAttacks(pos, targetSq, blockers);
    case 'knight': return knightAttacks(pos, targetSq); // knights ignore blockers
    default: return false;
  }
}

function isAdjacentToKing(sq, king) {
  return Math.abs(sq.row - king.row) <= 1 && Math.abs(sq.col - king.col) <= 1;
}

export function findForkSquares(queen, king, target, targetType) {
  const reachable = queenReachableSquares(queen, [king, target]);
  const forks = [];

  for (const sq of reachable) {
    if (squareEq(sq, king) || squareEq(sq, target)) continue;
    if (isAdjacentToKing(sq, king)) continue;
    // Can the target piece recapture the queen at sq? (king may block sliding pieces)
    if (pieceAttacks(target, sq, targetType, [king])) continue;
    // From sq, queen must attack king (target may block)
    if (!queenReaches(sq, king, [target])) continue;
    // From sq, queen must attack target (king may block)
    if (!queenReaches(sq, target, [king])) continue;
    forks.push(sq);
  }

  return forks;
}

export function isValidForkMove(sq, queen, king, target, targetType) {
  return findForkSquares(queen, king, target, targetType).some(f => squareEq(f, sq));
}
