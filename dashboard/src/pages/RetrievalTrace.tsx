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
      // Memory pool = episodes that existed before this one (started earlier)
      setMemoryPool(allEps.filter((e: Episode) => e.id !== id && e.startedAt <= ep.startedAt));
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

  const highConfidenceLearnings = learnings.filter((l: Learning) => l.confidence >= 0.8);

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Episode ID
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputId(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && trace()}
            placeholder="e.g. 01942b5c-…"
            className="flex-1 text-sm font-mono rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-slate-50 placeholder:text-slate-300"
          />
          <button
            onClick={trace}
            disabled={loading || !inputId.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '…' : 'Trace'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Shows what was in memory when this episode ran: prior episodes + high-confidence learnings.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Error: </span>{error}
        </div>
      )}

      {/* Results */}
      {episode && (
        <>
          {/* Episode card */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
              Episode
            </h2>
            <div className="bg-white rounded-xl border border-blue-100 ring-1 ring-blue-200 shadow-sm p-5 space-y-3">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500 font-mono">
                <span><span className="font-semibold text-slate-700">ID</span>: {episode.id}</span>
                <span><span className="font-semibold text-slate-700">Session</span>: {episode.sessionId.slice(0, 16)}…</span>
                <span><span className="font-semibold text-slate-700">User</span>: {episode.userId}</span>
                <span><span className="font-semibold text-slate-700">Started</span>: {formatTime(episode.startedAt)}</span>
                <span><span className="font-semibold text-slate-700">Duration</span>: {formatDuration(episode.startedAt, episode.endedAt)}</span>
              </div>
              {episode.summary && (
                <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap leading-relaxed border border-slate-100">
                  {episode.summary}
                </div>
              )}
            </div>
          </section>

          {/* High-confidence learnings injected */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
              Injected learnings
              <span className="ml-2 normal-case font-normal text-slate-400">(confidence &gt; 80%)</span>
            </h2>
            {highConfidenceLearnings.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No high-confidence learnings at this point.</p>
            ) : (
              <ul className="space-y-2">
                {highConfidenceLearnings.map((l: Learning) => (
                  <li
                    key={l.id}
                    className="flex items-start gap-3 bg-white rounded-lg border border-green-100 ring-1 ring-green-200 px-4 py-3"
                  >
                    <span className="mt-0.5 text-green-500 text-xs font-bold shrink-0">
                      {(l.confidence * 100).toFixed(0)}%
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-500 mr-2">{l.category}</span>
                      <span className="text-sm text-slate-700">{l.content}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Prior episodes in memory pool */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
              Prior episodes in memory pool
              <span className="ml-2 normal-case font-normal text-slate-400">
                ({memoryPool.length} episode{memoryPool.length !== 1 ? 's' : ''} eligible for retrieval)
              </span>
            </h2>
            {memoryPool.length === 0 ? (
              <p className="text-sm text-slate-400 italic">This was the first episode — no prior context.</p>
            ) : (
              <div className="space-y-2">
                {memoryPool.slice(0, 10).map((ep: Episode, i: number) => (
                  <div
                    key={ep.id}
                    className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex gap-4 items-start"
                  >
                    <span className="text-xs font-bold text-slate-400 w-5 shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400 font-mono mb-1">
                        <span>{formatTime(ep.startedAt)}</span>
                        <span>{ep.sessionId.slice(0, 12)}…</span>
                        <span>{formatDuration(ep.startedAt, ep.endedAt)}</span>
                      </div>
                      {ep.summary && (
                        <p className="text-sm text-slate-600 line-clamp-2">{ep.summary}</p>
                      )}
                    </div>
                  </div>
                ))}
                {memoryPool.length > 10 && (
                  <p className="text-xs text-slate-400 pl-9">
                    …and {memoryPool.length - 10} more (showing top 10)
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* Empty state before any search */}
      {!episode && !loading && !error && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
          <div className="text-3xl mb-3">🔍</div>
          <div className="text-slate-500 text-sm">Enter an episode ID to trace its memory context.</div>
          <div className="text-slate-400 text-xs mt-1">
            Copy an ID from the Episodes tab or from the demo runner output.
          </div>
        </div>
      )}
    </div>
  );
}
