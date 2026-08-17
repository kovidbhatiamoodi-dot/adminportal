import { useEffect, useState } from 'react';
import { api } from '../api';
import { ChartCard, LineAreaChart, HBarChart } from './Charts';

const RANGES = [
  { days: 7,  label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
];

function RangePicker({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-lg p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.days}
          type="button"
          disabled={disabled}
          onClick={() => onChange(r.days)}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 ${
            value === r.days ? 'bg-indigo-600/30 text-indigo-200' : 'text-slate-400 hover:text-white'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export default function RegistrationAnalytics() {
  const [days, setDays]       = useState(30);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    api.getRegistrationAnalytics(days)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load analytics'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [days]);

  if (error) {
    return (
      <div className="bg-[#111118] border border-red-500/20 rounded-2xl p-5 mb-6">
        <p className="text-sm text-red-400">Registration graphs unavailable: {error}</p>
      </div>
    );
  }

  // Keep the previous window's charts on screen while the next one loads, so
  // switching range doesn't collapse the page height and jump the scroll.
  const daily      = data?.daily ?? [];
  const dailyPts   = daily.map((d) => ({ date: d.date, value: d.count }));
  const cumPts     = daily.map((d) => ({ date: d.date, value: d.cumulative }));
  const peak       = daily.reduce((best, d) => (d.count > (best?.count ?? -1) ? d : best), null);

  return (
    <div className={`mb-6 transition-opacity ${loading && !data ? 'opacity-40' : 'opacity-100'}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Registration trends</h2>
          <p className="text-xs text-slate-500">
            {data
              ? `${(data.periodTotal ?? 0).toLocaleString('en-IN')} in the last ${data.days} days · ${(data.totalUsers ?? 0).toLocaleString('en-IN')} all time`
              : 'Loading…'}
          </p>
        </div>
        <RangePicker value={days} onChange={setDays} disabled={loading} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <ChartCard
          title="New registrations per day"
          subtitle={peak ? `Peak ${peak.count.toLocaleString('en-IN')} on ${new Date(`${peak.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : undefined}
        >
          <LineAreaChart points={dailyPts} valueLabel="registrations" />
        </ChartCard>

        <ChartCard title="Cumulative registrations" subtitle="Running total across the same window">
          <LineAreaChart points={cumPts} valueLabel="total" />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard title="Top colleges" subtitle="All time · top 10">
          <HBarChart items={data?.topColleges ?? []} emptyLabel="No college data" />
        </ChartCard>

        <ChartCard title="Top states" subtitle="All time · top 10">
          <HBarChart items={data?.topStates ?? []} emptyLabel="No state data" />
        </ChartCard>

        <ChartCard title="Year of study" subtitle="All time">
          <HBarChart
            items={(data?.byYear ?? []).map((y) => ({ label: `Year ${y.year}`, count: y.count }))}
            emptyLabel="No year data"
          />
        </ChartCard>
      </div>
    </div>
  );
}
