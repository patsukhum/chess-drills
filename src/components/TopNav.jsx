function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function avatarUrl(name) {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export default function TopNav({ authUser, onSignIn, onSignOut, onHome }) {
  return (
    <nav className="top-nav">
      <div className="top-nav-inner">
        <button className="top-nav-logo" onClick={onHome}>
          <span className="top-nav-logo-icon">♟</span>
          Chess Drills
        </button>

        <div className="top-nav-right">
          {authUser === undefined ? null : authUser ? (
            <>
              <img
                className="top-nav-avatar"
                src={avatarUrl(authUser.name)}
                alt={authUser.name}
              />
              <span className="top-nav-name">{authUser.name}</span>
              <button className="top-nav-signout" onClick={onSignOut}>Sign out</button>
            </>
          ) : (
            <button className="top-nav-signin" onClick={onSignIn}>
              <GoogleIcon />
              Sign in
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
