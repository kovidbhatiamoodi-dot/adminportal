import { useState, useId, useMemo } from 'react';

/**
 * Dependency-free SVG charts for the admin dashboard.
 *
 * Hand-rolled rather than pulling in a charting library: the portal only ships
 * react + tailwind, and these are four single-series charts of two shapes.
 *
 * Colour: one hue for everything, because every chart on this page measures the
 * same quantity (registrations) cut a different way — a second hue would imply
 * a second measure. #3987e5 is validated against the #111118 card surface
 * (lightness band, chroma floor, >=3:1 contrast).
 *
 * All charts are single-series, so none carries a legend: the card title names
 * the series.
 */
const SERIES = '#3987e5';
const GRID = 'rgba(255,255,255,0.06)';
const AXIS = 'rgba(255,255,255,0.12)';
const INK_MUTED = '#94a3b8';

const fmt = (n) => (n ?? 0).toLocaleString('en-IN');

/** Card chrome, matched to the existing dashboard panels. */
export function ChartCard({ title, subtitle, action, children }) {
  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-5 flex flex-col">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyPlot({ label = 'No data for this period' }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-xs text-slate-600">
      {label}
    </div>
  );
}

/**
 * Line + area over time. Used for both the daily and the cumulative series —
 * they are two measures on different scales, so they get two charts rather than
 * one chart with two y-axes.
 *
 * `points`: [{ date: 'YYYY-MM-DD', value: number }]
 */
export function LineAreaChart({ points = [], valueLabel = 'Registrations' }) {
  const gradientId = useId();
  const [hover, setHover] = useState(null);

  // A viewBox with no intrinsic width: the SVG scales to the card, and every
  // coordinate below is in these units.
  const W = 720;
  const H = 240;
  const PAD = { top: 16, right: 16, bottom: 28, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const { max, ticks, coords, path, areaPath } = useMemo(() => {
    if (!points.length) return { max: 0, ticks: [], coords: [], path: '', areaPath: '' };

    const rawMax = Math.max(...points.map((p) => p.value), 0);
    // Round the axis up to something human, and never collapse to zero height
    // when every day is 0.
    const step = Math.max(1, Math.ceil(rawMax / 4));
    const niceStep = step <= 5 ? step : Math.ceil(step / 5) * 5;
    const axisMax = Math.max(niceStep * 4, 4);

    const x = (i) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = (v) => PAD.top + plotH - (v / axisMax) * plotH;

    const pts = points.map((p, i) => ({ ...p, cx: x(i), cy: y(p.value) }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(2)},${p.cy.toFixed(2)}`).join(' ');
    const area =
      `${line} L${pts[pts.length - 1].cx.toFixed(2)},${(PAD.top + plotH).toFixed(2)}` +
      ` L${pts[0].cx.toFixed(2)},${(PAD.top + plotH).toFixed(2)} Z`;

    return {
      max: axisMax,
      ticks: [0, 1, 2, 3, 4].map((i) => ({ value: (axisMax / 4) * i, y: y((axisMax / 4) * i) })),
      coords: pts,
      path: line,
      areaPath: area,
    };
  }, [points, plotW, plotH]);

  if (!points.length) return <EmptyPlot />;

  // At most six date labels, whatever the range — 365 days of ticks would be a
  // grey smear.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const svgX = ratio * W;
    let nearest = 0;
    let best = Infinity;
    coords.forEach((p, i) => {
      const d = Math.abs(p.cx - svgX);
      if (d < best) { best = d; nearest = i; }
    });
    setHover(nearest);
  };

  const hovered = hover != null ? coords[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[240px] overflow-visible"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`${valueLabel} over time`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES} stopOpacity="0.30" />
            <stop offset="100%" stopColor={SERIES} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive grid, drawn first so the series sits over it */}
        {ticks.map((t) => (
          <g key={t.value}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke={GRID} strokeWidth="1" />
            <text
              x={PAD.left - 8}
              y={t.y + 3.5}
              textAnchor="end"
              fill={INK_MUTED}
              fontSize="10"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {Math.round(t.value)}
            </text>
          </g>
        ))}

        <line x1={PAD.left} y1={PAD.top + plotH} x2={W - PAD.right} y2={PAD.top + plotH} stroke={AXIS} strokeWidth="1" />

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Date labels */}
        {coords.map((p, i) =>
          i % labelEvery === 0 || i === coords.length - 1 ? (
            <text key={p.date} x={p.cx} y={H - 8} textAnchor="middle" fill={INK_MUTED} fontSize="10">
              {new Date(`${p.date}T00:00:00Z`).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', timeZone: 'UTC',
              })}
            </text>
          ) : null
        )}

        {hovered && (
          <g pointerEvents="none">
            <line x1={hovered.cx} y1={PAD.top} x2={hovered.cx} y2={PAD.top + plotH} stroke={AXIS} strokeWidth="1" />
            {/* 2px surface ring so the marker reads against the line it sits on */}
            <circle cx={hovered.cx} cy={hovered.cy} r="5" fill={SERIES} stroke="#111118" strokeWidth="2" />
          </g>
        )}
      </svg>

      {hovered && (
        <div
          className="absolute -top-1 pointer-events-none bg-[#1a1a27] border border-white/10 rounded-lg px-3 py-2 shadow-xl"
          style={{
            left: `${(hovered.cx / W) * 100}%`,
            transform: `translateX(${hovered.cx > W * 0.75 ? '-100%' : hovered.cx < W * 0.25 ? '0%' : '-50%'})`,
          }}
        >
          <p className="text-[10px] text-slate-400 whitespace-nowrap">
            {new Date(`${hovered.date}T00:00:00Z`).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
            })}
          </p>
          <p className="text-sm font-semibold text-white whitespace-nowrap">
            {fmt(hovered.value)} <span className="text-xs font-normal text-slate-400">{valueLabel}</span>
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Horizontal bars, sorted descending. Horizontal because the categories are
 * college and state names — rotated labels under vertical bars are unreadable.
 *
 * `items`: [{ label: string, count: number }]
 */
export function HBarChart({ items = [], emptyLabel }) {
  const [hover, setHover] = useState(null);

  if (!items.length) return <EmptyPlot label={emptyLabel} />;

  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const pct = (item.count / max) * 100;
        return (
          <div
            key={`${item.label}-${i}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-center"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="min-w-0">
              <p className="text-xs text-slate-300 truncate mb-1" title={item.label}>
                {item.label}
              </p>
              {/* Track is the surface showing through, not a painted bar */}
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.max(pct, 1.5)}%`,
                    backgroundColor: SERIES,
                    opacity: hover === null || hover === i ? 1 : 0.55,
                  }}
                />
              </div>
            </div>
            {/* Direct label on every bar: there are at most ten, and reading a
                ranking off an axis is worse than reading the number. */}
            <span
              className="text-xs font-semibold text-white self-end pb-0.5"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fmt(item.count)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
