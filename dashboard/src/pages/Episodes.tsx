// Global scope — React is window.React (UMD). No import/export.

function Episodes({ client, userId }: { client: LociApiClient; userId: string }) {
  const { useState, useEffect, useCallback } = React;
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.getEpisodes(userId);
      setEpisodes(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [client, userId]);

  useEffect(() => { load(); }, [load]);

  function formatTime(ms: number): string {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  function formatDuration(startedAt: number, endedAt?: number): string {
    if (!endedAt) return '—';
    const ms = endedAt - startedAt;
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  function truncate(text: string | undefined, len: number): string {
    if (!text) return '—';
    return text.length > len ? text.slice(0, len) + '…' : text;
  }

  return (
    <div style={{ maxWidth: 860 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Memory Store</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Episodes</h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
              {loading
                ? 'Loading…'
                : `${episodes.length} episode${episodes.length !== 1 ? 's' : ''} stored for ${userId}`}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13 }}
          >
            <span style={{ display: 'inline-block' }} className={loading ? 'spin' : ''}>↻</span>
            Refresh
          </button>
        </div>
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
      {!loading && !error && episodes.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)', border: '1px dashed var(--border-md)',
          borderRadius: 12, padding: '64px 32px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No episodes yet</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Run the Live Demo to populate memory.</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>
                  {['Started', 'Duration', 'Session', 'User', 'Summary'].map(function(h, i) {
                    return (
                      <th key={i} style={{
                        padding: '10px 16px', textAlign: 'left',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map(function(_, i) {
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          {[1, 2, 3, 4, 5].map(function(j) {
                            return (
                              <td key={j} style={{ padding: '12px 16px' }}>
                                <div style={{
                                  height: 10, borderRadius: 4,
                                  background: 'var(--bg-raised)',
                                  width: j === 5 ? '100%' : '60%',
                                  animation: 'pulse-dot 1.5s ease infinite',
                                }} />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  : episodes.map(function(ep) {
                      return (
                        <tr key={ep.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }}
                            onMouseEnter={function(e) { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={function(e) { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                            {formatTime(ep.startedAt)}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                            {formatDuration(ep.startedAt, ep.endedAt)}
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                            {ep.sessionId.slice(0, 12)}…
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                            {ep.userId}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-2)', maxWidth: 320 }}>
                            <span title={ep.summary}>{truncate(ep.summary, 90)}</span>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
