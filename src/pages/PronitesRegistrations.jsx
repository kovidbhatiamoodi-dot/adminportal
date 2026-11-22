import { useEffect, useState, useCallback, Fragment } from 'react';
import { api } from '../api';
import { ChartCard, HBarChart } from '../components/Charts';

// Registrations from livewire.moodi.org and soulstrings.moodi.org. Read-only:
// the rows are written by the Livewire/Soulstrings service, not by CCP.

const EVENTS = { livewire: 'Livewire', soulstrings: 'Soulstrings' };
const ROUNDS = {
  mumbai_offline: 'Mumbai · Offline · 5 Dec',
  goa_offline: 'Goa · Offline · 6 Dec',
  online: 'Online · till 5 Dec',
};

const EVENT_STYLES = {
  livewire: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  soulstrings: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
};

// Native <option> popups are drawn by the OS and ignore the select's
// background, so the colours have to be set on the option itself.
const OPTION_CLASS = 'bg-[#111118] text-white';

const EMPTY_FILTERS = { search: '', event: '', round: '' };

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
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

function StatTile({ label, value, hint }) {
  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl px-5 py-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-violet-300">{value}</p>
      {hint && <p className="text-[10px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

// Competition x round counts. Clicking a cell filters the list to it, clicking
// it again clears it, so the number you click is the number the table shows.
function RoundMatrix({ stats, filters, onPick }) {
  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="border-b border-white/[0.07] text-left">
            <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Competition</th>
            {Object.entries(ROUNDS).map(([key, label]) => (
              <th key={key} className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold whitespace-nowrap">
                {label}
              </th>
            ))}
            <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(EVENTS).map(([event, name]) => {
            const row = stats?.byEvent?.[event];
            return (
              <tr key={event} className="border-b border-white/[0.04] last:border-0">
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${EVENT_STYLES[event]}`}>{name}</span>
                </td>
                {Object.keys(ROUNDS).map((round) => {
                  const active = filters.event === event && filters.round === round;
                  return (
                    <td key={round} className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => onPick(active ? { event: '', round: '' } : { event, round })}
                        className={`w-full text-left px-3 py-1.5 rounded-xl border text-sm font-semibold transition-colors ${
                          active
                            ? 'border-violet-500/40 bg-violet-500/[0.12] text-violet-200'
                            : 'border-white/[0.06] bg-white/[0.02] text-slate-300 hover:border-white/[0.12]'
                        }`}
                      >
                        {row?.rounds?.[round] ?? 0}
                      </button>
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-slate-200 font-semibold">{row?.total ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PronitesRegistrations() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [openId, setOpenId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.getPronitesRegistrations(page, filters),
      // Stats failing is not worth blanking the list over.
      api.getPronitesStats(filters).catch(() => null),
    ])
      .then(([data, nextStats]) => {
        setRows(data.registrations ?? []);
        setTotalDocs(data.totalDocs ?? 0);
        setTotalPages(data.totalPages ?? 1);
        if (nextStats) setStats(nextStats);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(load, [load]);

  const applyFilter = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
    setOpenId(null);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    applyFilter({ search: searchInput });
  };

  const runExport = async () => {
    setDownloading(true);
    try {
      const blob = await api.exportPronitesRegistrations(filters);
      const scope = [filters.event || 'all', filters.round || 'all-rounds'].join('_');
      triggerDownload(blob, `livewire-soulstrings_${scope}_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const hasFilters = Boolean(filters.search || filters.event || filters.round);
  const onlineTotal =
    (stats?.byEvent?.livewire?.rounds?.online ?? 0) + (stats?.byEvent?.soulstrings?.rounds?.online ?? 0);

  return (
    <div className="space-y-6">
      <div className="bg-violet-500/[0.06] border border-violet-500/20 rounded-2xl px-5 py-3">
        <p className="text-xs text-violet-200/90">
          Registrations from <span className="font-semibold">livewire.moodi.org</span> and{' '}
          <span className="font-semibold">soulstrings.moodi.org</span>. Offline rounds (Mumbai, Goa) are
          registrations only; the online round includes the Google Drive video link (Livewire max 10 min,
          Soulstrings max 5 min). Click a count to filter, then Export CSV for that slice.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total registrations" value={stats?.total ?? '—'} hint={filters.search ? 'matching search' : undefined} />
        <StatTile label="Livewire" value={stats?.byEvent?.livewire?.total ?? '—'} hint="bands" />
        <StatTile label="Soulstrings" value={stats?.byEvent?.soulstrings?.total ?? '—'} hint="singer-songwriters" />
        <StatTile label="Online video entries" value={stats ? onlineTotal : '—'} hint="both competitions" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <RoundMatrix stats={stats} filters={filters} onPick={applyFilter} />
        </div>
        <ChartCard title="Top cities" subtitle="Top 10, all rounds">
          <HBarChart
            items={(stats?.cities ?? []).map((c) => ({ label: c.name, count: c.count }))}
            emptyLabel="No registrations yet"
          />
        </ChartCard>
      </div>

      {/* Filters */}
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[240px]">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search reg ID, band / artist, name, phone, email, city…"
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-600/30 transition-colors"
          >
            Search
          </button>
        </form>

        <select
          value={filters.event}
          onChange={(e) => applyFilter({ event: e.target.value })}
          className="bg-[#111118] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40"
        >
          <option value="" className={OPTION_CLASS}>Both competitions</option>
          {Object.entries(EVENTS).map(([key, name]) => (
            <option key={key} value={key} className={OPTION_CLASS}>{name}</option>
          ))}
        </select>

        <select
          value={filters.round}
          onChange={(e) => applyFilter({ round: e.target.value })}
          className="bg-[#111118] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40"
        >
          <option value="" className={OPTION_CLASS}>All rounds</option>
          {Object.entries(ROUNDS).map(([key, name]) => (
            <option key={key} value={key} className={OPTION_CLASS}>{name}</option>
          ))}
        </select>

        <button
          onClick={runExport}
          disabled={downloading}
          title="CSV of the rows matching the current filters"
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

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading registrations…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500 text-sm">No registrations match these filters.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            Showing {rows.length} of {totalDocs} · click a row for member names, music links and achievements
          </p>

          <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="border-b border-white/[0.07] text-left">
                  {['Reg ID', 'Band / Artist', 'Contact', 'City · Genre', 'Lineup', 'Round', 'Video', 'Registered'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = openId === r._id;
                  return (
                    <Fragment key={r._id}>
                      <tr
                        onClick={() => setOpenId(open ? null : r._id)}
                        className={`border-b border-white/[0.04] cursor-pointer transition-colors align-top ${
                          open ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-slate-300 whitespace-nowrap">{r.regId || '—'}</p>
                          <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${EVENT_STYLES[r.event] ?? ''}`}>
                            {EVENTS[r.event] ?? r.event}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-200 font-medium">{r.actName || '—'}</p>
                          <p className="text-xs text-slate-500">{r.contactName || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-300 whitespace-nowrap">{r.phone || '—'}</p>
                          {r.backupPhone && <p className="text-xs text-slate-500 whitespace-nowrap">alt {r.backupPhone}</p>}
                          <p className="text-xs text-slate-500 break-all">{r.email || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          <p>{r.city || '—'}</p>
                          {r.genre && <p className="text-slate-600">{r.genre}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {r.event === 'livewire'
                            ? `${r.memberCount ?? '—'} members`
                            : r.instruments || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{ROUNDS[r.round] ?? r.round}</td>
                        <td className="px-4 py-3 text-xs">
                          {r.submissionLink ? (
                            <a
                              href={r.submissionLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-violet-300 hover:text-violet-200 underline underline-offset-2"
                            >
                              Open Drive
                            </a>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                          {r.songTitle && <p className="text-slate-500 mt-0.5">{r.songTitle}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                      </tr>
                      {open && (
                        <tr className="border-b border-white/[0.04] bg-white/[0.03]">
                          <td colSpan={8} className="px-6 pb-4 pt-1">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                                  {r.event === 'livewire' ? 'Members & instruments' : 'Instruments'}
                                </p>
                                <p className="text-slate-300 whitespace-pre-wrap">
                                  {(r.event === 'livewire' ? r.memberNames : r.instruments) || '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Original music links</p>
                                <p className="text-slate-300 whitespace-pre-wrap break-all">{r.musicLinks || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Past achievements</p>
                                <p className="text-slate-300 whitespace-pre-wrap">{r.pastAchievements || '—'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
