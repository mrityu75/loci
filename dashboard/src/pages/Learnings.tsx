// Global scope — React is window.React (UMD). No import/export.

function confidenceBadge(score: number): { label: string; cls: string } {
  if (score > 0.8) return { label: `${(score * 100).toFixed(0)}%`, cls: 'tag-green' };
  if (score > 0.5) return { label: `${(score * 100).toFixed(0)}%`, cls: 'tag-yellow' };
  return { label: `${(score * 100).toFixed(0)}%`, cls: 'tag-red' };
}

function categoryTag(category: string): string {
  const map: Record<string, string> = {
    bug: 'tag-red',
    pattern: 'tag-blue',
    style: 'tag-gray',
    convention: 'tag-gray',
    performance: 'tag-yellow',
  };
  return map[category.toLowerCase()] ?? 'tag-gray';
}

function Learnings({ client, userId }: { client: LociApiClient; userId: string }) {
  const { useState, useEffect, useCallback } = React;
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.getLearnings(userId);
      setLearnings(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [client, userId]);

  useEffect(() => { load(); }, [load]);

  const visible = learnings.filter(function(l) { return l.confidence >= minConfidence; });

  return (
    <div style={{ maxWidth: 860 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Semantic Memory</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Learnings</h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
              {loading ? 'Loading…' : `${visible.length} of ${learnings.length} shown`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Filter */}
            <div style={{ display: 'flex', gap: 4 }}>
              {([0, 0.5, 0.8] as number[]).map(function(v) {
                const active = minConfidence === v;
                return (
                  <button
                    key={v}
                    onClick={function() { setMinConfidence(v); }}
                    style={{
                      padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                      border: '1px solid',
                      background: active ? 'rgba(59,130,246,0.2)' : 'transparent',
                      borderColor: active ? 'rgba(59,130,246,0.5)' : 'var(--border-md)',
                      color: active ? '#60a5fa' : 'var(--text-3)',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                  >
                    {v === 0 ? 'All' : `>${(v * 100).toFixed(0)}%`}
                  </button>
                );
              })}
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}
            >
              <span className={loading ? 'spin' : ''} style={{ display: 'inline-block' }}>↻</span>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {[
          { dot: 'var(--success)', label: 'High (>80%)' },
          { dot: '#fbbf24',        label: 'Medium (50–80%)' },
          { dot: 'var(--error)',   label: 'Low (<50%)' },
        ].map(function(item, i) {
          return (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.dot, flexShrink: 0, display: 'inline-block' }} />
              {item.label}
            </span>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#f87171', marginBottom: 16,
        }}>
          <span style={{ fontWeight: 700 }}>Error: </span>{error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && visible.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)', border: '1px dashed var(--border-md)',
          borderRadius: 12, padding: '64px 32px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No learnings yet</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Learnings are distilled from episodes over time.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {loading
            ? Array.from({ length: 6 }).map(function(_, i) {
                return (
                  <div key={i} className="card" style={{ padding: 16 }}>
                    {[0.33, 1, 0.8, 0.33].map(function(w, j) {
                      return (
                        <div key={j} style={{
                          height: 10, borderRadius: 4, background: 'var(--bg-raised)',
                          width: `${w * 100}%`, marginBottom: j < 3 ? 10 : 0,
                          animation: 'pulse-dot 1.5s ease infinite',
                        }} />
                      );
                    })}
                  </div>
                );
              })
            : visible.map(function(l) {
                const badge = confidenceBadge(l.confidence);
                return (
                  <div
                    key={l.id}
                    className="card"
                    style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 0.15s' }}
                    onMouseEnter={function(e) { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-md)'; }}
                    onMouseLeave={function(e) { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
                  >
                    <span className={'tag self-start ' + categoryTag(l.category)} style={{ alignSelf: 'flex-start' }}>
                      {l.category}
                    </span>

                    <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.7, margin: 0, flex: 1 }}>
                      {l.content}
                    </p>

                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      paddingTop: 10, borderTop: '1px solid var(--border)',
                    }}>
                      <span className={'tag ' + badge.cls}>{badge.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        ×{l.reinforcementCount} reinforced
                      </span>
                    </div>
                  </div>
                );
              })}
        </div>
      )}

    </div>
  );
}
