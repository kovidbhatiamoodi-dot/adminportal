import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

// Native <option> popups are drawn by the OS, not by the page — they ignore the
// select's background and fall back to white, so the inherited white text was
// invisible. Both colours have to be set on the option itself.
const OPTION_CLASS = 'bg-[#111118] text-white';

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

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
      <p className="text-2xl font-bold text-rose-300">{value}</p>
      {hint && <p className="text-[10px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

// City-wise totals, participants first. The dropdown only ever had a
// registration count, which reads as "slots filled" and undercounts every team
// event — a 12-person Desi Beats entry is one registration and twelve people to
// seat. Doubles as the filter control, so the number you click is the number
// the list then shows.
function CityBreakdown({ cities, activeCity, onPick }) {
  if (!cities?.length) return null;

  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
        City-wise breakdown
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((c) => {
          const active = activeCity === c.name;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => onPick(active ? '' : c.name)}
              className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                active
                  ? 'border-rose-500/40 bg-rose-500/[0.08]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
              }`}
            >
              <p className={`text-sm font-medium ${active ? 'text-rose-200' : 'text-slate-200'}`}>
                {c.name}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="text-slate-300 font-semibold">{c.participants}</span>
                {' '}{c.participants === 1 ? 'participant' : 'participants'}
                <span className="text-slate-600"> · {plural(c.count, 'registration')}</span>
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RegistrationCard({ registration }) {
  const members = Array.isArray(registration.members) ? registration.members : [];
  // The leader is flagged on the row rather than being first by position, so
  // read the flag — a registration created by the older backend has them in an
  // arbitrary order.
  const leader = members.find((m) => m.isLeader);
  const others = members.filter((m) => !m.isLeader);

  const registeredAt = registration.createdAt
    ? new Date(registration.createdAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-5 hover:border-white/[0.12] transition-all duration-200">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-white font-semibold">{registration.competitionName || '—'}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {registration.cityName || '—'}
            {registration.competitionType ? ` · ${registration.competitionType}` : ''}
            {' · '}
            {members.length} {members.length === 1 ? 'participant' : 'participants'}
          </p>
        </div>
        {/* Every registration is "confirmed" — nothing in any service sets it
            to anything else — so a badge on every card is noise. It appears
            only when the value is unexpected, which is when it means something. */}
        {registration.status && registration.status !== 'confirmed' && (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 bg-red-500/15 text-red-400 border border-red-500/30">
            {registration.status}
          </span>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {leader && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-400 font-bold">Leader</span>
            <span className="text-sm text-slate-200">{leader.name || '—'}</span>
            <span className="text-xs text-slate-500">{leader.miId}</span>
            {leader.college && <span className="text-xs text-slate-600">· {leader.college}</span>}
            {leader.phone && <span className="text-xs text-slate-600">· {leader.phone}</span>}
          </div>
        )}

        {others.map((m, i) => (
          <div
            key={`${m.miId || 'member'}-${i}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
          >
            <span className="text-sm text-slate-300">{m.name || '—'}</span>
            <span className="text-xs text-slate-500">{m.miId}</span>
            {m.college && <span className="text-xs text-slate-600">· {m.college}</span>}
            {m.phone && <span className="text-xs text-slate-600">· {m.phone}</span>}
          </div>
        ))}

        {members.length === 0 && (
          <p className="text-xs text-amber-400">
            No members recorded on this registration.
          </p>
        )}
      </div>

      <p className="text-xs text-slate-600">
        {registration.registeredEmail || '—'} · {registeredAt}
      </p>
    </div>
  );
}

export default function MulticityRegistrations() {
  const [stats, setStats] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  // No status filter: nothing in any service ever writes a status other than
  // "confirmed", so filtering on it could only ever return everything or
  // nothing. The API still accepts the param if that changes.
  const [filters, setFilters] = useState({ search: '', city: '', competition: '' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Which export is in flight, not a boolean — there are two buttons now, and a
  // shared flag would grey out both and give no clue which one is working.
  const [downloading, setDownloading] = useState('');

  // Stats are fetched with the list and under the same filters, not once on
  // mount. Fetched once, they described the whole collection while the list
  // below them described one city — so a city reading "9" opened onto a single
  // registration. They cannot drift now: same filters, same request.
  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.getCompiRegistrations(page, filters),
      // Stats failing is not worth blanking the list over — the previous
      // numbers stay on screen and the registrations still render.
      api.getCompiStats(filters).catch(() => null),
    ])
      .then(([data, nextStats]) => {
        setRegistrations(data.registrations ?? []);
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
  };

  const handleSearch = (e) => {
    e.preventDefault();
    applyFilter({ search: searchInput });
  };

  // Both exports send the filters that are on screen, not the whole collection
  // — the filters are usually the point of the export (one city, one
  // competition). Clearing them first is how you get everything.
  const runExport = async (kind) => {
    setDownloading(kind);
    const stamp = new Date().toISOString().split('T')[0];
    try {
      if (kind === 'excel') {
        const blob = await api.exportCompiRegistrationsExcel(filters);
        triggerDownload(blob, `multicity_participation_competition_wise_${stamp}.xlsx`);
      } else {
        const blob = await api.exportCompiRegistrations(filters);
        triggerDownload(blob, `multicity_registrations_${stamp}.csv`);
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setDownloading('');
    }
  };

  const hasFilters = Boolean(filters.search || filters.city || filters.competition);
  const filterHint = hasFilters ? 'matching filters' : undefined;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Registrations" value={stats?.registrations ?? '—'} hint={filterHint} />
        <StatTile label="Participants" value={stats?.participants ?? '—'} hint={filterHint} />
        {/* Distinct cities/competitions among the rows in view, which is not
            the length of the breakdown lists below: those keep every option
            listed so the filter stays changeable. */}
        <StatTile label="Cities" value={stats?.cityCount ?? '—'} hint={filterHint} />
        <StatTile label="Competitions" value={stats?.competitionCount ?? '—'} hint={filterHint} />
      </div>

      <CityBreakdown
        cities={stats?.cities}
        activeCity={filters.city}
        onPick={(city) => applyFilter({ city })}
      />

      {/* Filters */}
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[240px]">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search MI ID, name, college, city, competition…"
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/40"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-300 text-sm font-medium hover:bg-rose-600/30 transition-colors"
          >
            Search
          </button>
        </form>

        <select
          value={filters.city}
          onChange={(e) => applyFilter({ city: e.target.value })}
          className="bg-[#111118] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/40"
        >
          <option value="" className={OPTION_CLASS}>All cities</option>
          {stats?.cities?.map((c) => (
            <option key={c.name} value={c.name} className={OPTION_CLASS}>
              {c.name} — {plural(c.participants, 'participant')} / {plural(c.count, 'reg')}
            </option>
          ))}
        </select>

        <select
          value={filters.competition}
          onChange={(e) => applyFilter({ competition: e.target.value })}
          className="bg-[#111118] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/40"
        >
          <option value="" className={OPTION_CLASS}>All competitions</option>
          {stats?.competitions?.map((c) => (
            <option key={c.name} value={c.name} className={OPTION_CLASS}>
              {c.name} — {plural(c.participants, 'participant')} / {plural(c.count, 'reg')}
            </option>
          ))}
        </select>

        {/* The Excel export is the one people actually want for handing each
            competition its own roster, so it leads and the flat CSV sits next
            to it as the raw-data option. */}
        <button
          onClick={() => runExport('excel')}
          disabled={Boolean(downloading)}
          title="Excel workbook — one sheet per competition, plus a summary sheet"
          className="px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
        >
          {downloading === 'excel' ? 'Building workbook…' : 'Download Excel (competition-wise)'}
        </button>

        <button
          onClick={() => runExport('csv')}
          disabled={Boolean(downloading)}
          title="Flat CSV — one row per participant"
          className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm font-medium hover:bg-white/[0.08] transition-colors disabled:opacity-50"
        >
          {downloading === 'csv' ? 'Preparing…' : 'Export CSV'}
        </button>
      </div>

      {/* Results */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading registrations…</p>
      ) : registrations.length === 0 ? (
        <p className="text-slate-500 text-sm">No registrations match these filters.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            Showing {registrations.length} of {totalDocs}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {registrations.map((r) => (
              <RegistrationCard key={r._id} registration={r} />
            ))}
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
