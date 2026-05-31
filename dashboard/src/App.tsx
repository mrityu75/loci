// Global scope — React is window.React (UMD). Loaded last; all page
// components (Episodes, Learnings, RetrievalTrace) and LociApiClient
// are already defined in the global scope by prior script tags.

type TabId = 'episodes' | 'learnings' | 'retrieval';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'episodes',  label: 'Episodes',        icon: '🧠' },
  { id: 'learnings', label: 'Learnings',        icon: '📚' },
  { id: 'retrieval', label: 'Retrieval Trace',  icon: '🔍' },
];

function App() {
  const { useState, useMemo, useEffect } = React;

  const [apiUrl, setApiUrl]     = useState(window.location.origin);
  const [userId, setUserId]     = useState('demo-user-001');
  const [activeTab, setActiveTab] = useState<TabId>('episodes');
  const [health, setHealth]     = useState<'unknown' | 'ok' | 'degraded' | 'error'>('unknown');

  const client = useMemo(() => new LociApiClient(apiUrl), [apiUrl]);

  // Ping /health whenever apiUrl changes
  useEffect(() => {
    setHealth('unknown');
    client.health()
      .then((h: HealthStatus) => setHealth(h.status === 'ok' ? 'ok' : 'degraded'))
      .catch(() => setHealth('error'));
  }, [client]);

  const healthDot: Record<string, string> = {
    unknown:  'bg-slate-300',
    ok:       'bg-green-400',
    degraded: 'bg-yellow-400',
    error:    'bg-red-500',
  };

  const healthLabel: Record<string, string> = {
    unknown:  'Connecting…',
    ok:       'Connected',
    degraded: 'Degraded',
    error:    'Unreachable',
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl">🧠</span>
            <span className="font-bold text-slate-800 text-lg tracking-tight">Loci</span>
            <span className="text-slate-400 text-sm font-normal hidden sm:inline">Dashboard</span>
          </div>

          {/* Config inputs */}
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">
                API URL
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiUrl(e.target.value)}
                className="text-xs font-mono rounded-md border border-slate-200 px-2 py-1.5 w-52 outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-slate-50 min-w-0"
                placeholder="http://localhost:8787"
              />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">
                User ID
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserId(e.target.value)}
                className="text-xs font-mono rounded-md border border-slate-200 px-2 py-1.5 w-40 outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-slate-50 min-w-0"
                placeholder="demo-user-001"
              />
            </div>
          </div>

          {/* Health indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${healthDot[health]} ${health === 'unknown' ? 'animate-pulse' : ''}`}
            />
            <span className="text-xs text-slate-500">{healthLabel[health]}</span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {activeTab === 'episodes'  && <Episodes  client={client} userId={userId} />}
        {activeTab === 'learnings' && <Learnings client={client} userId={userId} />}
        {activeTab === 'retrieval' && <RetrievalTrace client={client} userId={userId} />}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-xs text-slate-400 text-center">
          Loci Memory Dashboard — powered by Cloudflare D1 + Vectorize
        </div>
      </footer>
    </div>
  );
}

// Mount
const _root = ReactDOM.createRoot(document.getElementById('root'));
_root.render(<App />);
