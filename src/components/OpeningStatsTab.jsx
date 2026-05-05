import { useState, useEffect, useMemo } from 'react';
import { getOnlineGamesForStats } from '../logic/onlineGames.js';

const TC_LABELS = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classical: 'Classical' };

const DATE_RANGES = [
  { id: 'all', label: 'All time' },
  { id: '1m',  label: '1 month' },
  { id: '3m',  label: '3 months' },
  { id: '1y',  label: '1 year' },
];

function sinceFromRange(range) {
  if (range === 'all') return null;
  const d = new Date();
  if (range === '1m') d.setMonth(d.getMonth() - 1);
  if (range === '3m') d.setMonth(d.getMonth() - 3);
  if (range === '1y') d.setFullYear(d.getFullYear() - 1);
  return d.toISOString();
}

function calcStats(games) {
  const wins   = games.filter(g => g.result === 'win').length;
  const losses = games.filter(g => g.result === 'loss').length;
  const draws  = games.filter(g => g.result === 'draw').length;
  const total  = games.length;
  const score  = total > 0 ? (wins + 0.5 * draws) / total : 0;
  return { wins, losses, draws, total, score };
}

// Strip trailing move sequences like ", 4.dxc5 e6 5.Be3 Nd7" or " 6.Bg5 e6"
function condenseVariation(name) {
  return name.replace(/,?\s+\d+\..*$/, '').trim();
}

function computeTree(games) {
  const families = {};
  for (const g of games) {
    if (!g.opening || !g.result) continue;
    const idx = g.opening.indexOf(':');
    const family    = idx >= 0 ? g.opening.slice(0, idx).trim() : g.opening.trim();
    const rawVar    = idx >= 0 ? g.opening.slice(idx + 1).trim() : null;
    const variation = rawVar ? condenseVariation(rawVar) : null;
    if (!families[family]) families[family] = { games: [], variations: {} };
    families[family].games.push(g);
    if (variation) {
      if (!families[family].variations[variation]) families[family].variations[variation] = [];
      families[family].variations[variation].push(g);
    }
  }
  return families;
}

// ── Win rate over time chart ──────────────────────────────────────────────────

function WinRateChart({ games, label }) {
  const sorted = useMemo(
    () => [...games].sort((a, b) => new Date(a.played_at) - new Date(b.played_at)),
    [games]
  );

  const ROLL = 10;
  const pts = sorted.map((_, i) => {
    const window = sorted.slice(Math.max(0, i - ROLL + 1), i + 1);
    const wins  = window.filter(g => g.result === 'win').length;
    const draws = window.filter(g => g.result === 'draw').length;
    return (wins + 0.5 * draws) / window.length;
  });

  const W = 600, H = 130;
  const P = { t: 10, r: 12, b: 22, l: 34 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;
  const n  = pts.length;

  const cx = i => P.l + (n > 1 ? (i / (n - 1)) : 0.5) * iW;
  const cy = v => P.t + (1 - v) * iH;

  const linePath = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${cy(v).toFixed(1)}`).join(' ');
  const areaPath = linePath
    + ` L${cx(n - 1).toFixed(1)},${cy(0).toFixed(1)}`
    + ` L${cx(0).toFixed(1)},${cy(0).toFixed(1)} Z`;

  const fmtDate = iso => new Date(iso).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

  return (
    <div className="stat-chart-wrap">
      <div className="stat-chart-title">{label} — rolling {ROLL}-game score %</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="stat-chart-svg" preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <line key={v}
            x1={P.l} x2={W - P.r} y1={cy(v)} y2={cy(v)}
            stroke={v === 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}
            strokeWidth="1"
            strokeDasharray={v === 0.5 ? '5,3' : undefined}
          />
        ))}
        <path d={areaPath} fill="rgba(100,200,100,0.1)" />
        <path d={linePath} fill="none" stroke="rgba(100,200,100,0.8)" strokeWidth="1.8" strokeLinejoin="round" />
        {sorted.map((g, i) => (
          <circle key={i}
            cx={cx(i)} cy={cy(g.result === 'win' ? 0.93 : g.result === 'loss' ? 0.07 : 0.5)}
            r="2.5"
            fill={g.result === 'win' ? '#5c5' : g.result === 'loss' ? '#e55' : '#999'}
            opacity="0.5"
          />
        ))}
        {[0, 0.5, 1].map(v => (
          <text key={v} x={P.l - 4} y={cy(v)} textAnchor="end" fontSize="9"
            fill="rgba(255,255,255,0.3)" dominantBaseline="middle">
            {v * 100}%
          </text>
        ))}
        {n > 1 && <>
          <text x={cx(0)}     y={H - 2} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.28)">{fmtDate(sorted[0].played_at)}</text>
          <text x={cx(n - 1)} y={H - 2} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.28)">{fmtDate(sorted[n - 1].played_at)}</text>
        </>}
      </svg>
    </div>
  );
}

// ── Filter pill row (reusable) ────────────────────────────────────────────────

function FilterGroup({ label, options, value, onChange }) {
  return (
    <div className="online-filter-group">
      <span className="online-filter-label">{label}</span>
      <div className="games-filter-tabs">
        {options.map(({ id, label: lbl }) => (
          <button
            key={id}
            className={`games-filter-tab${value === id ? ' games-filter-tab--active' : ''}`}
            onClick={() => onChange(id)}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Stats row ─────────────────────────────────────────────────────────────────

function StatsRow({ name, stats, indent, isSelected, isExpanded, canExpand, onToggleExpand, onSelect }) {
  const { wins, losses, draws, total, score } = stats;
  const lowSample = total < 5;

  function handleClick() {
    if (canExpand) onToggleExpand();
    onSelect();
  }

  return (
    <div
      className={`stat-row${indent ? ' stat-row--variation' : ''}${isSelected ? ' stat-row--selected' : ''}`}
      onClick={handleClick}
    >
      <div className="stat-row-name">
        {canExpand && (
          <span className="stat-expand-icon">{isExpanded ? '▾' : '▸'}</span>
        )}
        {!canExpand && indent && <span className="stat-indent" />}
        <span className="stat-row-label">{name}</span>
        {lowSample && <span className="stat-low-sample" title="Fewer than 5 games — small sample">~</span>}
      </div>
      <div className="stat-row-games">{total}</div>
      <div className="stat-row-pct">{Math.round(score * 100)}%</div>
      <div className="stat-row-wld">
        <span className="stat-w">{wins}W</span>
        <span className="stat-d">{draws}D</span>
        <span className="stat-l">{losses}L</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OpeningStatsTab({ userId, onOpenGames }) {
  const [filterTC,    setFilterTC]    = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [dateRange,   setDateRange]   = useState('all');
  const [sortBy,      setSortBy]      = useState('games');
  const [rawGames,    setRawGames]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [expanded,    setExpanded]    = useState(new Set());
  const [selected,    setSelected]    = useState(null); // { name, games }

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getOnlineGamesForStats(userId, {
      filterTC,
      filterColor,
      since: sinceFromRange(dateRange),
    }).then(data => {
      setRawGames(data);
      setSelected(null);
    }).finally(() => setLoading(false));
  }, [userId, filterTC, filterColor, dateRange]);

  const tree = useMemo(() => computeTree(rawGames), [rawGames]);

  const rows = useMemo(() => {
    const entries = Object.entries(tree).map(([name, data]) => ({
      name,
      stats: calcStats(data.games),
      games: data.games,
      variations: Object.entries(data.variations)
        .map(([vname, vgames]) => ({ name: vname, stats: calcStats(vgames), games: vgames }))
        .sort((a, b) => b.stats.total - a.stats.total),
    }));
    if (sortBy === 'games')   return entries.sort((a, b) => b.stats.total - a.stats.total);
    if (sortBy === 'winrate') return entries.sort((a, b) => b.stats.score - a.stats.score);
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [tree, sortBy]);

  function toggleExpand(name) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  // selected stores { name, games, openingFilter } where openingFilter is the
  // precise string to pass to the games query (family or "family: variation")
  function selectRow(name, games, openingFilter) {
    setSelected(prev => prev?.name === name ? null : { name, games, openingFilter });
  }

  const totalGames = rawGames.length;

  return (
    <div className="opening-stats">
      <div className="online-filter-row">
        <FilterGroup
          label="Color"
          options={[{ id: 'all', label: 'All' }, { id: 'white', label: 'White' }, { id: 'black', label: 'Black' }]}
          value={filterColor}
          onChange={setFilterColor}
        />
        <FilterGroup
          label="Time"
          options={[
            { id: 'all', label: 'All' },
            ...['bullet', 'blitz', 'rapid', 'classical'].map(id => ({ id, label: TC_LABELS[id] })),
          ]}
          value={filterTC}
          onChange={setFilterTC}
        />
        <FilterGroup
          label="Date"
          options={DATE_RANGES}
          value={dateRange}
          onChange={setDateRange}
        />
      </div>

      <div className="stat-sort-row">
        <span className="stat-sort-label">Sort:</span>
        {[
          { id: 'games',   label: 'Most played' },
          { id: 'winrate', label: 'Score %' },
          { id: 'name',    label: 'Name' },
        ].map(s => (
          <button
            key={s.id}
            className={`stat-sort-btn${sortBy === s.id ? ' stat-sort-btn--active' : ''}`}
            onClick={() => setSortBy(s.id)}
          >
            {s.label}
          </button>
        ))}
        {!loading && <span className="stat-total-label">{totalGames} games</span>}
      </div>

      {loading ? (
        <p className="study-loading">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="games-empty">No games with opening data match these filters.</p>
      ) : (
        <div className="stat-content-layout">
          <div className="stat-table-col">
            <div className="stat-table">
              <div className="stat-header">
                <div className="stat-row-name">Opening</div>
                <div className="stat-row-games">N</div>
                <div className="stat-row-pct">Score%</div>
                <div className="stat-row-wld">W / D / L</div>
              </div>

              {rows.map(row => (
                <div key={row.name}>
                  <StatsRow
                    name={row.name}
                    stats={row.stats}
                    indent={false}
                    isSelected={selected?.name === row.name}
                    isExpanded={expanded.has(row.name)}
                    canExpand={row.variations.length > 0}
                    onToggleExpand={() => toggleExpand(row.name)}
                    onSelect={() => selectRow(row.name, row.games, row.name)}
                  />
                  {expanded.has(row.name) && row.variations.map(v => (
                    <StatsRow
                      key={v.name}
                      name={v.name}
                      stats={v.stats}
                      indent={true}
                      isSelected={selected?.name === v.name}
                      isExpanded={false}
                      canExpand={false}
                      onToggleExpand={() => {}}
                      onSelect={() => selectRow(v.name, v.games, `${row.name}: ${v.name}`)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {selected && (
            <div className="stat-panel-col">
              <div className="stat-selected-panel">
                <div className="stat-panel-heading">{selected.name}</div>
                {selected.games.length >= 2 && (
                  <WinRateChart games={selected.games} label={`Rolling ${10}-game score`} />
                )}
                <button
                  className="stat-view-games-btn"
                  onClick={() => onOpenGames?.(selected.openingFilter, filterTC, filterColor)}
                >
                  View {selected.games.length} game{selected.games.length !== 1 ? 's' : ''} →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
