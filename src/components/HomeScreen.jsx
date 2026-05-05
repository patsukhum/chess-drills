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

export default function HomeScreen({ authUser, onSignIn, onForkDrill, onStudy }) {
  return (
    <div className="home-screen">
      <div className="home-hero">
        <h2 className="home-headline">Train your chess pattern recognition</h2>
        {authUser === null && (
          <button className="home-signin-prompt" onClick={onSignIn}>
            <GoogleIcon />
            Sign in to save scores &amp; studies
          </button>
        )}
      </div>

      <main className="home-modes">
        <button className="home-mode-card" onClick={onForkDrill}>
          <div className="home-mode-icon">♕</div>
          <h2 className="home-mode-title">Fork Drill</h2>
          <p className="home-mode-desc">
            Move the queen to fork the king and a target piece. Score as many as you can
            in 60 seconds — one wrong move ends the run.
          </p>
          <span className="home-mode-cta">Play →</span>
        </button>

        <button className="home-mode-card" onClick={onStudy}>
          <div className="home-mode-icon">♜</div>
          <h2 className="home-mode-title">Study Practice</h2>
          <p className="home-mode-desc">
            Upload a PGN study and drill it chapter by chapter. Annotations
            guide you through each move.
          </p>
          <span className="home-mode-cta">Study →</span>
        </button>
      </main>
    </div>
  );
}
