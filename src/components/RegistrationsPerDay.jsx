import { useEffect, useState } from 'react';
import { api } from '../api';

// Local-clock YYYY-MM-DD (toISOString would be UTC and shift the day for IST).
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
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

const longLabel = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

const fmt = (n) => (n ?? 0).toLocaleString('en-IN');

const dateInputClass =
  'bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white [color-scheme:dark] focus:outline-none focus:border-indigo-500/50';

// Registrations per day as plain numbers, 2026 only. "Compare with 2025" is
// optional and off by default: it adds the same date last year beside each day.
export default function RegistrationsPerDay() {
  const [range, setRange] = useState({ from: daysAgoKey(13), to: daysAgoKey(0) });
  const [compare, setCompare] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getRegistrationComparison(range.from, range.to, compare)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load registrations'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to, compare]);

  const rows = data?.rows ?? [];
  const totals = data?.totals;
  const hasPrev = compare && totals?.previous != null;

  const today = toKey(new Date());
  const activePreset = PRESETS.find(
    (p) => range.to === today && range.from === daysAgoKey(p.days - 1)
  )?.days;
  const onFrom = (v) => v && setRange((r) => ({ from: v, to: v > r.to ? v : r.to }));
  const onTo = (v) => v && setRange((r) => ({ from: v < r.from ? v : r.from, to: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Registrations per day (2026)</h2>
          <p className="text-xs text-slate-500">Days cut at IST midnight</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-lg p-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setRange({ from: daysAgoKey(p.days - 1), to: today })}
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
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
            Compare with 2025
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {compare && data?.previousError && (
        <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl px-5 py-3">
          <p className="text-xs text-amber-200/90">{data.previousError}</p>
        </div>
      )}

      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm min-w-[360px]">
            <thead className="sticky top-0 bg-[#111118]">
              <tr className="border-b border-white/[0.07] text-left">
                <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Date</th>
                <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Registered</th>
                <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total so far</th>
                {hasPrev && (
                  <>
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Same date 2025</th>
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">2025 total so far</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className={loading ? 'opacity-50' : ''}>
              {totals && (
                <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                  <td className="px-4 py-2 text-xs font-semibold text-slate-200">Selected dates</td>
                  <td className="px-4 py-2 text-sm font-bold text-white">{fmt(totals.current)}</td>
                  <td className="px-4 py-2 text-xs text-slate-300">{fmt(totals.currentCumulative)}</td>
                  {hasPrev && (
                    <>
                      <td className="px-4 py-2 text-sm font-bold text-amber-300">{fmt(totals.previous)}</td>
                      <td className="px-4 py-2 text-xs text-amber-300/80">{fmt(totals.previousCumulative)}</td>
                    </>
                  )}
                </tr>
              )}
              {[...rows].reverse().map((r) => (
                <tr
                  key={r.date}
                  className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] ${
                    r.date === today ? 'bg-indigo-500/[0.07]' : ''
                  }`}
                >
                  <td className="px-4 py-2 text-xs text-slate-300 whitespace-nowrap">
                    {longLabel(r.date)}
                    {r.date === today && <span className="ml-2 text-[10px] text-indigo-300">today</span>}
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold text-white">{fmt(r.current)}</td>
                  <td className="px-4 py-2 text-xs text-slate-400">{fmt(r.currentCumulative)}</td>
                  {hasPrev && (
                    <>
                      <td className="px-4 py-2 text-xs text-amber-300 whitespace-nowrap">
                        {fmt(r.previous)} <span className="text-slate-600">· {longLabel(r.previousDate)}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-400">{fmt(r.previousCumulative)}</td>
                    </>
                  )}
                </tr>
              ))}
              {!loading && rows.length === 0 && !error && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-600">No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
