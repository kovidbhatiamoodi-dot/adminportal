import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { ChartCard, LineAreaChart, HBarChart } from '../components/Charts';

const RANGES = [
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
];

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });

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
            value === r.days ? 'bg-amber-600/30 text-amber-200' : 'text-slate-400 hover:text-white'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// Per-day applications plus the usual breakdowns. Follows the same filters as
// the list below, so picking a college redraws the trend for that college.
function ApplicationTrends({ stats, days, onDays, loading }) {
  const daily = stats?.daily ?? [];
  const dailyPts = daily.map((d) => ({ date: d.date, value: d.count }));
  const cumPts = daily.map((d) => ({ date: d.date, value: d.cumulative }));
  const peak = daily.reduce((best, d) => (d.count > (best?.count ?? -1) ? d : best), null);
  const today = daily[daily.length - 1]?.count ?? 0;
  const avg = daily.length ? (stats.periodTotal / daily.length).toFixed(1) : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Applications per day</h2>
          <p className="text-xs text-slate-500">
            {stats
              ? `${stats.periodTotal.toLocaleString('en-IN')} in the last ${stats.days} days · days cut at IST midnight`
              : 'Loading…'}
          </p>
        </div>
        <RangePicker value={days} onChange={onDays} disabled={loading} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Today" value={stats ? today : '—'} />
        <StatTile label="Avg / day" value={avg} hint={`last ${stats?.days ?? days} days`} />
        <StatTile
          label="Peak day"
          value={peak ? peak.count : '—'}
          hint={peak ? shortDate(peak.date) : undefined}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="New applications per day">
          <LineAreaChart points={dailyPts} valueLabel="applications" />
        </ChartCard>
        <ChartCard title="Cumulative applications" subtitle="Running total across the same window">
          <LineAreaChart points={cumPts} valueLabel="total" />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard title="Top colleges" subtitle="Top 10">
          <HBarChart
            items={(stats?.colleges ?? []).slice(0, 10).map((c) => ({ label: c.name, count: c.count }))}
            emptyLabel="No college data"
          />
        </ChartCard>
        <ChartCard title="Top cities" subtitle="Top 10">
          <HBarChart
            items={(stats?.cities ?? []).map((c) => ({ label: c.name, count: c.count }))}
            emptyLabel="No city data"
          />
        </ChartCard>
        <ChartCard title="Year of study">
          <HBarChart
            items={(stats?.years ?? []).map((y) => ({
              label: y.year == null ? 'Unknown' : `Year ${y.year}`,
              count: y.count,
            }))}
            emptyLabel="No year data"
          />
        </ChartCard>
      </div>
    </div>
  );
}

// Native <option> popups are drawn by the OS and ignore the select's
// background, so the colours have to be set on the option itself — same reason
// as MulticityRegistrations.
const OPTION_CLASS = 'bg-[#111118] text-white';

// Amber throughout, to sit apart from the indigo CCP pages and the rose
// multicity ones — this is a third thing again, and easy to mistake for the
// "PR Approvals" queue at a glance.
const STATUSES = ['submitted', 'shortlisted', 'accepted', 'rejected'];

const STATUS_STYLES = {
  submitted:   'bg-slate-500/15 text-slate-300 border-slate-500/30',
  shortlisted: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  accepted:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected:    'bg-red-500/15 text-red-400 border-red-500/30',
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

function StatTile({ label, value, hint }) {
  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl px-5 py-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-amber-300">{value}</p>
      {hint && <p className="text-[10px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

// Doubles as the status filter, so the number you click is the number the list
// then shows. Every status is rendered even at zero — a chip that vanished
// would make "nobody rejected yet" look like the status does not exist.
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
                ? 'border-amber-500/40 bg-amber-500/[0.12] text-amber-200'
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

// Top colleges, as a filter control rather than a directory — the backend caps
// the list, because a national fest has a long tail of one-applicant colleges.
function CollegeBreakdown({ colleges, activeCollege, onPick }) {
  if (!colleges?.length) return null;

  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
        College-wise breakdown
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {colleges.map((c) => {
          const active = activeCollege === c.name;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => onPick(active ? '' : c.name)}
              className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                active
                  ? 'border-amber-500/40 bg-amber-500/[0.08]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
              }`}
            >
              <p className={`text-sm font-medium truncate ${active ? 'text-amber-200' : 'text-slate-200'}`}>
                {c.name}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="text-slate-300 font-semibold">{c.count}</span>
                {' '}{c.count === 1 ? 'applicant' : 'applicants'}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ClApplications() {
  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', status: '', college: '' });

  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  // Stats are fetched with the list and under the same filters, never once on
  // mount — otherwise the tiles describe the whole collection while the list
  // below them describes one college.
  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.getClApplications(page, filters),
      // Stats failing is not worth blanking the list over: the previous numbers
      // stay on screen and the applications still render.
      api.getClApplicationStats(filters, days).catch(() => null),
    ])
      .then(([data, nextStats]) => {
        setApplications(data.applications ?? []);
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

  const toggleExpanded = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // The one write here. The row is updated in place rather than reloading the
  // page of results, so the reviewer keeps their scroll position; the tiles
  // are refreshed quietly because the status counts just changed.
  const changeStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      const { application } = await api.updateClApplicationStatus(id, status);
      setApplications((prev) => prev.map((a) => (a._id === id ? { ...a, status: application.status } : a)));
      api.getClApplicationStats(filters, days).then(setStats).catch(() => {});
    } catch (err) {
      alert('Could not update status: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Sends the filters that are on screen, not the whole collection — the
  // filters are usually the point of the export. Clear them to get everything.
  const runExport = async () => {
    setDownloading(true);
    try {
      const blob = await api.exportClApplications(filters);
      const stamp = new Date().toISOString().split('T')[0];
      triggerDownload(blob, `contingent_leader_applications_${stamp}.csv`);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const hasFilters = Boolean(filters.search || filters.status || filters.college);
  const filterHint = hasFilters ? 'matching filters' : undefined;

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl px-5 py-3">
        <p className="text-xs text-amber-200/90">
          Applications submitted from the <span className="font-semibold">Contingent Leader portal</span>.
          Read each applicant&apos;s motivation and college ID, then move them through
          shortlisted, accepted or rejected — only the application&apos;s status changes, never the
          student&apos;s CCP account.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Applications" value={stats?.applications ?? '—'} hint={filterHint} />
        <StatTile label="Colleges" value={stats?.collegeCount ?? '—'} hint={filterHint} />
        <StatTile label="Cities" value={stats?.cityCount ?? '—'} hint={filterHint} />
        <StatTile
          label="Accepted"
          value={stats?.statusCounts?.accepted ?? '—'}
          hint="across all filters"
        />
      </div>

      <ApplicationTrends stats={stats} days={days} onDays={setDays} loading={loading} />

      <StatusFilter
        counts={stats?.statusCounts}
        active={filters.status}
        onPick={(status) => applyFilter({ status })}
      />

      <CollegeBreakdown
        colleges={stats?.colleges}
        activeCollege={filters.college}
        onPick={(college) => applyFilter({ college })}
      />

      {/* Filters */}
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[240px]">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search MI ID, name, email, phone, college, city…"
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-600/30 transition-colors"
          >
            Search
          </button>
        </form>

        <select
          value={filters.college}
          onChange={(e) => applyFilter({ college: e.target.value })}
          className="bg-[#111118] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/40 max-w-[260px]"
        >
          <option value="" className={OPTION_CLASS}>All colleges</option>
          {stats?.colleges?.map((c) => (
            <option key={c.name} value={c.name} className={OPTION_CLASS}>
              {c.name} — {c.count}
            </option>
          ))}
        </select>

        <button
          onClick={runExport}
          disabled={downloading}
          title="Flat CSV — one row per applicant, with motivation and ID link"
          className="px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
        >
          {downloading ? 'Preparing…' : 'Export CSV'}
        </button>

        {hasFilters && (
          <button
            onClick={() => {
              setSearchInput('');
              setFilters({ search: '', status: '', college: '' });
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
        <p className="text-slate-500 text-sm">Loading applications…</p>
      ) : applications.length === 0 ? (
        <p className="text-slate-500 text-sm">No applications match these filters.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            Showing {applications.length} of {totalDocs}
          </p>

          {/* One applicant per row — unlike a multicity registration there is
              no nested team here, so a table beats cards for density. It
              scrolls inside its own container so the page never scrolls
              sideways on a narrow screen. */}
          <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
                <tr className="border-b border-white/[0.07] text-left">
                  {['Applicant', 'Contact', 'College', 'City', 'Year', 'College ID', 'Motivation', 'Status', 'Applied'].map((h) => (
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
                {applications.map((a) => (
                  <tr
                    key={a._id}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-slate-200 font-medium">{a.full_name || '—'}</p>
                      <p className="text-xs text-slate-500">{a.mi_no}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-400">{a.email || '—'}</p>
                      <p className="text-xs text-slate-500">{a.phone_no || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-[220px]">
                      {a.college || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {a.city || '—'}
                      {a.state ? <span className="text-slate-600"> · {a.state}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {a.year_of_study ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {a.college_id_link ? (
                        <a
                          href={a.college_id_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-300 hover:text-amber-200 underline underline-offset-2"
                        >
                          Open ID
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-[320px] align-top">
                      {a.motivation ? (
                        <>
                          <p className="whitespace-pre-wrap break-words">
                            {expanded.has(a._id) || a.motivation.length <= 160
                              ? a.motivation
                              : `${a.motivation.slice(0, 160)}…`}
                          </p>
                          {a.motivation.length > 160 && (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(a._id)}
                              className="mt-1 text-amber-300 hover:text-amber-200"
                            >
                              {expanded.has(a._id) ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={a.status || 'submitted'}
                        disabled={updatingId === a._id}
                        onChange={(e) => changeStatus(a._id, e.target.value)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize cursor-pointer focus:outline-none disabled:opacity-50 ${
                          STATUS_STYLES[a.status] ?? STATUS_STYLES.submitted
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
                      {formatDate(a.createdAt)}
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
