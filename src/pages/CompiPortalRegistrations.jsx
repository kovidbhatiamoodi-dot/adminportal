import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { ChartCard, LineAreaChart, HBarChart } from '../components/Charts';

// Registrations from the /competitions page on the CCP site — not the multicity
// ones (MulticityRegistrations.jsx), which are a different collection and shape.
// Same screen layout so the compi team finds its way around both.

// Native <option> popups are drawn by the OS and fall back to white, so both
// colours have to be set on the option itself.
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

// Genre-wise totals, participants first (a team of five is one registration and
// five people). Doubles as the filter control.
function GenreBreakdown({ genres, activeGenre, onPick }) {
  if (!genres?.length) return null;

  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
        Genre-wise breakdown
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {genres.map((g) => {
          const active = activeGenre === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onPick(active ? '' : g.id)}
              className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                active
                  ? 'border-rose-500/40 bg-rose-500/[0.08]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
              }`}
            >
              <p className={`text-sm font-medium ${active ? 'text-rose-200' : 'text-slate-200'}`}>
                {g.name}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="text-slate-300 font-semibold">{g.participants}</span>
                {' '}{g.participants === 1 ? 'participant' : 'participants'}
                <span className="text-slate-600"> · {plural(g.count, 'registration')}</span>
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Competition-wise totals, same shape as the genre cards above and a filter just
// like them. The stats' competition list ignores the competition filter itself,
// so picking one never hides the others.
function CompetitionBreakdown({ competitions, activeCompetition, onPick }) {
  if (!competitions?.length) return null;

  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
        Competition-wise breakdown
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {competitions.map((c) => {
          const active = activeCompetition === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(active ? '' : c.id)}
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
                <span className="text-slate-600"> · {plural(c.count, 'team')}</span>
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const RANGES = [
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
];

const TOP_N = 10;

// Same two lenses as the multicity graph: teams registered, or people in them.
const METRICS = [
  { key: 'registrations', label: 'Registrations', perDay: 'count', total: 'cumulative', noun: 'registrations' },
  { key: 'participants', label: 'Participants', perDay: 'participants', total: 'cumulativeParticipants', noun: 'participants' },
];

function SegmentedControl({ options, value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 ${
            value === o.value ? 'bg-rose-600/30 text-rose-200' : 'text-slate-400 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Graphs under the same filters as the list and tiles. Genre and competition
// bars come from the stats already loaded; the trend lines, colleges and team
// sizes need their own endpoint (and their own range).
function CompiAnalytics({ stats, filters }) {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState('registrations');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const { search, genre, competition } = filters;
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getGenreAnalytics(days, { search, genre, competition })
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load graphs'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days, search, genre, competition]);

  if (error) {
    return (
      <div className="bg-[#111118] border border-red-500/20 rounded-2xl p-5">
        <p className="text-sm text-red-400">Graphs unavailable: {error}</p>
      </div>
    );
  }

  const m = METRICS.find((x) => x.key === metric);
  const daily = data?.daily ?? [];
  const dailyPts = daily.map((d) => ({ date: d.date, value: d[m.perDay] }));
  const cumPts = daily.map((d) => ({ date: d.date, value: d[m.total] }));
  const peak = daily.reduce((best, d) => (d[m.perDay] > (best?.[m.perDay] ?? -1) ? d : best), null);
  const inWindow = daily.reduce((sum, d) => sum + d[m.perDay], 0);

  const genreBars = (stats?.genres ?? [])
    .map((g) => ({ label: g.name, count: g.participants }));
  const competitionBars = (stats?.competitions ?? [])
    .slice()
    .sort((a, b) => b.participants - a.participants)
    .slice(0, TOP_N)
    .map((c) => ({ label: c.name, count: c.participants }));
  const teamBars = (data?.teamSizes ?? [])
    .map((t) => ({ label: t.size === 1 ? 'Solo' : `Team of ${t.size}`, count: t.count }));

  return (
    <div className={`transition-opacity ${loading && !data ? 'opacity-40' : 'opacity-100'}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Registration trends</h2>
          <p className="text-xs text-slate-500">
            {data
              ? `${inWindow.toLocaleString('en-IN')} ${m.noun} in the last ${data.days} days`
              : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            options={METRICS.map((x) => ({ value: x.key, label: x.label }))}
            value={metric}
            onChange={setMetric}
          />
          <SegmentedControl
            options={RANGES.map((r) => ({ value: r.days, label: r.label }))}
            value={days}
            onChange={setDays}
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <ChartCard
          title={`${m.label} per day`}
          subtitle={peak && peak[m.perDay] > 0
            ? `Peak ${peak[m.perDay].toLocaleString('en-IN')} on ${new Date(`${peak.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
            : undefined}
        >
          <LineAreaChart points={dailyPts} valueLabel={m.noun} />
        </ChartCard>
        <ChartCard title={`Cumulative ${m.noun}`} subtitle="Running total across the same window">
          <LineAreaChart points={cumPts} valueLabel="total" />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Participants by genre" subtitle="Leaders plus team mates">
          <HBarChart items={genreBars} emptyLabel="No registrations yet" />
        </ChartCard>
        <ChartCard title="Top competitions" subtitle={`By participants · top ${TOP_N}`}>
          <HBarChart items={competitionBars} emptyLabel="No registrations yet" />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Top colleges" subtitle={`By registrations (team leader's college) · top ${TOP_N}`}>
          <HBarChart items={data?.topColleges ?? []} emptyLabel="No college data" />
        </ChartCard>
        <ChartCard title="Team size" subtitle="Registrations by participants per team">
          <HBarChart items={teamBars} emptyLabel="No registrations yet" />
        </ChartCard>
      </div>
    </div>
  );
}

function RegistrationCard({ registration }) {
  const members = Array.isArray(registration.members) ? registration.members : [];
  const teamSize = members.length + 1;

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
            {registration.genreName || '—'} · {plural(teamSize, 'participant')}
          </p>
        </div>
        {registration.status === 'cancelled' && (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 bg-red-500/15 text-red-400 border border-red-500/30">
            cancelled
          </span>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-rose-400 font-bold">Leader</span>
          <span className="text-sm text-slate-200">{registration.full_name || '—'}</span>
          <span className="text-xs text-slate-500">{registration.mi_no}</span>
          {registration.college && <span className="text-xs text-slate-600">· {registration.college}</span>}
          {registration.phone_no && <span className="text-xs text-slate-600">· {registration.phone_no}</span>}
        </div>

        {members.map((m, i) => (
          <div
            key={`${m.mi_no || 'member'}-${i}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
          >
            <span className="text-sm text-slate-300">{m.full_name || '—'}</span>
            <span className="text-xs text-slate-500">{m.mi_no}</span>
            {m.college && <span className="text-xs text-slate-600">· {m.college}</span>}
          </div>
        ))}
      </div>

      {registration.submission_link && (
        <p className="text-xs mb-2 truncate">
          <span className="text-slate-500">Submission: </span>
          <a
            href={registration.submission_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-300 hover:underline"
          >
            {registration.submission_link}
          </a>
        </p>
      )}

      <p className="text-xs text-slate-600">
        {registration.email || '—'} · {registeredAt}
      </p>
    </div>
  );
}

export default function CompiPortalRegistrations() {
  const [stats, setStats] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', genre: '', competition: '' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Which export is in flight, so the right button shows it is working.
  const [downloading, setDownloading] = useState('');

  // Stats ride along with the list under the same filters, so the tiles always
  // describe the rows below them.
  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.getGenreRegistrations(page, filters),
      // Stats failing is not worth blanking the list over.
      api.getGenreStats(filters).catch(() => null),
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

  // Both exports send the filters on screen — clear them first for everything.
  const runExport = async (kind) => {
    setDownloading(kind);
    const stamp = new Date().toISOString().split('T')[0];
    try {
      if (kind === 'excel') {
        const blob = await api.exportGenreRegistrationsExcel(filters);
        triggerDownload(blob, `compi_portal_participation_competition_wise_${stamp}.xlsx`);
      } else {
        const blob = await api.exportGenreRegistrations(filters);
        triggerDownload(blob, `compi_portal_registrations_${stamp}.csv`);
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setDownloading('');
    }
  };

  const hasFilters = Boolean(filters.search || filters.genre || filters.competition);
  const filterHint = hasFilters ? 'matching filters' : undefined;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatTile label="Registrations" value={stats?.registrations ?? '—'} hint={filterHint} />
        <StatTile label="Participants" value={stats?.participants ?? '—'} hint={filterHint ?? 'seats across all teams'} />
        {/* A person on two teams is two participants above but one here. */}
        <StatTile label="Unique people" value={stats?.uniqueParticipants ?? '—'} hint={filterHint ?? 'distinct MI IDs'} />
        <StatTile label="Genres" value={stats?.genreCount ?? '—'} hint={filterHint} />
        <StatTile label="Competitions" value={stats?.competitionCount ?? '—'} hint={filterHint} />
        <StatTile label="Submissions" value={stats?.submissions ?? '—'} hint={filterHint} />
      </div>

      <GenreBreakdown
        genres={stats?.genres}
        activeGenre={filters.genre}
        onPick={(genre) => applyFilter({ genre, competition: '' })}
      />

      <CompetitionBreakdown
        competitions={stats?.competitions}
        activeCompetition={filters.competition}
        onPick={(competition) => applyFilter({ competition })}
      />

      <CompiAnalytics stats={stats} filters={filters} />

      {/* Filters */}
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[240px]">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search MI ID, name, email, phone, college…"
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
          value={filters.genre}
          onChange={(e) => applyFilter({ genre: e.target.value, competition: '' })}
          className="bg-[#111118] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/40"
        >
          <option value="" className={OPTION_CLASS}>All genres</option>
          {stats?.allGenres?.map((g) => {
            const counts = stats.genres?.find((x) => x.id === g.id);
            return (
              <option key={g.id} value={g.id} className={OPTION_CLASS}>
                {g.name}{counts ? ` — ${plural(counts.participants, 'participant')} / ${plural(counts.count, 'reg')}` : ''}
              </option>
            );
          })}
        </select>

        <select
          value={filters.competition}
          onChange={(e) => applyFilter({ competition: e.target.value })}
          className="bg-[#111118] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/40"
        >
          <option value="" className={OPTION_CLASS}>All competitions</option>
          {stats?.competitions?.map((c) => (
            <option key={c.id} value={c.id} className={OPTION_CLASS}>
              {c.name} — {plural(c.participants, 'participant')} / {plural(c.count, 'reg')}
            </option>
          ))}
        </select>

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
