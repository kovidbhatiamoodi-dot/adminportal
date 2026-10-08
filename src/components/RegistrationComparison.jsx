import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { ChartCard, CompareLineChart } from './Charts';

// Local-clock YYYY-MM-DD. toISOString() would be UTC and shift the day for IST.
const toKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const daysAgoKey = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toKey(d);
};

const PRESETS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

const shortLabel = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });

const longLabel = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

const fmt = (n) => (n ?? 0).toLocaleString('en-IN');

function Tile({ label, value, hint, tone = 'text-white' }) {
  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl px-5 py-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="text-[10px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

const dateInputClass =
  'bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white [color-scheme:dark] focus:outline-none focus:border-indigo-500/50';

// Registrations per day, this year against the same dates last year, over a
// date range the admin picks. 2025 comes from the old backend through ours.
export default function RegistrationComparison() {
  const [range, setRange] = useState({ from: daysAgoKey(29), to: daysAgoKey(0) });
  const [mode, setMode] = useState('daily'); // 'daily' | 'cumulative'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getRegistrationComparison(range.from, range.to)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load comparison'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to]);

  const rows = data?.rows ?? [];
  const totals = data?.totals;
  const hasPrev = totals?.previous != null;

  const points = useMemo(
    () =>
      rows.map((r, i) => ({
        day: i + 1,
        label: shortLabel(r.date),
        current: mode === 'daily' ? r.current : r.currentCumulative,
        previous: mode === 'daily' ? r.previous : r.previousCumulative,
        currentDate: r.date,
        previousDate: r.previousDate,
      })),
    [rows, mode]
  );

  const diff = hasPrev ? totals.current - totals.previous : null;
  const pct = hasPrev && totals.previous > 0 ? Math.round((diff / totals.previous) * 100) : null;
  const cumDiff = hasPrev ? totals.currentCumulative - totals.previousCumulative : null;

  const setPreset = (days) => setRange({ from: daysAgoKey(days - 1), to: daysAgoKey(0) });
  const activePreset = PRESETS.find(
    (p) => range.to === daysAgoKey(0) && range.from === daysAgoKey(p.days - 1)
  )?.days;

  const today = toKey(new Date());
  const onFrom = (value) => value && setRange((r) => ({ from: value, to: value > r.to ? value : r.to }));
  const onTo = (value) => value && setRange((r) => ({ from: value < r.from ? value : r.from, to: value }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Registrations per day: 2026 vs 2025</h2>
          <p className="text-xs text-slate-500">
            Each date against the same date a year earlier · days cut at IST midnight
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-lg p-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setPreset(p.days)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  activePreset === p.days ? 'bg-indigo-600/30 text-indigo-200' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            From
            <input type="date" value={range.from} max={today} onChange={(e) => onFrom(e.target.value)} className={dateInputClass} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            To
            <input type="date" value={range.to} max={today} onChange={(e) => onTo(e.target.value)} className={dateInputClass} />
          </label>

          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-lg p-0.5">
            {[['daily', 'Per day'], ['cumulative', 'Cumulative']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  mode === value ? 'bg-indigo-600/30 text-indigo-200' : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 text-sm text-red-300">
          Comparison unavailable: {error}
        </div>
      )}

      {data?.previousError && (
        <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl px-5 py-3">
          <p className="text-xs text-amber-200/90">{data.previousError}</p>
        </div>
      )}

      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        <Tile
          label={data ? `2026 · ${shortLabel(data.from)} – ${shortLabel(data.to)}` : '2026'}
          value={totals ? fmt(totals.current) : '—'}
          hint="registered in the selected dates"
        />
        <Tile
          label={data ? `2025 · ${shortLabel(rows[0]?.previousDate ?? data.from)} – ${shortLabel(rows[rows.length - 1]?.previousDate ?? data.to)}` : '2025'}
          value={hasPrev ? fmt(totals.previous) : '—'}
          hint={diff == null ? undefined : `${diff >= 0 ? '+' : ''}${fmt(diff)}${pct != null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : ''} for 2026`}
          tone="text-amber-300"
        />
        <Tile
          label={data ? `2026 total by ${shortLabel(data.to)}` : '2026 total'}
          value={totals ? fmt(totals.currentCumulative) : '—'}
          hint="all registrations up to that date"
        />
        <Tile
          label={data ? `2025 total by ${shortLabel(rows[rows.length - 1]?.previousDate ?? data.to)}` : '2025 total'}
          value={hasPrev ? fmt(totals.previousCumulative) : '—'}
          hint={cumDiff == null ? undefined : `${cumDiff >= 0 ? '+' : ''}${fmt(cumDiff)} for 2026`}
          tone="text-amber-300"
        />
      </div>

      <ChartCard title={mode === 'daily' ? 'Registrations per day' : 'Total registrations to date'}>
        <CompareLineChart points={points} currentLabel="2026" previousLabel="2025" />
      </ChartCard>

      {/* The same numbers as a list, so a specific day can be read off. */}
      {rows.length > 0 && (
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="sticky top-0 bg-[#111118]">
                <tr className="border-b border-white/[0.07] text-left">
                  {['Date (2026)', '2026', 'Same date 2025', '2025', 'Difference'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => {
                  const d = r.previous == null ? null : r.current - r.previous;
                  return (
                    <tr key={r.date} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-2 text-xs text-slate-300 whitespace-nowrap">{longLabel(r.date)}</td>
                      <td className="px-4 py-2 text-xs font-semibold text-white">{fmt(r.current)}</td>
                      <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{longLabel(r.previousDate)}</td>
                      <td className="px-4 py-2 text-xs font-semibold text-amber-300">{r.previous == null ? '—' : fmt(r.previous)}</td>
                      <td className={`px-4 py-2 text-xs font-medium ${d == null ? 'text-slate-600' : d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d == null ? '—' : `${d >= 0 ? '+' : ''}${fmt(d)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
