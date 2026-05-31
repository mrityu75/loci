// Global scope — React is window.React (UMD). No import/export.

function confidenceBadge(score: number): { label: string; cls: string } {
  if (score > 0.8) return { label: `${(score * 100).toFixed(0)}%`, cls: 'bg-green-100 text-green-800 ring-green-200' };
  if (score > 0.5) return { label: `${(score * 100).toFixed(0)}%`, cls: 'bg-yellow-100 text-yellow-800 ring-yellow-200' };
  return { label: `${(score * 100).toFixed(0)}%`, cls: 'bg-red-100 text-red-800 ring-red-200' };
}

function categoryColor(category: string): string {
  const palette: Record<string, string> = {
    bug: 'bg-orange-100 text-orange-700',
    pattern: 'bg-purple-100 text-purple-700',
    style: 'bg-blue-100 text-blue-700',
    convention: 'bg-teal-100 text-teal-700',
    performance: 'bg-pink-100 text-pink-700',
  };
  return palette[category.toLowerCase()] ?? 'bg-slate-100 text-slate-600';
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

  const visible = learnings.filter((l) => l.confidence >= minConfidence);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600 font-medium whitespace-nowrap">
            Min confidence
          </label>
          <div className="flex gap-1">
            {[0, 0.5, 0.8].map((v) => (
              <button
                key={v}
                onClick={() => setMinConfidence(v)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  minConfidence === v
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {v === 0 ? 'All' : `>${(v * 100).toFixed(0)}%`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${visible.length} of ${learnings.length} shown`}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Error: </span>{error}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" /> High (&gt;80%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" /> Medium (50–80%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" /> Low (&lt;50%)
        </span>
      </div>

      {/* Cards */}
      {!loading && !error && visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
          <div className="text-3xl mb-3">📚</div>
          <div className="text-slate-500 text-sm">No learnings yet.</div>
          <div className="text-slate-400 text-xs mt-1">Learnings are distilled from episodes over time.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-pulse">
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-full" />
                    <div className="h-3 bg-slate-100 rounded w-4/5" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-5 bg-slate-100 rounded w-1/4" />
                    <div className="h-5 bg-slate-100 rounded w-1/5" />
                  </div>
                </div>
              ))
            : visible.map((l) => {
                const badge = confidenceBadge(l.confidence);
                return (
                  <div
                    key={l.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md p-4 flex flex-col gap-3 transition-shadow"
                  >
                    {/* Category */}
                    <span
                      className={`self-start text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColor(l.category)}`}
                    >
                      {l.category}
                    </span>

                    {/* Content */}
                    <p className="text-sm text-slate-700 leading-relaxed flex-1">{l.content}</p>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-400">
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
