import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { ChartCard, LineAreaChart, HBarChart } from '../components/Charts';

const RANGES = [
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
];

const STATUSES = ['submitted', 'shortlisted', 'accepted', 'rejected'];

const STATUS_STYLES = {
  submitted:   'bg-slate-500/15 text-slate-300 border-slate-500/30',
  shortlisted: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  accepted:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected:    'bg-red-500/15 text-red-400 border-red-500/30',
};

// Native <option> popups are drawn by the OS and ignore the select's
// background, so the colours have to be set on the option itself.
const OPTION_CLASS = 'bg-[#111118] text-white';

const EMPTY_FILTERS = { search: '', status: '', category: '' };

const label = (key) => (key ? key.charAt(0).toUpperCase() + key.slice(1) : '');

const compact = (n) =>
  new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n ?? 0);

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

function StatTile({ label: text, value, hint }) {
  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl px-5 py-4">
      <p className="text-xs text-slate-500 mb-1">{text}</p>
      <p className="text-2xl font-bold text-pink-300">{value}</p>
      {hint && <p className="text-[10px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

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
            value === r.days ? 'bg-pink-600/30 text-pink-200' : 'text-slate-400 hover:text-white'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// Doubles as the status filter, so the number you click is the number the list
// then shows. Every status is rendered even at zero.
function StatusFilter({ counts, active, onPick }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((status) => {
        const isActive = active === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onPick(isActive ? '' : status)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium capitalize transition-colors ${
              isActive
                ? 'border-pink-500/40 bg-pink-500/[0.12] text-pink-200'
                : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12]'
            }`}
          >
            {status}
            <span className="ml-2 text-slate-500">{counts?.[status] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function InfluencerRegistrations() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  // Stats load with the list and under the same filters, so the tiles never
  // describe the whole collection while the table shows one category.
  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.getInfluencerRegistrations(page, filters),
      // Stats failing is not worth blanking the list over.
      api.getInfluencerStats(filters, days).catch(() => null),
    ])
      .then(([data, nextStats]) => {
        setRows(data.registrations ?? []);
        setTotalDocs(data.totalDocs ?? 0);
        setTotalPages(data.totalPages ?? 1);
        if (nextStats) setStats(nextStats);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, filters, days]);

  useEffect(load, [load]);

  const applyFilter = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    applyFilter({ search: searchInput });
  };

  // Updated in place, so the reviewer keeps their scroll position; the chips
  // refresh quietly because the counts just changed.
  const changeStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      const { registration } = await api.updateInfluencerStatus(id, status);
      setRows((prev) => prev.map((r) => (r._id === id ? { ...r, status: registration.status } : r)));
      api.getInfluencerStats(filters, days).then(setStats).catch(() => {});
    } catch (err) {
      alert('Could not update status: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const runExport = async () => {
    setDownloading(true);
    try {
      const blob = await api.exportInfluencerRegistrations(filters);
      triggerDownload(blob, `mi_creator_registrations_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const hasFilters = Boolean(filters.search || filters.status || filters.category);
  const filterHint = hasFilters ? 'matching filters' : undefined;

  const daily = stats?.daily ?? [];
  const dailyPts = daily.map((d) => ({ date: d.date, value: d.count }));
  const cumPts = daily.map((d) => ({ date: d.date, value: d.cumulative }));

  return (
    <div className="space-y-6">
      <div className="bg-pink-500/[0.06] border border-pink-500/20 rounded-2xl px-5 py-3">
        <p className="text-xs text-pink-200/90">
          Creators who registered on the <span className="font-semibold">MI Creator portal</span>.
          Review their profile and reach, then move each one through shortlisted, accepted or
          rejected. Once a creator is shortlisted, accepted or rejected they can no longer edit
          their own details.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Registrations" value={stats?.total ?? '—'} hint={filterHint} />
        <StatTile
          label="Instagram reach"
          value={stats ? compact(stats.instagramFollowers) : '—'}
          hint="combined followers"
        />
        <StatTile
          label="Verified accounts"
          value={stats?.instagramVerified ?? '—'}
          hint="Instagram confirmed"
        />
        <StatTile label="Accepted" value={stats?.statusCounts?.accepted ?? '—'} hint="across all filters" />
      </div>

      {/* Trend */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Registrations per day</h2>
            <p className="text-xs text-slate-500">
              {stats
                ? `${stats.periodTotal.toLocaleString('en-IN')} in the last ${stats.days} days · days cut at IST midnight`
                : 'Loading…'}
            </p>
          </div>
          <RangePicker value={days} onChange={setDays} disabled={loading} />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ChartCard title="New registrations per day">
            <LineAreaChart points={dailyPts} valueLabel="registrations" />
          </ChartCard>
          <ChartCard title="Cumulative registrations" subtitle="Running total across the same window">
            <LineAreaChart points={cumPts} valueLabel="total" />
          </ChartCard>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <ChartCard title="Creator type" subtitle="What they create">
            <HBarChart
              items={(stats?.categories ?? []).map((c) => ({ label: label(c.name), count: c.count }))}
              emptyLabel="No data"
            />
          </ChartCard>
          <ChartCard title="Top cities" subtitle="Top 10">
            <HBarChart
              items={(stats?.cities ?? []).map((c) => ({ label: c.name, count: c.count }))}
              emptyLabel="No city data"
            />
          </ChartCard>
          <ChartCard title="Top colleges" subtitle="Top 10">
            <HBarChart
              items={(stats?.colleges ?? []).map((c) => ({ label: c.name, count: c.count }))}
              emptyLabel="No college data"
            />
          </ChartCard>
        </div>
      </div>

      <StatusFilter counts={stats?.statusCounts} active={filters.status} onPick={(status) => applyFilter({ status })} />

      {/* Filters */}
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[240px]">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, phone, Instagram, city, college…"
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500/40"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-pink-600/20 border border-pink-500/30 text-pink-300 text-sm font-medium hover:bg-pink-600/30 transition-colors"
          >
            Search
          </button>
        </form>

        <select
          value={filters.category}
          onChange={(e) => applyFilter({ category: e.target.value })}
          className="bg-[#111118] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500/40 max-w-[220px]"
        >
          <option value="" className={OPTION_CLASS}>All creator types</option>
          {(stats?.categories ?? []).map((c) => (
            <option key={c.name} value={c.name} className={OPTION_CLASS}>
              {label(c.name)} — {c.count}
            </option>
          ))}
        </select>

        <button
          onClick={runExport}
          disabled={downloading}
          title="Flat CSV — one row per creator, with contact details and reach"
          className="px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
        >
          {downloading ? 'Preparing…' : 'Export CSV'}
        </button>

        {hasFilters && (
          <button
            onClick={() => {
              setSearchInput('');
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
            className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm font-medium hover:bg-white/[0.08] transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading registrations…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500 text-sm">No registrations match these filters.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            Showing {rows.length} of {totalDocs}
          </p>

          <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-x-auto">
            <table className="w-full text-sm min-w-[1150px]">
              <thead>
                <tr className="border-b border-white/[0.07] text-left">
                  {['Creator', 'Contact', 'City · College', 'Instagram', 'YouTube', 'Type', 'Status', 'Registered'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r._id}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors align-top"
                  >
                    <td className="px-4 py-3">
                      <p className="text-slate-200 font-medium">{r.name || '—'}</p>
                      {r.mi_no && <p className="text-xs text-slate-500">{r.mi_no}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-400 break-all">{r.email || '—'}</p>
                      <p className="text-xs text-slate-500">{r.phone || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-[220px]">
                      <p>{r.city || '—'}</p>
                      {r.college && <p className="text-slate-600">{r.college}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {r.instagram?.handle ? (
                        <a
                          href={`https://instagram.com/${r.instagram.handle}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-pink-300 hover:text-pink-200 underline underline-offset-2"
                        >
                          @{r.instagram.handle}
                        </a>
                      ) : (
                        '—'
                      )}
                      <p className="text-slate-500 mt-0.5">
                        {r.instagram?.followers != null
                          ? `${r.instagram.followers.toLocaleString('en-IN')} followers`
                          : 'followers unknown'}
                        {r.instagram?.verified && <span className="ml-1.5 text-emerald-400">✓ verified</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {r.youtube?.handle || '—'}
                      {r.youtube?.subscribers != null && (
                        <p className="text-slate-500 mt-0.5">
                          {r.youtube.subscribers.toLocaleString('en-IN')} subs
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 capitalize">
                      {r.category === 'other' && r.category_other ? `Other · ${r.category_other}` : r.category}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={r.status || 'submitted'}
                        disabled={updatingId === r._id}
                        onChange={(e) => changeStatus(r._id, e.target.value)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize cursor-pointer focus:outline-none disabled:opacity-50 ${
                          STATUS_STYLES[r.status] ?? STATUS_STYLES.submitted
                        }`}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status} className={OPTION_CLASS}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 disabled:opacity-40 hover:bg-white/[0.08] transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 disabled:opacity-40 hover:bg-white/[0.08] transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
