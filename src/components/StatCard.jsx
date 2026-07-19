export default function StatCard({ label, value, icon, color = 'indigo', sub }) {
  const colorMap = {
    indigo: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20 text-indigo-400',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400',
    amber:   'from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-400',
    pink:    'from-pink-500/20 to-pink-600/10 border-pink-500/20 text-pink-400',
    red:     'from-red-500/20 to-red-600/10 border-red-500/20 text-red-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-6 flex flex-col gap-3 backdrop-blur-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white mt-1 font-[Outfit]">
            {value ?? <span className="animate-pulse text-slate-600">—</span>}
          </p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.07] ${colorMap[color].split(' ')[3]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
