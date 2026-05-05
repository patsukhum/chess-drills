import { useState, useEffect } from 'react';
import { getLeaderboard } from '../logic/leaderboard.js';

const PIECE_LABELS = { rook: 'Rook', bishop: 'Bishop', knight: 'Knight' };

export default function GameOver({ score, playerName, pieceType = 'rook', onPlayAgain }) {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    getLeaderboard(pieceType).then(setLeaderboard);
  }, [pieceType]);

  const rank = leaderboard.findIndex(e => e.name === playerName && e.score === score) + 1;

  return (
    <div className="gameover-overlay">
      <div className="gameover-card">
        <h2>Game Over</h2>
        <div className="big-score">{score}</div>
        <p>{score === 1 ? 'fork completed!' : 'forks completed!'}</p>
        {rank > 0 && (
          <p className="rank-msg">
            {rank === 1 ? '🥇 New top score!' : rank === 2 ? '🥈 2nd place!' : rank === 3 ? '🥉 3rd place!' : `#${rank} on the leaderboard`}
          </p>
        )}

        {leaderboard.length > 0 && (
          <div>
            <p className="lb-section-title">{PIECE_LABELS[pieceType]} leaderboard</p>
          </div>
        )}
        {leaderboard.length > 0 && (
          <ol className="leaderboard-list leaderboard-list--compact">
            {leaderboard.slice(0, 10).map((entry, i) => (
              <li
                key={i}
                className={`leaderboard-row${entry.name === playerName && entry.score === score && i + 1 === rank ? ' leaderboard-row--me' : ''}`}
              >
                <span className="lb-rank">{i + 1}</span>
                <span className="lb-name">{entry.name}</span>
                <span className="lb-score">{entry.score}</span>
              </li>
            ))}
          </ol>
        )}

        <button className="play-again-btn" onClick={onPlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  );
}
