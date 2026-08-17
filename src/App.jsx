import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Threads from './pages/Threads';
import Tasks from './pages/Tasks';
import TaskSubmissions from './pages/TaskSubmissions';
import PrApprovals from './pages/PrApprovals';
import Sidebar from './components/Sidebar';
import { api } from './api';

// Which pages each role may open. This mirrors the role checks in the
// backend's admin.routes.js — it is not the security boundary. A coordinator
// who forces `activePage` to 'users' gets an empty table and a 403 from every
// request behind it; the server is what actually refuses.
const PAGES_BY_ROLE = {
  admin: ['dashboard', 'users', 'threads', 'tasks', 'submissions', 'pr'],
  coordinator: ['submissions'],
};

const PAGE_TITLES = {
  dashboard:   '📊 Dashboard',
  users:       '👥 Registrations',
  tasks:       '✅ Tasks',
  submissions: '📥 Task Submissions',
  pr:          '⭐ PR Approvals',
  threads:     '💬 Thread Moderation',
};

export default function App() {
  const [authed, setAuthed]         = useState(false);
  const [adminUser, setAdminUser]   = useState('');
  const [role, setRole]             = useState('admin');
  const [activePage, setActivePage] = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingSubmissionsCount, setPendingSubmissionsCount] = useState(0);
  const [pendingPrCount, setPendingPrCount] = useState(0);
  const [checking, setChecking]     = useState(true);

  const allowedPages = PAGES_BY_ROLE[role] ?? PAGES_BY_ROLE.coordinator;
  const isAdmin = role === 'admin';

  const applySession = (nextRole, username) => {
    setRole(nextRole);
    setAdminUser(username);
    setAuthed(true);
    setActivePage((PAGES_BY_ROLE[nextRole] ?? PAGES_BY_ROLE.coordinator)[0]);
  };

  // On mount: revalidate the stored token against /me, which also tells us
  // which role it carries — the token is the source of truth for that, never
  // anything else in localStorage.
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { setChecking(false); return; }
    api.getMe()
      .then((data) => applySession(data.role, data.username))
      .catch(() => { localStorage.removeItem('admin_token'); })
      .finally(() => setChecking(false));
  }, []);

  // Sidebar badges. Coordinators may only call the submissions endpoint, so
  // the admin-only counts are not fetched for them — they would 403 and log
  // noise on every sign-in.
  useEffect(() => {
    if (!authed) return;
    api.getTaskSubmissions(1, 'pending')
      .then((data) => setPendingSubmissionsCount(data.totalDocs ?? 0))
      .catch(() => {});
  }, [authed]);

  useEffect(() => {
    if (!authed || !isAdmin) return;
    api.getAllThreads(1, 'pending')
      .then((data) => setPendingCount(data.totalDocs ?? 0))
      .catch(() => {});
    api.getPrCandidates(1, 'pending')
      .then((data) => setPendingPrCount(data.totalDocs ?? 0))
      .catch(() => {});
  }, [authed, isAdmin]);

  const handleLogin = (data) => {
    localStorage.setItem('admin_token', data.token);
    applySession(data.role, data.username);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setAuthed(false);
    setAdminUser('');
    setRole('admin');
    setActivePage('dashboard');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    );
  }

  if (!authed) return <Login onLogin={handleLogin} />;

  // A page outside the role's list can only be reached by tampering; fall back
  // to the role's home rather than rendering a panel of failed requests.
  const page = allowedPages.includes(activePage) ? activePage : allowedPages[0];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Ambient glow */}
      <div className="fixed top-[-10%] left-[20%] w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none z-0" />

      <Sidebar
        active={page}
        setActive={setActivePage}
        onLogout={handleLogout}
        allowedPages={allowedPages}
        role={role}
        username={adminUser}
        pendingCount={pendingCount}
        pendingSubmissionsCount={pendingSubmissionsCount}
        pendingPrCount={pendingPrCount}
      />

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen relative z-10">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-white capitalize">
              {PAGE_TITLES[page] ?? PAGE_TITLES.submissions}
            </h2>
            <p className="text-xs text-slate-500">
              CCP 2026 · Moodi Indigo {isAdmin ? 'Admin' : 'Coordinator'}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">Live</span>
          </div>
        </div>

        {/* Page content */}
        <div className="px-8 py-8">
          {page === 'dashboard' && <Dashboard />}
          {page === 'users' && <Dashboard />}
          {page === 'tasks' && <Tasks />}
          {page === 'submissions' && (
            <TaskSubmissions onPendingCountChange={setPendingSubmissionsCount} />
          )}
          {page === 'pr' && (
            <PrApprovals onPendingCountChange={setPendingPrCount} />
          )}
          {page === 'threads' && (
            <Threads onPendingCountChange={setPendingCount} />
          )}
        </div>
      </main>
    </div>
  );
}
