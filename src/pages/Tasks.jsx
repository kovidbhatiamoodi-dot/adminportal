import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const TYPE_STYLES = {
  standard: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
  referral: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
};

const LINK_TYPE_LABELS = {
  drive: 'Google Drive',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

const emptyForm = {
  title: '',
  description: '',
  points: 0,
  pointsDiffCollege: 0,
  club: '',
  pinned: false,
  type: 'standard',
  requiresLink: false,
  linkType: 'drive',
};

function CreateTaskForm({ genres, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const task = await api.createTask({
        title: form.title.trim(),
        description: form.description.trim(),
        points: Number(form.points) || 0,
        points_diff_college: form.type === 'referral' ? Number(form.pointsDiffCollege) || 0 : 0,
        club: form.club || null,
        pinned: form.pinned,
        type: form.type,
        requiresLink: form.type === 'referral' ? false : form.requiresLink,
        linkType: form.linkType,
      });
      onCreated(task);
      setForm(emptyForm);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        id="new-task-btn"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2.5 rounded-xl transition-colors font-medium shrink-0"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New Task
      </button>
    );
  }

  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-white">New Task</h2>
        <button
          onClick={() => { setOpen(false); setForm(emptyForm); setError(''); }}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Share on Instagram Story"
              className="w-full bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              autoFocus
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Optional details shown to the student"
              rows={2}
              className="w-full bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
            />
          </div>

          {form.type === 'referral' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Points — Same College</label>
                <input
                  type="number"
                  min="0"
                  value={form.points}
                  onChange={(e) => update('points', e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Points — Different College</label>
                <input
                  type="number"
                  min="0"
                  value={form.pointsDiffCollege}
                  onChange={(e) => update('pointsDiffCollege', e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Points</label>
              <input
                type="number"
                min="0"
                value={form.points}
                onChange={(e) => update('points', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Type</label>
            <select
              value={form.type}
              onChange={(e) => update('type', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            >
              <option value="standard" className="bg-[#111118]">Standard</option>
              <option value="referral" className="bg-[#111118]">Referral</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Genre / Club</label>
            <select
              value={form.club}
              onChange={(e) => update('club', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            >
              <option value="" className="bg-[#111118]">None (global)</option>
              {genres.map((g) => (
                <option key={g._id} value={g._id} className="bg-[#111118]">{g.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="pinned"
              checked={form.pinned}
              onChange={(e) => update('pinned', e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-indigo-600"
            />
            <label htmlFor="pinned" className="text-sm text-slate-300">Pin to top of page</label>
          </div>

          {form.type !== 'referral' && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requiresLink"
                  checked={form.requiresLink}
                  onChange={(e) => update('requiresLink', e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-indigo-600"
                />
                <label htmlFor="requiresLink" className="text-sm text-slate-300">Require proof link submission</label>
              </div>

              {form.requiresLink && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Link type</label>
                  <select
                    value={form.linkType}
                    onChange={(e) => update('linkType', e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  >
                    {Object.entries(LINK_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value} className="bg-[#111118]">{label}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => { setOpen(false); setForm(emptyForm); setError(''); }}
            className="px-4 py-2 text-xs rounded-xl border border-white/10 text-slate-400 hover:bg-white/[0.05] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && (
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [taskData, genreData] = await Promise.all([api.getTasks(), api.getTaskGenres()]);
      setTasks(taskData);
      setGenres(genreData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreated = (task) => {
    // The create response has a raw club ObjectId, not the populated
    // { name, slug } the list view expects — resolve it from the loaded genres.
    const club = genres.find((g) => g._id === task.club) || null;
    setTasks((prev) => [{ ...task, club }, ...prev]);
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Delete task "${task.title}"? This cannot be undone.`)) return;
    setDeletingId(task._id);
    try {
      await api.deleteTask(task._id);
      setTasks((prev) => prev.filter((t) => t._id !== task._id));
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-[Outfit]">Tasks</h1>
          <p className="text-slate-400 text-sm mt-1">Create and manage tasks students can complete for points</p>
        </div>
        <CreateTaskForm genres={genres} onCreated={handleCreated} />
      </div>

      {/* List */}
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07]">
          <h2 className="text-base font-semibold text-white">All Tasks</h2>
          <p className="text-slate-500 text-xs mt-0.5">{tasks.length} task{tasks.length === 1 ? '' : 's'}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-7 h-7 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-400 text-sm">{error}</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">No tasks yet — create the first one above</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {['Title', 'Genre', 'Type', 'Points', 'Pinned', 'Submission', ''].map((col) => (
                    <th key={col} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap first:pl-6 last:pr-6">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {tasks.map((task) => (
                  <tr key={task._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3 pl-6">
                      <p className="text-white font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-slate-500 text-xs mt-0.5 max-w-xs truncate">{task.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{task.club?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLES[task.type] ?? TYPE_STYLES.standard}`}>
                        {task.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-indigo-300 text-sm font-semibold tabular-nums">
                      {task.type === 'referral'
                        ? `${task.points} / ${task.points_diff_college ?? 0}`
                        : task.points}
                    </td>
                    <td className="px-4 py-3">
                      {task.pinned ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">Pinned</span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {task.requiresLink ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          {LINK_TYPE_LABELS[task.linkType] ?? LINK_TYPE_LABELS.drive}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 pr-6 text-right">
                      <button
                        onClick={() => handleDelete(task)}
                        disabled={deletingId === task._id}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1.5 disabled:opacity-50"
                        title="Delete task"
                      >
                        {deletingId === task._id ? (
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
