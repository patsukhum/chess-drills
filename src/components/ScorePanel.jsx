export default function ScorePanel({ score, secondsLeft }) {
  const timerClass =
    secondsLeft <= 5 ? 'score-panel__value score-panel__value--danger'
    : secondsLeft <= 15 ? 'score-panel__value score-panel__value--warning'
    : 'score-panel__value';

  return (
    <div className="score-panel">
      <div className="score-panel__item">
        <span className="score-panel__label">Forks</span>
        <span className="score-panel__value">{score}</span>
      </div>
      <div className="score-panel__item">
        <span className="score-panel__label">Time</span>
        <span className={timerClass}>{secondsLeft}s</span>
      </div>
    </div>
  );
}
