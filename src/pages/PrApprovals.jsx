import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const STATUS_STYLES = {
  pending:  'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border border-red-500/30',
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

function Spinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CandidateCard({ candidate, threshold, onStatusChange }) {
  const [loading, setLoading] = useState('');

  const handleAction = async (status) => {
    // Approving is what sends the congratulations email and unlocks the card,
    // so make the admin confirm rather than fire on a stray click.
    if (status === 'approved' &&
        !window.confirm(`Approve ${candidate.full_name} as a PR Representative?\n\nThis unlocks their PR ID card and sends the congratulations email.`)) {
      return;
    }

    setLoading(status);
    try {
      await api.updatePrStatus(candidate._id, status);
      onStatusChange(candidate._id, status);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-white/[0.12] transition-all duration-200">
      <div className="p-5">
        {/* Points + status */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-xs text-slate-500 font-medium">
            Threshold {threshold.toLocaleString()} pts
          </span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLES[candidate.pr_status]}`}>
            {candidate.pr_status}
          </span>
        </div>

        <p className="text-indigo-300 text-2xl font-bold mb-4">
          {(candidate.totalpoints ?? 0).toLocaleString()} <span className="text-sm font-medium text-slate-500">pts</span>
        </p>

        {/* Student */}
        <div className="flex items-center gap-2.5 mb-4">
          <img
            src={candidate.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${candidate.full_name}`}
            alt={candidate.full_name}
            className="w-8 h-8 rounded-full object-cover border border-white/10"
          />
          <div className="min-w-0">
            <p className="text-sm text-slate-200 font-medium truncate">{candidate.full_name}</p>
            <p className="text-xs text-slate-600 truncate">{candidate.mi_no} · {candidate.email}</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 mb-4 space-y-1">
          <p className="text-xs text-slate-500 truncate">{candidate.college || 'College not set'}</p>
          <p className="text-xs text-slate-600">Crossed on {formatDate(candidate.pr_qualified_at)}</p>
          {candidate.pr_approved_at && (
            <p className="text-xs text-emerald-600/80">Approved on {formatDate(candidate.pr_approved_at)}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {candidate.pr_status !== 'approved' && (
            <button
              onClick={() => handleAction('approved')}
              disabled={!!loading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl py-2 text-xs font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'approved' ? <Spinner /> : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              Approve as PR
            </button>
          )}
          {candidate.pr_status !== 'rejected' && (
            <button
              onClick={() => handleAction('rejected')}
              disabled={!!loading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-xl py-2 text-xs font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'rejected' ? <Spinner /> : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              Reject
            </button>
          )}
          {candidate.pr_status !== 'pending' && (
            <button
              onClick={() => handleAction('pending')}
              disabled={!!loading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-slate-500/15 hover:bg-slate-500/25 text-slate-400 border border-slate-500/30 rounded-xl py-2 text-xs font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'pending' ? <Spinner /> : null}
              Reset to Pending
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PrApprovals({ onPendingCountChange }) {
  const [candidates, setCandidates] = useState([]);
  const [threshold, setThreshold]   = useState(3000);
  const [totalDocs, setTotal]       = useState(0);
  const [totalPages, setPages]      = useState(1);
  const [page, setPage]             = useState(1);
  const [filter, setFilter]         = useState('pending');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getPrCandidates(page, filter);
      setCandidates(data.candidates);
      setTotal(data.totalDocs);
      setPages(data.totalPages);
      if (data.threshold) setThreshold(data.threshold);
      if (filter === 'pending' && onPendingCountChange) {
        onPendingCountChange(data.totalDocs);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filter, onPendingCountChange]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const handleStatusChange = (userId, newStatus) => {
    // Once reviewed, the card no longer belongs in the list being filtered on,
    // so drop it rather than leaving a stale row behind.
    if (filter && newStatus !== filter) {
      setCandidates((prev) => prev.filter((c) => c._id !== userId));
      setTotal((n) => Math.max(0, n - 1));
      if (filter === 'pending' && onPendingCountChange) {
        onPendingCountChange(Math.max(0, totalDocs - 1));
      }
      return;
    }
    setCandidates((prev) =>
      prev.map((c) => (c._id === userId ? { ...c, pr_status: newStatus } : c))
    );
  };

  const tabs = [
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: '' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white font-[Outfit]">PR Representative Approvals</h1>
        <p className="text-slate-400 text-sm mt-1">
          Students who crossed {threshold.toLocaleString()} points. Approving unlocks their PR ID card,
          changes their profile title, shows the congratulations banner and sends the promotion email.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setFilter(tab.value); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              filter === tab.value
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white border border-white/[0.07]'
            }`}
          >
            {tab.label}
            {tab.value === 'pending' && totalDocs > 0 && filter === 'pending' && (
              <span className="ml-2 bg-amber-500 text-black text-xs font-bold rounded-full px-1.5 py-0.5">
                {totalDocs}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-400 text-sm bg-red-500/5 border border-red-500/20 rounded-2xl">{error}</div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <p className="text-sm">No {filter || ''} PR candidates yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate._id}
                candidate={candidate}
                threshold={threshold}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">Page {page} of {totalPages} · {totalDocs} candidates</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >← Prev</button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
