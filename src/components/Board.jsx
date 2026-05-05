import { useState, useLayoutEffect } from 'react';
import Square from './Square.jsx';
import Piece from './Piece.jsx';

function AnimatedQueen({ animation }) {
  const [pos, setPos] = useState(animation.from);

  useLayoutEffect(() => {
    setPos(animation.from);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPos(animation.to));
    });
    return () => cancelAnimationFrame(id);
  }, [animation]);

  return (
    <div
      className="queen-anim"
      style={{
        top: `calc(${pos.row} / 8 * var(--board-size))`,
        left: `calc(${pos.col} / 8 * var(--board-size))`,
      }}
    >
      <Piece type="queen" color="white" />
    </div>
  );
}

export default function Board({ boardState, onSquareClick, lastClick, feedback, queenAnimation }) {
  const { queen, king, target, targetType } = boardState;
  const animating = queenAnimation !== null;

  function getPiece(row, col) {
    if (animating && queen.row === row && queen.col === col) return null;
    if (queen.row === row && queen.col === col) return { type: 'queen', color: 'white' };
    if (king.row === row && king.col === col) return { type: 'king', color: 'black' };
    if (target.row === row && target.col === col) return { type: targetType, color: 'black' };
    return null;
  }

  function getFeedback(row, col) {
    if (!lastClick || lastClick.row !== row || lastClick.col !== col) return null;
    return feedback;
  }

  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      squares.push(
        <Square
          key={`${r}-${c}`}
          row={r}
          col={c}
          piece={getPiece(r, c)}
          feedback={getFeedback(r, c)}
          onClick={() => onSquareClick({ row: r, col: c })}
        />
      );
    }
  }

  return (
    <div className="board">
      {squares}
      {queenAnimation && <AnimatedQueen animation={queenAnimation} />}
    </div>
  );
}
