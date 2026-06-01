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

  const healthColor =
    health === 'ok'    ? '#10b981' :
    health === 'error' ? '#f87171' :
    '#333355';
  const healthGlow =
    health === 'ok'    ? '0 0 6px rgba(16,185,129,0.7)' :
    health === 'error' ? '0 0 6px rgba(248,113,113,0.5)' : 'none';
  const healthAnim  = health === 'unknown' ? 'pulse-dot 2s ease infinite' : '';
  const healthLabel =
    health === 'ok' ? 'Connected' : health === 'error' ? 'Unreachable' : 'Connecting…';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0e14', color: '#ffffff' }}
         className="font-sans">

      {/* ═══════════════════════════════════════
          SIDEBAR
      ═══════════════════════════════════════ */}
      <aside style={{
        width: 224, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#0a0b11',
        borderRight: '1px solid #1a1b28',
        position: 'sticky', top: 0, height: '100vh',
      }} className="hidden lg:flex">

        {/* Logo */}
        <div style={{ padding: '22px 16px 18px', borderBottom: '1px solid #14151f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Logo mark */}
            <div style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#0d0e14',
              boxShadow: '0 0 16px rgba(245,158,11,0.4)',
            }}>L</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Loci
              </div>
              <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, marginTop: 1, letterSpacing: '0.01em' }}>
                AI Memory
              </div>
            </div>
            <div style={{
              marginLeft: 'auto',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 9999, padding: '2px 7px',
              fontSize: 9, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.08em',
            }}>v1</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          <div style={{
            paddingLeft: 12, marginBottom: 10,
            fontSize: 9.5, fontWeight: 700, color: '#333355',
            letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>
            MENU
          </div>
          {NAV_ITEMS.map(function(item) {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={function() { switchTab(item.id); }}
                className={'nav-item' + (active ? ' active' : '')}
                style={{ marginBottom: 3 }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && !active && (
                  <span style={{
                    background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: 9999, padding: '1px 6px',
                    fontSize: 8.5, fontWeight: 800, color: '#34d399', letterSpacing: '0.06em',
                  }}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Config footer */}
        <div style={{ padding: '12px 8px 16px', borderTop: '1px solid #14151f' }}>
          {/* Health row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 12px', marginBottom: 12,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: healthColor, boxShadow: healthGlow, animation: healthAnim,
            }} />
            <span style={{ fontSize: 11.5, color: '#8888aa', flex: 1 }}>{healthLabel}</span>
          </div>

          {/* API URL */}
          <div style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: '#6666aa',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: 5, paddingLeft: 2,
            }}>API URL</div>
            <input
              type="text"
              value={apiUrl}
              onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setApiUrl(e.target.value); }}
              className="inp font-mono"
              style={{ fontSize: 10.5, padding: '6px 10px' }}
              placeholder="https://…"
            />
          </div>

          {/* User ID */}
          <div>
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: '#6666aa',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: 5, paddingLeft: 2,
            }}>USER</div>
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
      </aside>

      {/* ═══════════════════════════════════════
          MAIN AREA
      ═══════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Mobile header */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid #1a1b28',
          background: '#0a0b11',
        }} className="lg:hidden">
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #d97706, #f59e0b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#0d0e14',
            boxShadow: '0 0 12px rgba(245,158,11,0.4)',
          }}>L</div>
          <span style={{ fontWeight: 700, fontSize: 15, flex: 1, letterSpacing: '-0.02em', color: '#ffffff' }}>Loci</span>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: healthColor, boxShadow: healthGlow, animation: healthAnim,
          }} />
          <input
            type="text"
            value={userId}
            onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setUserId(e.target.value); }}
            className="inp font-mono"
            style={{ fontSize: 10, padding: '5px 9px', width: 118 }}
            placeholder="user-id"
          />
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 64px' }}>
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
          display: 'flex',
          borderTop: '1px solid #1a1b28',
          background: '#0a0b11',
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
                  color: active ? '#f59e0b' : '#333355',
                  transition: 'color 0.15s', position: 'relative',
                }}
              >
                {active && (
                  <span style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 20, height: 2, borderRadius: '0 0 3px 3px',
                    background: 'linear-gradient(90deg, #d97706, #f59e0b)',
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
