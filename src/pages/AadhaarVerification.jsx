import { Fragment, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api';

const PAGE_SIZE = 50;

// Doubles as the status filter, same idea as the other registration pages: the
// number you click is the number the list then shows.
const FILTERS = [
  { id: 'all',         label: 'Everyone',         stat: 'total' },
  { id: 'verified',    label: 'Verified',         stat: 'verified',    tone: 'emerald' },
  { id: 'pending',     label: 'Not verified yet', stat: null,          tone: 'amber' },
  { id: 'mismatched',  label: 'Tried, not matched', stat: 'mismatched', tone: 'red' },
  { id: 'logged_in',   label: 'Logged in, no Aadhaar', stat: 'logged_in', tone: 'sky' },
  { id: 'not_started', label: 'Not started',      stat: 'not_started', tone: 'slate' },
];

const TONES = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  amber:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
  sky:     'bg-sky-500/15 text-sky-300 border-sky-500/30',
  slate:   'bg-slate-500/15 text-slate-300 border-slate-500/30',
  red:     'bg-red-500/15 text-red-300 border-red-500/30',
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

// What differed: CCP account vs the Aadhaar, mismatched details in red.
function Comparison({ attempt }) {
  const fields = [
    { key: 'name', label: 'Name' },
    { key: 'dob', label: 'Date of birth' },
  ];
  const bad = attempt.mismatched ?? [];
  return (
    <table className="text-xs w-full max-w-xl">
      <thead>
        <tr className="text-slate-500 text-left">
          <th className="pr-4 py-1 font-medium">Detail</th>
          <th className="pr-4 py-1 font-medium">On CCP</th>
          <th className="pr-4 py-1 font-medium">On Aadhaar</th>
          <th className="py-1 font-medium" />
        </tr>
      </thead>
      <tbody>
        {fields.map((f) => {
          const mismatch = bad.includes(f.key);
          return (
            <tr key={f.key} className={mismatch ? 'text-red-300' : 'text-slate-300'}>
              <td className="pr-4 py-1">{f.label}</td>
              <td className="pr-4 py-1">{attempt.ccp?.[f.key] || '—'}</td>
              <td className="pr-4 py-1">{attempt.aadhaar?.[f.key] || '—'}</td>
              <td className="py-1 font-semibold">{mismatch ? 'Not matched' : ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AttemptHistory({ email }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.getAadhaarAttempts(email)
      .then((d) => alive && setItems(d.items ?? []))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [email]);

  if (error) return <p className="text-xs text-red-300">{error}</p>;
  if (!items) return <p className="text-xs text-slate-500 animate-pulse">Loading attempts…</p>;
  if (items.length === 0) return <p className="text-xs text-slate-500">No failed attempts.</p>;

  return (
    <div className="space-y-4">
      {items.map((a) => (
        <div key={a.at} className="border-l-2 border-red-500/40 pl-3">
          <p className="text-xs text-slate-400 mb-1">
            {formatDate(a.at)} — {a.reason || a.verdict}
          </p>
          <Comparison attempt={a} />
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ row }) {
  if (row.verified) return <span className={`px-2 py-0.5 rounded-lg border text-xs ${TONES.emerald}`}>Verified</span>;
  if (row.failed_attempts > 0) {
    return (
      <span className={`px-2 py-0.5 rounded-lg border text-xs ${TONES.red}`}>
        Not matched · {row.failed_attempts} {row.failed_attempts === 1 ? 'try' : 'tries'}
      </span>
    );
  }
  if (row.logged_in_at) return <span className={`px-2 py-0.5 rounded-lg border text-xs ${TONES.sky}`}>Logged in, no Aadhaar yet</span>;
  return <span className={`px-2 py-0.5 rounded-lg border text-xs ${TONES.slate}`}>Not started</span>;
}

export default function AadhaarVerification() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [openEmail, setOpenEmail] = useState('');
  const fileRef = useRef(null);

  const loadStats = useCallback(() => {
    api.getAadhaarStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  const loadRows = useCallback(() => {
    setLoading(true);
    api
      .getAadhaarEmails({ q: query, status, skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE })
      .then((data) => {
        setRows(data.items ?? []);
        setTotal(data.total ?? 0);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query, status, page]);

  useEffect(loadStats, [loadStats]);
  useEffect(loadRows, [loadRows]);

  // Debounced search so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setQuery(search); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const refresh = () => { loadStats(); loadRows(); };

  const onUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('upload'); setError(''); setNotice('');
    try {
      const r = await api.uploadAadhaarEmails(file);
      setNotice(`${r.added} added, ${r.skipped} already on the list (${r.found} addresses found in the file).`);
      setPage(1);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const onRemove = async (email) => {
    if (!window.confirm(`Remove ${email} from the eligible list?`)) return;
    try {
      await api.removeAadhaarEmail(email);
      refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const onExport = async () => {
    setBusy('export'); setError('');
    try {
      triggerDownload(await api.exportAadhaarProgress(status), 'aadhaar-verification.csv');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const onSync = async () => {
    setBusy('sync'); setError(''); setNotice('');
    try {
      const r = await api.syncAadhaarWithHaven();
      setNotice(
        r.pending === 0
          ? 'Every pass is already in Haven.'
          : `Haven sync: ${r.synced} sent, ${r.failed} failed${r.error ? ` (${r.error})` : ''}.`
      );
      loadStats();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const countFor = (f) =>
    f.stat ? stats?.[f.stat] : stats ? stats.total - stats.verified : undefined;

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.xlsx"
          onChange={onUpload}
          className="hidden"
        />
        <button
          type="button"
          disabled={busy === 'upload'}
          onClick={() => fileRef.current?.click()}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium"
        >
          {busy === 'upload' ? 'Uploading…' : 'Upload email list'}
        </button>
        <button
          type="button"
          disabled={busy === 'export'}
          onClick={onExport}
          className="px-4 py-2 rounded-xl border border-white/[0.1] text-slate-300 hover:bg-white/[0.05] disabled:opacity-50 text-sm"
        >
          {busy === 'export' ? 'Preparing…' : 'Export CSV'}
        </button>
        {stats?.unsynced > 0 && (
          <button
            type="button"
            disabled={busy === 'sync'}
            onClick={onSync}
            className="px-4 py-2 rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50 text-sm"
          >
            {busy === 'sync' ? 'Syncing…' : `Sync ${stats.unsynced} pass${stats.unsynced === 1 ? '' : 'es'} with Haven`}
          </button>
        )}
        <p className="text-xs text-slate-500">
          CSV, TXT or XLSX — every email address in the file is added. Only people on this list can verify.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm px-4 py-3">{notice}</div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-4 py-3">{error}</div>
      )}

      {/* Filters with counts */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = status === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => { setStatus(f.id); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                active
                  ? 'border-indigo-500/40 bg-indigo-500/[0.12] text-indigo-200'
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12]'
              }`}
            >
              {f.label}
              <span className="ml-2 text-slate-500">{countFor(f) ?? '…'}</span>
            </button>
          );
        })}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search email…"
        className="w-full max-w-sm px-4 py-2 rounded-xl bg-[#111118] border border-white/[0.07] text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500/50"
      />

      {/* Table */}
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-white/[0.06]">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Name (CCP)</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Verified at</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.email}>
                  <tr className="border-b border-white/[0.04] last:border-0 text-slate-300">
                    <td className="px-4 py-2.5">{row.email}</td>
                    <td className="px-4 py-2.5"><StatusBadge row={row} /></td>
                    <td className="px-4 py-2.5">{row.name || '—'}</td>
                    <td className="px-4 py-2.5">{row.age ?? '—'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(row.verified_at)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {row.failed_attempts > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpenEmail(openEmail === row.email ? '' : row.email)}
                          className="text-xs text-indigo-300 hover:text-indigo-200 mr-3"
                        >
                          {openEmail === row.email ? 'Hide details' : 'What differed?'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemove(row.email)}
                        className="text-xs text-slate-500 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                  {openEmail === row.email && (
                    <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                      <td colSpan={6} className="px-4 py-4">
                        <AttemptHistory email={row.email} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {total === 0 && status === 'all' && !query ? 'No emails yet. Upload a list to get started.' : 'Nothing matches.'}
                  </td>
                </tr>
              )}
              {loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600 animate-pulse">Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>{total} people · page {page} of {pages}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-white/[0.08] disabled:opacity-40 hover:bg-white/[0.05]"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-white/[0.08] disabled:opacity-40 hover:bg-white/[0.05]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
