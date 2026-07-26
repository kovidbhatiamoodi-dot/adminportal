import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const STATUS_STYLES = {
  pending:  'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border border-red-500/30',
};

function SubmissionCard({ submission, onStatusChange }) {
  const [loading, setLoading] = useState('');

  const handleAction = async (status) => {
    setLoading(status);
    try {
      await api.updateTaskSubmissionStatus(submission._id, status);
      onStatusChange(submission._id, status);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading('');
    }
  };

  const createdAt = new Date(submission.createdAt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-white/[0.12] transition-all duration-200">
      <div className="p-5">
        {/* Task + Status */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-xs text-slate-500 font-medium">{submission.task?.title ?? 'Unknown Task'}</span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLES[submission.status]}`}>
            {submission.status}
          </span>
        </div>

        {/* Points */}
        <p className="text-indigo-300 text-lg font-bold mb-3">{submission.task?.points ?? 0} pts</p>

        {/* Link */}
        {submission.link ? (
          <a
            href={submission.link}
            target="_blank"
            rel="noreferrer"
            className="block truncate rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-sky-300 hover:bg-white/[0.08] transition-colors mb-4"
          >
            {submission.link}
          </a>
        ) : (
          <p className="text-slate-600 text-xs mb-4">No link submitted (not required for this task)</p>
        )}

        {/* Submitter */}
        <div className="flex items-center gap-2 mb-4">
          <img
            src={submission.user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${submission.user?.full_name}`}
            alt={submission.user?.full_name}
            className="w-6 h-6 rounded-full object-cover border border-white/10"
          />
          <div>
            <p className="text-xs text-slate-300 font-medium">{submission.user?.full_name}</p>
            <p className="text-xs text-slate-600">{submission.user?.mi_no} · {createdAt}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {submission.status !== 'approved' && (
            <button
              onClick={() => handleAction('approved')}
              disabled={loading === 'approved'}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl py-2 text-xs font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'approved' ? (
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              )}
              Approve
            </button>
          )}
          {submission.status !== 'rejected' && (
            <button
              onClick={() => handleAction('rejected')}
              disabled={loading === 'rejected'}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-xl py-2 text-xs font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'rejected' ? (
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              )}
              Reject
            </button>
          )}
          {(submission.status === 'approved' || submission.status === 'rejected') && (
            <button
              onClick={() => handleAction('pending')}
              disabled={loading === 'pending'}
              className="flex-1 flex items-center justify-center gap-1.5 bg-slate-500/15 hover:bg-slate-500/25 text-slate-400 border border-slate-500/30 rounded-xl py-2 text-xs font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset to Pending
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TaskSubmissions({ onPendingCountChange }) {
  const [submissions, setSubmissions] = useState([]);
  const [totalDocs, setTotal]     = useState(0);
  const [totalPages, setPages]    = useState(1);
  const [page, setPage]           = useState(1);
  const [filter, setFilter]       = useState('pending');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTaskSubmissions(page, filter);
      setSubmissions(data.submissions);
      setTotal(data.totalDocs);
      setPages(data.totalPages);
      if (filter === 'pending' && onPendingCountChange) {
        onPendingCountChange(data.totalDocs);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filter, onPendingCountChange]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const handleStatusChange = (submissionId, newStatus) => {
    setSubmissions((prev) =>
      prev.map((s) => (s._id === submissionId ? { ...s, status: newStatus } : s))
    );
    if (filter === 'pending') {
      setTotal((n) => Math.max(0, n - 1));
      if (onPendingCountChange) onPendingCountChange(Math.max(0, totalDocs - 1));
    }
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
        <h1 className="text-2xl font-bold text-white font-[Outfit]">Task Submissions</h1>
        <p className="text-slate-400 text-sm mt-1">Review Drive links / completions and award points on approval</p>
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
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-400 text-sm bg-red-500/5 border border-red-500/20 rounded-2xl">{error}</div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-sm">No {filter || ''} submissions found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {submissions.map((submission) => (
              <SubmissionCard key={submission._id} submission={submission} onStatusChange={handleStatusChange} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">Page {page} of {totalPages} · {totalDocs} submissions</p>
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
