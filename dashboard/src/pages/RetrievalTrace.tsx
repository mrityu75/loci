// Global scope — React is window.React (UMD). No import/export.

function RetrievalTrace({ client, userId }: { client: LociApiClient; userId: string }) {
  const { useState, useRef } = React;
  const [inputId, setInputId] = useState('');
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [memoryPool, setMemoryPool] = useState<Episode[]>([]);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function trace() {
    const id = inputId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setEpisode(null);
    setMemoryPool([]);
    setLearnings([]);
    try {
      const [ep, allEps, allLearnings] = await Promise.all([
        client.getEpisodeById(id),
        client.getEpisodes(userId, 50),
        client.getLearnings(userId),
      ]);
      setEpisode(ep);
      setMemoryPool(allEps.filter(function(e: Episode) { return e.id !== id && e.startedAt <= ep.startedAt; }));
      setLearnings(allLearnings);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

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

  const highConfidenceLearnings = learnings.filter(function(l: Learning) { return l.confidence >= 0.8; });

  return (
    <div style={{ maxWidth: 860 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Debug Tool</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Retrieval Trace</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
          Inspect what was in memory when a specific episode ran.
        </p>
      </div>

      {/* Input */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Episode ID
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            type="text"
            value={inputId}
            onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setInputId(e.target.value); }}
            onKeyDown={function(e: React.KeyboardEvent) { if (e.key === 'Enter') trace(); }}
            placeholder="e.g. 01942b5c-…"
            className="inp font-mono"
            style={{ flex: 1, fontSize: 12.5, padding: '9px 12px' }}
          />
          <button
            onClick={trace}
            disabled={loading || !inputId.trim()}
            className="btn-primary"
            style={{ padding: '9px 20px', fontSize: 13, minWidth: 80 }}
          >
            {loading ? <span className="spin" style={{ display: 'inline-block' }}>↻</span> : 'Trace'}
          </button>
        </div>
        <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-3)' }}>
          Shows what was in memory when this episode ran: prior episodes + high-confidence learnings.
        </p>
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

      {/* Results */}
      {episode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Episode card */}
          <section>
            <div className="section-label" style={{ marginBottom: 12 }}>Episode</div>
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-purple)',
              borderRadius: 12, padding: '18px 20px',
              boxShadow: '0 0 20px rgba(124,58,237,0.06)',
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px', fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: 'var(--text-3)', marginBottom: 12 }}>
                {[
                  ['ID', episode.id],
                  ['Session', episode.sessionId.slice(0, 16) + '…'],
                  ['User', episode.userId],
                  ['Started', formatTime(episode.startedAt)],
                  ['Duration', formatDuration(episode.startedAt, episode.endedAt)],
                ].map(function([k, v]) {
                  return (
                    <span key={k}>
                      <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{k}</span>
                      <span style={{ color: 'var(--text-3)' }}>: {v}</span>
                    </span>
                  );
                })}
              </div>
              {episode.summary && (
                <div style={{
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '12px 14px',
                  fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.7,
                }}>
                  {episode.summary}
                </div>
              )}
            </div>
          </section>

          {/* High-confidence learnings */}
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <div className="section-label">Injected Learnings</div>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>(confidence &gt; 80%)</span>
            </div>
            {highConfidenceLearnings.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
                No high-confidence learnings at this point.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {highConfidenceLearnings.map(function(l: Learning) {
                  return (
                    <div
                      key={l.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        background: 'var(--bg-surface)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        borderRadius: 10, padding: '12px 16px',
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', flexShrink: 0, marginTop: 1 }}>
                        {(l.confidence * 100).toFixed(0)}%
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <span className="tag tag-gray" style={{ marginRight: 8, fontSize: 9 }}>{l.category}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{l.content}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Prior episodes */}
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <div className="section-label">Prior Episodes in Memory Pool</div>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>
                ({memoryPool.length} episode{memoryPool.length !== 1 ? 's' : ''} eligible for retrieval)
              </span>
            </div>
            {memoryPool.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
                This was the first episode — no prior context.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {memoryPool.slice(0, 10).map(function(ep: Episode, i: number) {
                  return (
                    <div
                      key={ep.id}
                      className="card"
                      style={{ padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', width: 18, flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: 'var(--text-3)', marginBottom: 6 }}>
                          <span>{formatTime(ep.startedAt)}</span>
                          <span>{ep.sessionId.slice(0, 12)}…</span>
                          <span>{formatDuration(ep.startedAt, ep.endedAt)}</span>
                        </div>
                        {ep.summary && (
                          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
                            {ep.summary.length > 120 ? ep.summary.slice(0, 120) + '…' : ep.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {memoryPool.length > 10 && (
                  <p style={{ fontSize: 11.5, color: 'var(--text-3)', paddingLeft: 32 }}>
                    …and {memoryPool.length - 10} more (showing top 10)
                  </p>
                )}
              </div>
            )}
          </section>

        </div>
      )}

      {/* Empty state */}
      {!episode && !loading && !error && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px dashed var(--border-md)',
          borderRadius: 12, padding: '64px 32px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
            Enter an episode ID to trace its memory context
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Copy an ID from the Episodes tab or from the demo runner output.
          </div>
        </div>
      )}

    </div>
  );
}
