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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {loading ? 'Loading…' : `${episodes.length} episode${episodes.length !== 1 ? 's' : ''}`}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
        >
          <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Error: </span>{error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && episodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
          <div className="text-3xl mb-3">🧠</div>
          <div className="text-slate-500 text-sm">No episodes yet.</div>
          <div className="text-slate-400 text-xs mt-1">Run a demo to populate memory.</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 whitespace-nowrap">Started</th>
                  <th className="px-4 py-3 whitespace-nowrap">Duration</th>
                  <th className="px-4 py-3 whitespace-nowrap">Session</th>
                  <th className="px-4 py-3 whitespace-nowrap">User</th>
                  <th className="px-4 py-3 w-full">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {[1, 2, 3, 4, 5].map((j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3 bg-slate-100 rounded w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : episodes.map((ep) => (
                      <tr key={ep.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {formatTime(ep.startedAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {formatDuration(ep.startedAt, ep.endedAt)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {ep.sessionId.slice(0, 12)}…
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {ep.userId}
                        </td>
                        <td className="px-4 py-3 text-slate-700 max-w-xs">
                          <span title={ep.summary}>{truncate(ep.summary, 90)}</span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
