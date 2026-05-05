import Piece from './Piece.jsx';

export default function Square({ row, col, piece, feedback, onClick }) {
  const isLight = (row + col) % 2 === 0;

  return (
    <div
      className={`square${feedback ? ` square--${feedback}` : ''}`}
      style={{ background: isLight ? 'var(--light-square)' : 'var(--dark-square)' }}
      onClick={onClick}
    >
      {piece && <Piece type={piece.type} color={piece.color} />}
    </div>
  );
}
