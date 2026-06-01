// Global scope — React is window.React (UMD). No import/export.

type TabId = 'demo' | 'research' | 'episodes' | 'learnings' | 'retrieval';

const NAV_ITEMS: { id: TabId; icon: string; label: string }[] = [
  { id: 'demo',      icon: '⚡', label: 'Live Demo'       },
  { id: 'research',  icon: '📖', label: 'Context'         },
  { id: 'episodes',  icon: '🧠', label: 'Episodes'        },
  { id: 'learnings', icon: '📚', label: 'Learnings'       },
  { id: 'retrieval', icon: '🔍', label: 'Retrieval Trace' },
];

function App() {
  const { useState, useMemo, useEffect, useCallback } = React;

  const [apiUrl, setApiUrl]             = useState(window.location.origin);
  const [userId, setUserId]             = useState('demo-user-001');
  const [activeTab, setActiveTab]       = useState<TabId>('demo');
  const [health, setHealth]             = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [tabKey, setTabKey]             = useState(0);
  const [episodeCount, setEpisodeCount] = useState<number | null>(null);

  const client = useMemo(function() { return new LociApiClient(apiUrl); }, [apiUrl]);

  useEffect(function() {
    setHealth('unknown');
    client.health()
      .then(function(h: HealthStatus) { setHealth(h.status === 'ok' ? 'ok' : 'error'); })
      .catch(function() { setHealth('error'); });
  }, [client]);

  const refreshEpisodeCount = useCallback(async function() {
    if (!userId) return;
    try {
      const eps = await client.getEpisodes(userId);
      setEpisodeCount(eps.length);
    } catch (_) {}
  }, [client, userId]);

  useEffect(function() { refreshEpisodeCount(); }, [refreshEpisodeCount]);

  function switchTab(id: TabId) {
    setActiveTab(id);
    setTabKey(function(k: number) { return k + 1; });
  }

  const healthColor =
    health === 'ok'    ? '#10b981' :
    health === 'error' ? '#f87171' : '#555577';
  const healthGlow =
    health === 'ok'    ? '0 0 6px rgba(16,185,129,0.7)' :
    health === 'error' ? '0 0 6px rgba(248,113,113,0.5)' : 'none';
  const healthAnim = health === 'unknown' ? 'pulse-dot 2s ease infinite' : '';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0e14', color: '#ffffff' }}
         className="font-sans">

      {/* ═══════════════════════════════════════
          SIDEBAR
      ═══════════════════════════════════════ */}
      <aside style={{
        width: 240, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: '#0d0e16',
        borderRight: '1px solid #1a1b28',
        position: 'sticky', top: 0, height: '100vh',
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <div style={{ padding: '20px 16px 18px', borderBottom: '1px solid #1a1b28', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, boxShadow: '0 0 16px rgba(99,102,241,0.35)',
            }}>🧠</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Loci
              </div>
              <div style={{ fontSize: 10.5, color: '#6666aa', fontWeight: 500, marginTop: 2 }}>
                AI Memory
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(function(item) {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={function() { switchTab(item.id); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px 8px 9px', marginBottom: 2,
                  background: active ? 'rgba(99,102,241,0.09)' : 'none',
                  border: 'none',
                  borderLeft: active ? '3px solid rgba(99,102,241,0.75)' : '3px solid transparent',
                  borderRadius: '0 8px 8px 0',
                  color: active ? '#ffffff' : '#6666aa',
                  fontSize: 13.5, fontWeight: active ? 600 : 500,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={function(e) {
                  if (!active) {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.background = 'rgba(255,255,255,0.04)';
                    b.style.color = '#9999bb';
                  }
                }}
                onMouseLeave={function(e) {
                  if (!active) {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.background = 'none';
                    b.style.color = '#6666aa';
                  }
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom: status + config */}
        <div style={{ padding: '12px 12px 16px', borderTop: '1px solid #1a1b28', flexShrink: 0 }}>

          {/* Health */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, paddingLeft: 2 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: healthColor, boxShadow: healthGlow, animation: healthAnim,
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 11.5, color: '#6666aa' }}>
              {health === 'ok' ? 'Connected' : health === 'error' ? 'Unreachable' : 'Connecting…'}
            </span>
          </div>

          {/* API URL */}
          <div style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: '#444466',
              letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 2,
            }}>API URL</div>
            <input
              type="text"
              value={apiUrl}
              onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setApiUrl(e.target.value); }}
              className="inp font-mono"
              style={{ fontSize: 10.5, padding: '5px 8px' }}
              placeholder="https://…"
            />
          </div>

          {/* User ID */}
          <div>
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: '#444466',
              letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 2,
            }}>USER</div>
            <input
              type="text"
              value={userId}
              onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setUserId(e.target.value); }}
              className="inp font-mono"
              style={{ fontSize: 10.5, padding: '5px 8px' }}
              placeholder="user-id"
            />
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 28px 64px' }}>
          <div key={tabKey} className="animate-fade-up">
            {activeTab === 'demo'      && <LiveDemo      client={client} userId={userId} episodeCount={episodeCount} onEpisodeSaved={refreshEpisodeCount} />}
            {activeTab === 'research'  && <Research />}
            {activeTab === 'episodes'  && <Episodes      client={client} userId={userId} />}
            {activeTab === 'learnings' && <Learnings     client={client} userId={userId} />}
            {activeTab === 'retrieval' && <RetrievalTrace client={client} userId={userId} />}
          </div>
        </main>
      </div>
    </div>
  );
}

const _root = ReactDOM.createRoot(document.getElementById('root'));
_root.render(<App />);
