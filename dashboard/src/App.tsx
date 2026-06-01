// Global scope — React is window.React (UMD). No import/export.

type TabId = 'demo' | 'research' | 'episodes' | 'learnings' | 'retrieval';

const NAV_ITEMS: { id: TabId; icon: string; label: string; short: string; badge?: string }[] = [
  { id: 'demo',      icon: '⚡', label: 'Live Demo',      short: 'Demo',   badge: 'LIVE' },
  { id: 'research',  icon: '📖', label: 'Context',         short: 'Context' },
  { id: 'episodes',  icon: '🧠', label: 'Episodes',        short: 'Memory'  },
  { id: 'learnings', icon: '📚', label: 'Learnings',       short: 'Learn'   },
  { id: 'retrieval', icon: '🔍', label: 'Retrieval Trace', short: 'Trace'   },
];

function App() {
  const { useState, useMemo, useEffect } = React;

  const [apiUrl, setApiUrl]       = useState(window.location.origin);
  const [userId, setUserId]       = useState('demo-user-001');
  const [activeTab, setActiveTab] = useState<TabId>('demo');
  const [health, setHealth]       = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [tabKey, setTabKey]       = useState(0);

  const client = useMemo(function() { return new LociApiClient(apiUrl); }, [apiUrl]);

  useEffect(function() {
    setHealth('unknown');
    client.health()
      .then(function(h: HealthStatus) { setHealth(h.status === 'ok' ? 'ok' : 'error'); })
      .catch(function() { setHealth('error'); });
  }, [client]);

  function switchTab(id: TabId) {
    setActiveTab(id);
    setTabKey(function(k: number) { return k + 1; });
  }

  const healthDot =
    health === 'ok'    ? { color: '#10b981', glow: '0 0 6px rgba(16,185,129,0.6)', anim: '' } :
    health === 'error' ? { color: '#f87171', glow: 'none', anim: '' } :
    { color: '#4a4a6a', glow: 'none', anim: 'pulse-dot 2s ease infinite' };

  const healthLabel =
    health === 'ok' ? 'Connected' : health === 'error' ? 'Unreachable' : 'Connecting…';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0f', color: '#f0f0ff' }}
         className="font-sans">

      {/* ════════════════════════════════════════════════
          SIDEBAR
      ════════════════════════════════════════════════ */}
      <aside style={{
        width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#07070d',
        borderRight: '1px solid rgba(60,55,110,0.4)',
        position: 'sticky', top: 0, height: '100vh',
      }} className="hidden lg:flex">

        {/* Logo */}
        <div style={{ padding: '20px 14px 16px', borderBottom: '1px solid rgba(60,55,110,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg, #6d28d9 0%, #a855f7 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#fff',
              boxShadow: '0 0 16px rgba(124,58,237,0.45)',
            }}>L</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: '#f0f0ff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Loci
              </div>
              <div style={{ fontSize: 9.5, color: '#2d2d4a', fontWeight: 500, marginTop: 1 }}>
                AI Memory
              </div>
            </div>
            <div style={{
              marginLeft: 'auto',
              background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: 9999, padding: '2px 7px',
              fontSize: 9, fontWeight: 800, color: '#a855f7', letterSpacing: '0.06em',
            }}>v1</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          <div style={{ paddingLeft: 12, marginBottom: 8, fontSize: 9, fontWeight: 700, color: '#1e1e38', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Menu
          </div>
          {NAV_ITEMS.map(function(item) {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={function() { switchTab(item.id); }}
                className={'nav-item' + (active ? ' active' : '')}
                style={{ marginBottom: 2 }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && !active && (
                  <span style={{
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.22)',
                    borderRadius: 9999, padding: '1px 6px',
                    fontSize: 8.5, fontWeight: 800, color: '#34d399', letterSpacing: '0.06em',
                  }}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Config footer */}
        <div style={{ padding: '10px 8px 14px', borderTop: '1px solid rgba(60,55,110,0.3)' }}>
          {/* Health */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', marginBottom: 10 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: healthDot.color,
              boxShadow: healthDot.glow,
              animation: healthDot.anim,
            }} />
            <span style={{ fontSize: 11, color: '#2d2d4a', flex: 1 }}>{healthLabel}</span>
          </div>
          {/* Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#1e1e38', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 2 }}>
                API
              </div>
              <input
                type="text"
                value={apiUrl}
                onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setApiUrl(e.target.value); }}
                className="inp font-mono"
                style={{ fontSize: 10.5, padding: '6px 10px' }}
                placeholder="https://…"
              />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#1e1e38', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 2 }}>
                User
              </div>
              <input
                type="text"
                value={userId}
                onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setUserId(e.target.value); }}
                className="inp font-mono"
                style={{ fontSize: 10.5, padding: '6px 10px' }}
                placeholder="user-id"
              />
            </div>
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════
          MAIN AREA
      ════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Mobile header */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          borderBottom: '1px solid rgba(60,55,110,0.4)',
          background: '#07070d',
        }} className="lg:hidden">
          <div style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #6d28d9, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#fff',
            boxShadow: '0 0 12px rgba(124,58,237,0.4)',
          }}>L</div>
          <span style={{ fontWeight: 700, fontSize: 14.5, flex: 1, letterSpacing: '-0.02em', color: '#f0f0ff' }}>Loci</span>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: healthDot.color, boxShadow: healthDot.glow, animation: healthDot.anim,
          }} />
          <input
            type="text"
            value={userId}
            onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setUserId(e.target.value); }}
            className="inp font-mono"
            style={{ fontSize: 10, padding: '5px 8px', width: 110 }}
            placeholder="user-id"
          />
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 60px' }}>
          <div key={tabKey} className="animate-fade-up" style={{ maxWidth: 960, margin: '0 auto' }}>
            {activeTab === 'demo'      && <LiveDemo      client={client} userId={userId} />}
            {activeTab === 'research'  && <Research />}
            {activeTab === 'episodes'  && <Episodes      client={client} userId={userId} />}
            {activeTab === 'learnings' && <Learnings     client={client} userId={userId} />}
            {activeTab === 'retrieval' && <RetrievalTrace client={client} userId={userId} />}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav style={{
          display: 'flex', borderTop: '1px solid rgba(60,55,110,0.4)',
          background: '#07070d',
        }} className="lg:hidden">
          {NAV_ITEMS.map(function(item) {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={function() { switchTab(item.id); }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 3, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                  color: active ? '#a855f7' : '#2d2d4a',
                  transition: 'color 0.15s', position: 'relative',
                }}
              >
                {active && (
                  <span style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 20, height: 2, borderRadius: '0 0 3px 3px',
                    background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                  }} />
                )}
                <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em' }}>{item.short}</span>
              </button>
            );
          })}
        </nav>
      </div>

    </div>
  );
}

const _root = ReactDOM.createRoot(document.getElementById('root'));
_root.render(<App />);
