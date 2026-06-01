// Global scope — React is window.React (UMD). No import/export.

type TabId = 'demo' | 'research' | 'episodes' | 'learnings' | 'retrieval';

const NAV_ITEMS: { id: TabId; icon: string; label: string; short: string; badge?: string }[] = [
  { id: 'demo',      icon: '⚡', label: 'Live Demo',      short: 'Demo',    badge: 'LIVE' },
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
    '#475569';

  const healthAnim = health === 'unknown' ? 'pulse-dot 2s ease infinite' : '';

  const healthLabel =
    health === 'ok'    ? 'Connected' :
    health === 'error' ? 'Unreachable' :
    'Connecting…';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0c0e14', color: '#e2e8f0' }}
         className="font-sans">

      {/* ════════════════════════════════════════════════════════
          SIDEBAR — desktop (≥ lg)
      ════════════════════════════════════════════════════════ */}
      <aside style={{
        width: 228, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#090b10',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, height: '100vh',
      }} className="hidden lg:flex">

        {/* ── Logo ── */}
        <div style={{ padding: '22px 16px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            {/* Logo mark */}
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #2563eb, #6d28d9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em',
              boxShadow: '0 0 20px rgba(99,102,241,0.4)',
            }}>L</div>

            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
                Loci
              </div>
              <div style={{ fontSize: 10, color: '#334155', fontWeight: 500, marginTop: 1 }}>
                AI Memory Infrastructure
              </div>
            </div>

            <div style={{
              marginLeft: 'auto',
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 9999, padding: '2px 7px',
              fontSize: 9, fontWeight: 800, color: '#60a5fa', letterSpacing: '0.08em',
            }}>v1</div>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          <div style={{ marginBottom: 6, paddingLeft: 12, fontSize: 9.5, fontWeight: 700, color: '#1e293b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Navigation
          </div>
          {NAV_ITEMS.map(function(item) {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={function() { switchTab(item.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '8px 12px', marginBottom: 2,
                  borderRadius: 9, border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color: active ? '#60a5fa' : '#64748b',
                  fontWeight: active ? 600 : 500,
                  fontSize: 13.5,
                  transition: 'background 0.12s, color 0.12s',
                  position: 'relative',
                }}
                onMouseEnter={function(e) {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                    (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
                  }
                }}
                onMouseLeave={function(e) {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
                  }
                }}
              >
                {/* Active indicator */}
                {active && (
                  <span style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 3, height: 18, borderRadius: '0 3px 3px 0',
                    background: 'linear-gradient(to bottom, #3b82f6, #6d28d9)',
                  }} />
                )}
                <span style={{ fontSize: 15, flexShrink: 0, marginLeft: active ? 4 : 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && !active && (
                  <span style={{
                    background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: 9999, padding: '1px 6px',
                    fontSize: 8.5, fontWeight: 800, color: '#60a5fa', letterSpacing: '0.06em',
                  }}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Config footer ── */}
        <div style={{ padding: '12px 8px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Health row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', marginBottom: 10,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: healthColor, animation: healthAnim,
              boxShadow: health === 'ok' ? '0 0 6px rgba(16,185,129,0.5)' : 'none',
            }} />
            <span style={{ fontSize: 11, color: '#334155', flex: 1 }}>{healthLabel}</span>
            {health === 'ok' && (
              <span style={{ fontSize: 9, color: '#1e3a2f', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Workers
              </span>
            )}
          </div>

          {/* Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#1e293b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 4 }}>
                API URL
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
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#1e293b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 4 }}>
                User ID
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

      {/* ════════════════════════════════════════════════════════
          MAIN CONTENT AREA
      ════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* ── Mobile header ── */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: '#090b10',
        }} className="lg:hidden">
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #2563eb, #6d28d9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#fff',
          }}>L</div>
          <span style={{ fontWeight: 700, fontSize: 15, flex: 1, letterSpacing: '-0.02em', color: '#e2e8f0' }}>Loci</span>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: healthColor, animation: healthAnim,
          }} />
          <input
            type="text"
            value={userId}
            onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setUserId(e.target.value); }}
            className="inp font-mono"
            style={{ fontSize: 10, padding: '5px 8px', width: 112 }}
            placeholder="user-id"
          />
        </header>

        {/* ── Page content ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '36px 28px 64px' }}>
          <div key={tabKey} className="animate-fade-up" style={{ maxWidth: 980, margin: '0 auto' }}>
            {activeTab === 'demo'      && <LiveDemo      client={client} userId={userId} />}
            {activeTab === 'research'  && <Research />}
            {activeTab === 'episodes'  && <Episodes      client={client} userId={userId} />}
            {activeTab === 'learnings' && <Learnings     client={client} userId={userId} />}
            {activeTab === 'retrieval' && <RetrievalTrace client={client} userId={userId} />}
          </div>
        </main>

        {/* ── Mobile bottom nav ── */}
        <nav style={{
          display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)',
          background: '#090b10',
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
                  color: active ? '#60a5fa' : '#334155',
                  transition: 'color 0.15s',
                  position: 'relative',
                }}
              >
                {active && (
                  <span style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 24, height: 2, borderRadius: '0 0 3px 3px',
                    background: 'linear-gradient(90deg, #3b82f6, #6d28d9)',
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
