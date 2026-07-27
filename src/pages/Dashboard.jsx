import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api';
import StatCard from '../components/StatCard';

// ─── CSV helpers (for current-page download) ─────────────────────────────────
const CSV_FIELDS = [
  { key: 'mi_no',            label: 'MI No' },
  { key: 'full_name',        label: 'Full Name' },
  { key: 'email',            label: 'Email' },
  { key: 'phone_no',         label: 'Phone' },
  { key: 'gender',           label: 'Gender' },
  { key: 'dob',              label: 'Date of Birth' },
  { key: 'city',             label: 'City' },
  { key: 'state',            label: 'State' },
  { key: 'pincode',          label: 'Pincode' },
  { key: 'college',          label: 'College' },
  { key: 'stream',           label: 'Stream' },
  { key: 'year_of_study',    label: 'Year of Study' },
  { key: 'por',              label: 'Position of Responsibility' },
  { key: 'totalpoints',      label: 'Total Points' },
  { key: 'referral_code',    label: 'Referral Code' },
  { key: 'referred_by',      label: 'Referred By' },
  { key: 'instagram_handle', label: 'Instagram' },
  { key: 'createdAt',        label: 'Registered At' },
];

const escapeCSV = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
};

const buildCSV = (users) => {
  const header = CSV_FIELDS.map((f) => f.label).join(',');
  const rows = users.map((u) =>
    CSV_FIELDS.map((f) => {
      const val = u[f.key];
      if (f.key === 'dob' || f.key === 'createdAt') {
        return escapeCSV(val ? new Date(val).toISOString().split('T')[0] : '');
      }
      if (f.key === 'referred_by') {
        return escapeCSV(val ? `${val.full_name} (${val.mi_no})` : '');
      }
      return escapeCSV(val);
    }).join(',')
  );
  return '\uFEFF' + [header, ...rows].join('\r\n'); // BOM for Excel
};

const triggerDownload = (content, filename, type = 'text/csv;charset=utf-8;') => {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Inline Points Editor ─────────────────────────────────────────────────────
function PointsEditor({ user, onPointsUpdated }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(user.totalpoints ?? 0);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updatePoints(user._id, val);
      onPointsUpdated(user._id, val);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          className="w-20 bg-[#1a1a27] border border-indigo-500/50 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        />
        <button onClick={handleSave} disabled={saving} className="text-emerald-400 hover:text-emerald-300 transition-colors p-1" title="Save">
          {saving ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          )}
        </button>
        <button onClick={() => setEditing(false)} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Cancel">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setVal(user.totalpoints ?? 0); setEditing(true); }}
      className={`flex items-center gap-1.5 text-sm font-semibold transition-colors group ${saved ? 'text-emerald-400' : 'text-indigo-300 hover:text-indigo-200'}`}
      title="Click to edit points"
    >
      {saved ? '✓ Saved' : <span className="tabular-nums">{user.totalpoints ?? 0}</span>}
      {!saved && (
        <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
        </svg>
      )}
    </button>
  );
}

// ─── Registrations on a specific date ────────────────────────────────────────
function RegistrationsByDate() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!date) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.getRegistrationsByDate(date);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl px-6 py-4">
      <h2 className="text-base font-semibold text-white mb-1">Registrations on a Date</h2>
      <p className="text-slate-500 text-xs mb-3">Pick any date to see how many users registered that day</p>

      <form onSubmit={handleCheck} className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          max={todayStr}
          onChange={(e) => setDate(e.target.value)}
          className="bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 [color-scheme:dark]"
        />
        <button type="submit" disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Checking...' : 'Check'}
        </button>

        {error && <span className="text-red-400 text-xs">{error}</span>}
        {result && !error && (
          <span className="text-sm text-slate-300">
            <span className="text-white font-semibold">{result.count}</span> registration{result.count === 1 ? '' : 's'} on{' '}
            <span className="text-white font-medium">
              {new Date(`${result.date}T00:00:00.000Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </span>
        )}
      </form>
    </div>
  );
}

// ─── Points Log Modal ─────────────────────────────────────────────────────────
function PointsLogModal({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getUserPointsLog(userId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[#111118] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-white font-semibold text-sm">
              {data?.user ? `${data.user.full_name} — Points Log` : 'Points Log'}
            </h3>
            {data?.user && (
              <p className="text-slate-500 text-xs mt-0.5">{data.user.mi_no} · Total: {data.user.totalpoints}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1" title="Close">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-400 text-sm">{error}</div>
          ) : !data?.logs?.length ? (
            <div className="text-center py-12 text-slate-500 text-sm">No points activity yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {['Change', 'Reason', 'Source', 'Date'].map((col) => (
                    <th key={col} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-2 whitespace-nowrap first:pl-5 last:pr-5">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.logs.map((log) => (
                  <tr key={log._id}>
                    <td className={`px-4 py-2 pl-5 text-xs font-semibold tabular-nums whitespace-nowrap ${log.change_amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {log.change_amount >= 0 ? '+' : ''}{log.change_amount}
                    </td>
                    <td className="px-4 py-2 text-slate-300 text-xs max-w-[160px] truncate" title={log.reason}>{log.reason}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs whitespace-nowrap">{log.source}</td>
                    <td className="px-4 py-2 pr-5 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const PAGE_SIZE = 20; // max 20 per page for performance

export default function Dashboard() {
  const [stats, setStats]         = useState(null);
  const [users, setUsers]         = useState([]);
  const [totalDocs, setTotal]     = useState(0);
  const [totalPages, setPages]    = useState(1);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [dlPageLoading, setDlPage] = useState(false);
  const [dlAllLoading, setDlAll]   = useState(false);
  const [logUserId, setLogUserId] = useState(null);

  const fetchStats = useCallback(async () => {
    try { setStats(await api.getStats()); } catch {}
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getUsers(page, PAGE_SIZE, search);
      setUsers(data.users);
      setTotal(data.totalDocs);
      setPages(data.totalPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Update points locally after inline edit (avoids refetch)
  const handlePointsUpdated = useCallback((userId, newPoints) => {
    setUsers((prev) =>
      prev.map((u) => (u._id === userId ? { ...u, totalpoints: newPoints } : u))
    );
  }, []);

  // Download current page
  const handleDownloadPage = () => {
    setDlPage(true);
    try {
      const csv = buildCSV(users);
      triggerDownload(csv, `ccp_registrations_page${page}.csv`);
    } finally {
      setDlPage(false);
    }
  };

  // Download ALL registrations (from backend)
  const handleDownloadAll = async () => {
    setDlAll(true);
    try {
      const blob = await api.exportAllUsers();
      triggerDownload(blob, `ccp_registrations_ALL_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setDlAll(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const genderBadge = (g) => ({
    Male: 'bg-blue-500/15 text-blue-300', Female: 'bg-pink-500/15 text-pink-300', Other: 'bg-purple-500/15 text-purple-300'
  }[g] || 'bg-slate-500/15 text-slate-300');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white font-[Outfit]">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Overview of all CCP 2026 registrations and activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Registrations" value={stats?.totalUsers} color="indigo" sub="All time"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
        />
        <StatCard label="New (Last 24 Hours)" value={stats?.registrationsLast24h} color="emerald" sub="Rolling 24h"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <StatCard label="New (Last 7 Days)" value={stats?.recentRegistrations} color="emerald" sub="Rolling 7 days"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>}
        />
        <StatCard label="New (Last 30 Days)" value={stats?.registrationsLast30Days} color="emerald" sub="Rolling 30 days"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
        />
        <StatCard label="Pending Threads" value={stats?.threads?.pending} color="amber" sub="Awaiting review"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <StatCard label="Approved Threads" value={stats?.threads?.approved} color="pink" sub={`${stats?.threads?.total ?? 0} total`}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
      </div>

      {/* Registrations on a specific date */}
      <RegistrationsByDate />

      {/* Users Table */}
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden">

        {/* Table toolbar */}
        <div className="px-6 py-4 border-b border-white/[0.07] flex flex-col gap-3">
          {/* Row 1: Title + Download Buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Registered Users</h2>
              <p className="text-slate-500 text-xs mt-0.5">
                Showing {users.length} of {totalDocs} · Page {page}/{totalPages} · {PAGE_SIZE}/page
              </p>
            </div>

            {/* Download buttons */}
            <div className="flex gap-2 shrink-0">
              {/* Download current page */}
              <button
                id="download-page-btn"
                onClick={handleDownloadPage}
                disabled={dlPageLoading || users.length === 0}
                title="Download current page as CSV"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border border-indigo-500/40 text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                </svg>
                Download Page
              </button>

              {/* Download all */}
              <button
                id="download-all-btn"
                onClick={handleDownloadAll}
                disabled={dlAllLoading}
                title="Download all registrations as CSV"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {dlAllLoading ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                )}
                {dlAllLoading ? 'Exporting...' : `Download All (${totalDocs})`}
              </button>
            </div>
          </div>

          {/* Row 2: Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, email, MI No, college..."
                className="w-full bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-xl transition-colors font-medium">
              Search
            </button>
            {search && (
              <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
                className="text-slate-400 hover:text-white text-sm px-3 py-2 rounded-xl border border-white/10 hover:bg-white/[0.05] transition-colors">
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin w-7 h-7 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : error ? (
            <div className="text-center py-16 text-red-400 text-sm">{error}</div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">No users found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {['#', 'MI No', 'Name', 'Email', 'Phone', 'College', 'POR', 'State', 'Yr', 'Gender', 'Points', 'Referred By', 'Joined'].map((col) => (
                    <th key={col} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap first:pl-6 last:pr-6">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {users.map((user, idx) => (
                  <tr key={user._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3 pl-6 text-slate-600 text-xs tabular-nums">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-indigo-300 whitespace-nowrap">{user.mi_no}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.full_name)}`}
                          alt={user.full_name}
                          className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/10"
                        />
                        <span className="text-white font-medium whitespace-nowrap">{user.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">{user.email}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{user.phone_no}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs max-w-[140px] truncate" title={user.college}>{user.college}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[120px] truncate" title={user.por}>{user.por || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{user.state}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs text-center">{user.year_of_study}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${genderBadge(user.gender)}`}>{user.gender}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <PointsEditor user={user} onPointsUpdated={handlePointsUpdated} />
                        <button
                          onClick={() => setLogUserId(user._id)}
                          className="text-slate-500 hover:text-indigo-300 transition-colors p-1"
                          title="View points log"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h4M9 17H7a2 2 0 01-2-2V5a2 2 0 012-2h6l4 4v3M9 17v4l3-3m-3 3l-3-3"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {user.referred_by ? (
                        <span title={user.referred_by.referral_code}>
                          {user.referred_by.full_name}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 pr-6 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/[0.07] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-500">Page <span className="text-white font-medium">{page}</span> of {totalPages}</p>
              {/* Page number pills */}
              <div className="hidden sm:flex gap-1 ml-2">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 7) pageNum = i + 1;
                  else if (page <= 4) pageNum = i + 1;
                  else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                  else pageNum = page - 3 + i;
                  if (pageNum < 1 || pageNum > totalPages) return null;
                  return (
                    <button key={pageNum} onClick={() => setPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${pageNum === page ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'}`}>
                      {pageNum}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                «
              </button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                ← Prev
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Next →
              </button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {logUserId && (
        <PointsLogModal userId={logUserId} onClose={() => setLogUserId(null)} />
      )}
    </div>
  );
}
