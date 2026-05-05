import { useState, useEffect } from 'react';
import { getLeaderboard } from '../logic/leaderboard.js';

const PIECE_TYPES = ['rook', 'bishop', 'knight'];
const PIECE_LABELS = { rook: '♜ Rook', bishop: '♝ Bishop', knight: '♞ Knight' };

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function StartScreen({ authUser, onSignIn, onSignOut, onStart, onBack }) {
  const [guestMode, setGuestMode] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem('queen-fork-player-name') || '');
  const [pieceType, setPieceType] = useState('rook');
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    getLeaderboard(pieceType).then(setLeaderboard);
  }, [pieceType]);

  function startGame(nameOverride, userId) {
    const finalName = nameOverride || name.trim();
    if (!finalName) return;
    if (!userId) localStorage.setItem('queen-fork-player-name', finalName);
    onStart(finalName, pieceType, userId || null);
  }

  const pieceSelector = (
    <div className="piece-selector">
      <label className="name-label">Fork which piece?</label>
      <div className="piece-toggle-row">
        {PIECE_TYPES.map(pt => (
          <button
            key={pt}
            className={`piece-toggle-btn${pieceType === pt ? ' piece-toggle-btn--active' : ''}`}
            onClick={() => setPieceType(pt)}
          >
            {PIECE_LABELS[pt]}
          </button>
        ))}
      </div>
    </div>
  );

  function renderAuthSection() {
    if (authUser === undefined) {
      return <div className="auth-loading">Loading…</div>;
    }

    if (authUser) {
      return (
        <div className="auth-signed-in">
          <div className="auth-user-row">
            <span className="auth-user-name">Signed in as <strong>{authUser.name}</strong></span>
            <button className="sign-out-btn" onClick={onSignOut}>Sign out</button>
          </div>
          {pieceSelector}
          <button className="start-btn" onClick={() => startGame(authUser.name, authUser.id)}>
            Play
          </button>
        </div>
      );
    }

    if (guestMode) {
      return (
        <div className="guest-section">
          <label className="name-label" htmlFor="player-name">Your name</label>
          <input
            id="player-name"
            className="name-input"
            type="text"
            placeholder="Enter your name"
            maxLength={20}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startGame(null, null)}
            autoFocus
          />
          {pieceSelector}
          <button className="start-btn" onClick={() => startGame(null, null)} disabled={!name.trim()}>
            Start
          </button>
          <button className="back-btn" onClick={() => setGuestMode(false)}><span className="back-btn-icon">‹</span>Back</button>
        </div>
      );
    }

    return (
      <div className="auth-choice">
        {pieceSelector}
        <button className="google-btn" onClick={onSignIn}>
          <GoogleIcon />
          Sign in with Google
        </button>
        <div className="auth-divider"><span>or</span></div>
        <button className="guest-btn" onClick={() => setGuestMode(true)}>
          Play as Guest
        </button>
      </div>
    );
  }

  return (
    <div className="start-screen">
      <div className="start-screen-nav">
        <button className="back-btn" onClick={onBack}><span className="back-btn-icon">‹</span>Home</button>
      </div>

      <h1 className="start-title">Fork Drill</h1>

      <div className="start-card">
        <section className="instructions">
          <h2>How to Play</h2>
          <ul>
            <li>Each puzzle shows a <strong>white queen ♕</strong>, a <strong>black king ♚</strong>, and a black piece of your choice.</li>
            <li>Click a square to move the queen so it <strong>attacks both the king and the other piece at the same time</strong> — that's a fork.</li>
            <li>Your chosen square must be <strong>safe</strong>: the king and target piece must not be able to recapture your queen.</li>
            <li>Score as many forks as you can in <strong>60 seconds</strong>.</li>
            <li>One wrong move and it's <strong>game over</strong>!</li>
          </ul>
        </section>

        <section className="name-section">
          {renderAuthSection()}
        </section>
      </div>

      {leaderboard.length > 0 && (
        <div className="leaderboard-card">
          <h2 className="leaderboard-title">{PIECE_LABELS[pieceType]} Leaderboard</h2>
          <ol className="leaderboard-list">
            {leaderboard.map((entry, i) => (
              <li key={i} className="leaderboard-row">
                <span className="lb-rank">{i + 1}</span>
                <span className="lb-name">{entry.name}</span>
                <span className="lb-score">{entry.score}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
