import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase.js';
import { getOrCreateProfile } from './logic/profile.js';
import TopNav from './components/TopNav.jsx';
import HomeScreen from './components/HomeScreen.jsx';
import Board from './components/Board.jsx';
import ScorePanel from './components/ScorePanel.jsx';
import GameOver from './components/GameOver.jsx';
import StartScreen from './components/StartScreen.jsx';
import StudyScreen from './components/StudyScreen.jsx';
import GamesScreen from './components/GamesScreen.jsx';
import { isValidForkMove } from './logic/chess.js';
import { generatePosition } from './logic/position.js';
import { saveScore } from './logic/leaderboard.js';
import './App.css';

function freshGame(targetType = 'rook') {
  return {
    boardState: generatePosition(targetType),
    targetType,
    score: 0,
    secondsLeft: 60,
    feedback: null,
    lastClick: null,
    queenAnimation: null,
  };
}

export default function App() {
  const [appPhase, setAppPhase] = useState('home'); // 'home' | 'start' | 'playing' | 'gameover' | 'study' | 'games'
  const [authUser, setAuthUser] = useState(undefined); // undefined=loading, null=not authed, {name,id}=authed
  const [playerName, setPlayerName] = useState('');
  const [game, setGame] = useState(null);
  const isProcessing = useRef(false);

  useEffect(() => {
    async function resolveUser(u) {
      if (!u) return null;
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000));
        const username = await Promise.race([
          getOrCreateProfile(u.id, u.user_metadata?.full_name || u.email),
          timeout,
        ]);
        return { name: username, id: u.id };
      } catch {
        const fallback = (u.user_metadata?.full_name || u.email || 'Player').split(' ')[0];
        return { name: fallback, id: u.id };
      }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      setAuthUser(await resolveUser(session?.user));
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  useEffect(() => {
    if (appPhase !== 'playing') return;
    const id = setInterval(() => {
      setGame(g => {
        if (!g || g.secondsLeft <= 0) return g;
        return { ...g, secondsLeft: g.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [appPhase]);

  useEffect(() => {
    if (appPhase === 'playing' && game?.secondsLeft === 0) {
      setAppPhase('gameover');
      saveScore(playerName, game.score, game.targetType, authUser?.id || null);
    }
  }, [game?.secondsLeft, appPhase]);

  function handleStart(name, targetType) {
    setPlayerName(name);
    isProcessing.current = false;
    setGame(freshGame(targetType));
    setAppPhase('playing');
  }

  function handleSquareClick(sq) {
    if (isProcessing.current || appPhase !== 'playing') return;

    const { queen, king, target, targetType } = game.boardState;
    if (isValidForkMove(sq, queen, king, target, targetType)) {
      isProcessing.current = true;
      const from = queen;
      setGame(g => ({
        ...g,
        score: g.score + 1,
        feedback: 'correct',
        lastClick: sq,
        queenAnimation: { from, to: sq },
      }));
      setTimeout(() => {
        setGame(g => ({
          ...g,
          boardState: generatePosition(g.targetType),
          feedback: null,
          lastClick: null,
          queenAnimation: null,
        }));
        isProcessing.current = false;
      }, 380);
    } else {
      isProcessing.current = true;
      setGame(g => ({ ...g, feedback: 'wrong', lastClick: sq }));
      setTimeout(async () => {
        await saveScore(playerName, game.score, game.targetType, authUser?.id || null);
        setAppPhase('gameover');
        isProcessing.current = false;
      }, 400);
    }
  }

  function handlePlayAgain() {
    setAppPhase('start');
    setGame(null);
  }

  const nav = (
    <TopNav
      authUser={authUser}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
      onHome={() => setAppPhase('home')}
    />
  );

  if (appPhase === 'home') {
    return (
      <>
        {nav}
        <div className="app app--wide">
          <HomeScreen
            authUser={authUser}
            onSignIn={handleSignIn}
            onForkDrill={() => setAppPhase('start')}
            onStudy={() => setAppPhase('study')}
            onGames={() => setAppPhase('games')}
          />
        </div>
      </>
    );
  }

  if (appPhase === 'start') {
    return (
      <>
        {nav}
        <div className="app">
          <StartScreen
            authUser={authUser}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onStart={handleStart}
            onBack={() => setAppPhase('home')}
          />
        </div>
      </>
    );
  }

  if (appPhase === 'study') {
    return (
      <>
        {nav}
        <div className="app app--wide">
          <StudyScreen userId={authUser?.id || null} onBack={() => setAppPhase('home')} />
        </div>
      </>
    );
  }

  if (appPhase === 'games') {
    return (
      <>
        {nav}
        <div className="app app--wide">
          <GamesScreen
            userId={authUser?.id || null}
            playerName={authUser?.name || null}
            onBack={() => setAppPhase('home')}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {nav}
      <div className="app">
        <h1 className="title">Fork Drill</h1>
        <ScorePanel score={game.score} secondsLeft={game.secondsLeft} />
        <Board
          boardState={game.boardState}
          onSquareClick={handleSquareClick}
          lastClick={game.lastClick}
          feedback={game.feedback}
          queenAnimation={game.queenAnimation}
        />
        {appPhase === 'gameover' && (
          <GameOver
            score={game.score}
            playerName={playerName}
            pieceType={game.targetType}
            onPlayAgain={handlePlayAgain}
          />
        )}
      </div>
    </>
  );
}
