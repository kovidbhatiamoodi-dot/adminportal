import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Threads from './pages/Threads';
import Sidebar from './components/Sidebar';
import { api } from './api';

export default function App() {
  const [authed, setAuthed]         = useState(false);
  const [adminUser, setAdminUser]   = useState('');
  const [activePage, setActivePage] = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(0);
  const [checking, setChecking]     = useState(true);

  // On mount: check if a stored token is still valid by hitting /stats
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { setChecking(false); return; }
    api.getStats()
      .then(() => { setAuthed(true); setAdminUser('MI Admin'); })
      .catch(() => { localStorage.removeItem('admin_token'); })
      .finally(() => setChecking(false));
  }, []);

  // Fetch pending thread count for sidebar badge
  useEffect(() => {
    if (!authed) return;
    api.getAllThreads(1, 'pending')
      .then((data) => setPendingCount(data.totalDocs ?? 0))
      .catch(() => {});
  }, [authed]);

  const handleLogin = (username) => {
    setAuthed(true);
    setAdminUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setAuthed(false);
    setAdminUser('');
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

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Ambient glow */}
      <div className="fixed top-[-10%] left-[20%] w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none z-0" />

      <Sidebar
        active={activePage}
        setActive={setActivePage}
        onLogout={handleLogout}
        pendingCount={pendingCount}
      />

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen relative z-10">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-white capitalize">
              {activePage === 'dashboard' ? '📊 Dashboard' : activePage === 'users' ? '👥 Registrations' : '💬 Thread Moderation'}
            </h2>
            <p className="text-xs text-slate-500">CCP 2026 · Moodi Indigo Admin</p>
          </div>
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">Live</span>
          </div>
        </div>

        {/* Page content */}
        <div className="px-8 py-8">
          {activePage === 'dashboard' && <Dashboard />}
          {activePage === 'users' && <Dashboard />}
          {activePage === 'threads' && (
            <Threads onPendingCountChange={setPendingCount} />
          )}
        </div>
      </main>
    </div>
  );
}
