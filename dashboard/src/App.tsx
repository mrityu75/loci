// Global scope — React is window.React (UMD). No import/export.

type TabId = 'demo' | 'research' | 'episodes' | 'learnings' | 'retrieval';

const NAV_ITEMS: { id: TabId; label: string }[] = [
  { id: 'demo',      label: 'Live Demo'       },
  { id: 'research',  label: 'Context'         },
  { id: 'episodes',  label: 'Episodes'        },
  { id: 'learnings', label: 'Learnings'       },
  { id: 'retrieval', label: 'Retrieval Trace' },
];

function App() {
  const { useState, useMemo, useEffect, useCallback } = React;

  const [userId, setUserId]             = useState('demo-user-001');
  const [activeTab, setActiveTab]       = useState<TabId>('demo');
  const [health, setHealth]             = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [tabKey, setTabKey]             = useState(0);
  const [episodeCount, setEpisodeCount] = useState<number | null>(null);

  const client = useMemo(function() {
    return new LociApiClient(window.location.origin);
  }, []);

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
    health === 'error' ? '#f87171' : '#333355';
  const healthGlow =
    health === 'ok'    ? '0 0 6px rgba(16,185,129,0.7)' :
    health === 'error' ? '0 0 6px rgba(248,113,113,0.5)' : 'none';
  const healthAnim = health === 'unknown' ? 'pulse-dot 2s ease infinite' : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0d0e14', color: '#ffffff' }}
         className="font-sans">

      {/* ═══════════════════════════════════════
          TOP NAV BAR
      ═══════════════════════════════════════ */}
      <header style={{
        height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'stretch',
        background: '#0a0b11',
        borderBottom: '1px solid #1a1b28',
        position: 'sticky', top: 0, zIndex: 100,
        padding: '0 20px',
      }}>

        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          paddingRight: 24, marginRight: 4, flexShrink: 0,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, boxShadow: '0 0 14px rgba(99,102,241,0.35)',
          }}>🧠</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Loci
          </span>
        </div>

        {/* Nav tabs — center */}
        <nav style={{ flex: 1, display: 'flex', alignItems: 'stretch', overflow: 'auto' }}>
          {NAV_ITEMS.map(function(item) {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={function() { switchTab(item.id); }}
                style={{
                  height: '100%', padding: '0 15px',
                  background: 'none', border: 'none', outline: 'none',
                  borderBottom: active
                    ? '2px solid rgba(224,232,255,0.75)'
                    : '2px solid transparent',
                  color: active ? '#e0e8ff' : '#555577',
                  fontSize: 13.5, fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={function(e) {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#8888aa';
                }}
                onMouseLeave={function(e) {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#555577';
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: episode count + health + user */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>

          {/* Episode count pill */}
          {episodeCount !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)',
              borderRadius: 9999, padding: '3px 10px',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', lineHeight: 1 }}>
                {episodeCount}
              </span>
              <span style={{ fontSize: 10.5, color: 'rgba(245,158,11,0.55)', fontWeight: 500 }}>
                {episodeCount === 1 ? 'episode' : 'episodes'}
              </span>
            </div>
          )}

          {/* Health indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: healthColor, boxShadow: healthGlow, animation: healthAnim,
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 11.5, color: '#555577' }}>
              {health === 'ok' ? 'Connected' : health === 'error' ? 'Error' : '…'}
            </span>
          </div>

          {/* User ID input */}
          <input
            type="text"
            value={userId}
            onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setUserId(e.target.value); }}
            className="inp font-mono"
            style={{ fontSize: 11, padding: '5px 10px', width: 120 }}
            placeholder="user-id"
          />
        </div>
      </header>

      {/* ═══════════════════════════════════════
          PAGE CONTENT
      ═══════════════════════════════════════ */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 64px' }}>
        <div key={tabKey} className="animate-fade-up" style={{ maxWidth: 960, margin: '0 auto' }}>
          {activeTab === 'demo'      && <LiveDemo      client={client} userId={userId} episodeCount={episodeCount} onEpisodeSaved={refreshEpisodeCount} />}
          {activeTab === 'research'  && <Research />}
          {activeTab === 'episodes'  && <Episodes      client={client} userId={userId} />}
          {activeTab === 'learnings' && <Learnings     client={client} userId={userId} />}
          {activeTab === 'retrieval' && <RetrievalTrace client={client} userId={userId} />}
        </div>
      </main>
    </div>
  );
}

const _root = ReactDOM.createRoot(document.getElementById('root'));
_root.render(<App />);
