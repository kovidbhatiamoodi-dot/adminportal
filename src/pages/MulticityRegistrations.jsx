import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

// Native <option> popups are drawn by the OS, not by the page — they ignore the
// select's background and fall back to white, so the inherited white text was
// invisible. Both colours have to be set on the option itself.
const OPTION_CLASS = 'bg-[#111118] text-white';

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

function StatTile({ label, value }) {
  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl px-5 py-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-rose-300">{value}</p>
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
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.getCompiStats().then(setStats).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .getCompiRegistrations(page, filters)
      .then((data) => {
        setRegistrations(data.registrations ?? []);
        setTotalDocs(data.totalDocs ?? 0);
        setTotalPages(data.totalPages ?? 1);
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

  const handleExport = async () => {
    setDownloading(true);
    try {
      // Exports what is currently filtered, not the whole collection — the
      // filters are usually the point of the export (one city, one competition).
      const blob = await api.exportCompiRegistrations(filters);
      triggerDownload(
        blob,
        `multicity_registrations_${new Date().toISOString().split('T')[0]}.csv`
      );
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Registrations" value={stats?.registrations ?? '—'} />
        <StatTile label="Participants" value={stats?.participants ?? '—'} />
        <StatTile label="Cities" value={stats?.cities?.length ?? '—'} />
        <StatTile label="Competitions" value={stats?.competitions?.length ?? '—'} />
      </div>

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
              {c.name} ({c.count})
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
              {c.name} ({c.count})
            </option>
          ))}
        </select>

        <button
          onClick={handleExport}
          disabled={downloading}
          className="px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
        >
          {downloading ? 'Preparing…' : 'Export CSV'}
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
