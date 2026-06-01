// Global scope — React is window.React (UMD). No import/export.

// Character-frequency embedding — matches the 1536-dim Vectorize index.
// Not semantically meaningful, but lets the full retrieval pipeline run
// without an embedding API key.
function liveEmbedText(text: string, dims: number): number[] {
  dims = dims || 1536;
  const vec: number[] = new Array(dims).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % dims] += text.charCodeAt(i) / 255;
  }
  const mag = Math.sqrt(vec.reduce(function(s: number, v: number) { return s + v * v; }, 0)) || 1;
  return vec.map(function(v: number) { return v / mag; });
}

function buildLiveSystemPrompt(contexts: MemoryContext[]): string {
  if (!contexts || contexts.length === 0) return '';
  const lines: string[] = ['[MEMORY CONTEXT]'];

  const learnings = contexts.filter(function(c: MemoryContext) {
    return c.relevantLearningIds && c.relevantLearningIds.length > 0;
  });
  const episodes = contexts.filter(function(c: MemoryContext) {
    return !!c.episodeId;
  });

  if (learnings.length > 0) {
    lines.push('--- High-confidence learnings ---');
    learnings.forEach(function(l: MemoryContext) {
      l.content.split('\n').forEach(function(line: string) {
        if (line.trim()) lines.push('• ' + line.trim());
      });
    });
  }

  if (episodes.length > 0) {
    lines.push('--- Past episodes ---');
    episodes.forEach(function(ep: MemoryContext, i: number) {
      const d = new Date(ep.timestamp);
      const dateStr = d.toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      lines.push((i + 1) + '. [' + dateStr + '] ' + ep.content);
    });
  }

  lines.push('[END MEMORY CONTEXT]');
  return lines.join('\n');
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: userMessage }],
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(function() { return res.statusText; });
    throw new Error('Anthropic ' + res.status + ': ' + text);
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const block = data.content.find(function(c) { return c.type === 'text'; });
  return block ? block.text : '(no text in response)';
}

// ── Component ─────────────────────────────────────────────────────────────────

type WarmStatus = 'idle' | 'retrieving' | 'calling' | 'done' | 'error';
type ColdStatus = 'idle' | 'loading' | 'done' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function LiveDemo({ client, userId }: { client: LociApiClient; userId: string }) {
  const { useState, useEffect, useCallback, useRef } = React;

  const [apiKey, setApiKey]           = useState('');
  const [task, setTask]               = useState('');
  const [episodeCount, setEpisodeCount] = useState<number | null>(null);

  const [coldStatus, setColdStatus]   = useState<ColdStatus>('idle');
  const [coldReply, setColdReply]     = useState('');
  const [coldError, setColdError]     = useState('');

  const [warmStatus, setWarmStatus]   = useState<WarmStatus>('idle');
  const [warmReply, setWarmReply]     = useState('');
  const [warmError, setWarmError]     = useState('');
  const [memContexts, setMemContexts] = useState<MemoryContext[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');

  const [saveStatus, setSaveStatus]   = useState<SaveStatus>('idle');
  const [savedId, setSavedId]         = useState('');
  const [saveError, setSaveError]     = useState('');

  const sessionIdRef  = useRef<string>(crypto.randomUUID());
  const startedAtRef  = useRef<number>(Date.now());

  // ── Episode counter ────────────────────────────────────────────────────────

  const refreshCount = useCallback(async function() {
    try {
      const eps = await client.getEpisodes(userId);
      setEpisodeCount(eps.length);
    } catch (_) { /* non-critical */ }
  }, [client, userId]);

  useEffect(function() { refreshCount(); }, [refreshCount]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function requireKey(): boolean {
    if (!apiKey.trim()) {
      setColdError('Paste your Anthropic API key at the top.');
      setWarmError('Paste your Anthropic API key at the top.');
      return false;
    }
    return true;
  }

  function requireTask(): boolean {
    if (!task.trim()) {
      setColdError('Enter a task or bug description first.');
      setWarmError('Enter a task or bug description first.');
      return false;
    }
    return true;
  }

  // ── Run without memory ─────────────────────────────────────────────────────

  async function runCold() {
    if (!requireKey() || !requireTask()) return;

    // Fresh session
    sessionIdRef.current  = crypto.randomUUID();
    startedAtRef.current  = Date.now();

    setColdStatus('loading');
    setColdReply('');
    setColdError('');
    // Also clear warm so the two columns reset together
    setWarmStatus('idle');
    setWarmReply('');
    setWarmError('');
    setMemContexts([]);
    setSystemPrompt('');
    setSaveStatus('idle');
    setSavedId('');
    setSaveError('');

    try {
      const reply = await callClaude(apiKey.trim(), '', task);
      setColdReply(reply);
      setColdStatus('done');
    } catch (e: unknown) {
      setColdError(e instanceof Error ? e.message : String(e));
      setColdStatus('error');
    }
  }

  // ── Run with Loci memory ───────────────────────────────────────────────────

  async function runWarm() {
    if (!requireKey() || !requireTask()) return;

    setWarmStatus('retrieving');
    setWarmReply('');
    setWarmError('');
    setMemContexts([]);
    setSystemPrompt('');
    setSaveStatus('idle');
    setSavedId('');
    setSaveError('');
    startedAtRef.current = Date.now();

    try {
      // Step 1 — retrieve relevant episodes from Loci
      const vector   = liveEmbedText(task, 1536);
      const contexts = await client.retrieve({ userId, vector, topK: 5, minScore: 0.1 });
      const prompt   = buildLiveSystemPrompt(contexts);
      setMemContexts(contexts);
      setSystemPrompt(prompt);

      // Step 2 — call Claude with the memory context as system prompt
      setWarmStatus('calling');
      const reply = await callClaude(apiKey.trim(), prompt, task);
      setWarmReply(reply);
      setWarmStatus('done');
    } catch (e: unknown) {
      setWarmError(e instanceof Error ? e.message : String(e));
      setWarmStatus('error');
    }
  }

  // ── Save episode ───────────────────────────────────────────────────────────

  async function saveEpisode() {
    if (!warmReply) return;
    setSaveStatus('saving');
    setSaveError('');
    try {
      const summary = 'User: ' + task + '\nAssistant: ' + warmReply;
      const result  = await client.storeEpisode({
        sessionId: sessionIdRef.current,
        userId,
        startedAt: startedAtRef.current,
        endedAt:   Date.now(),
        summary,
        metadata: { source: 'live-demo' },
      });
      setSavedId(result.id);
      setSaveStatus('saved');
      await refreshCount();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaveStatus('error');
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const busy    = coldStatus === 'loading' || warmStatus === 'retrieving' || warmStatus === 'calling';
  const hasAny  = coldStatus !== 'idle'    || warmStatus !== 'idle';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── Title row ── */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-800">Live Demo</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Run any coding task with and without memory. Save interactions to watch context accumulate.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 shadow-sm">
          <span className="text-xl">🧠</span>
          <div>
            <div className="text-lg font-bold text-blue-700 leading-none">
              {episodeCount === null ? '…' : episodeCount}
            </div>
            <div className="text-xs text-blue-500">
              episode{episodeCount !== 1 ? 's' : ''} in memory
            </div>
          </div>
        </div>
      </div>

      {/* ── API key ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Anthropic API Key
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="password"
            value={apiKey}
            onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setApiKey(e.target.value); }}
            placeholder="sk-ant-..."
            className="flex-1 text-sm font-mono rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-slate-50"
          />
          {apiKey
            ? <span className="text-green-600 text-xs font-bold whitespace-nowrap">✓ Key set</span>
            : <span className="text-slate-400 text-xs whitespace-nowrap">Required</span>}
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          Used only in your browser — never sent to the Loci Worker. Get a key at{' '}
          <span className="font-mono">console.anthropic.com</span>.
        </p>
      </div>

      {/* ── Task input ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Task / Bug Description
        </label>
        <textarea
          value={task}
          onChange={function(e: React.ChangeEvent<HTMLTextAreaElement>) { setTask(e.target.value); }}
          rows={7}
          placeholder={[
            'Paste a coding task or bug. Example:',
            '',
            'Fix this TypeScript bug:',
            '',
            'function getLastN<T>(arr: T[], n: number): T[] {',
            '  const result: T[] = [];',
            '  for (let i = arr.length - n; i <= arr.length; i++) {',
            '    result.push(arr[i]);',
            '  }',
            '  return result;',
            '}',
            '// Bug: returns [30, 40, 50, undefined] instead of [30, 40, 50]',
          ].join('\n')}
          className="w-full text-sm font-mono rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-slate-50 resize-y"
        />
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={runCold}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {coldStatus === 'loading'
              ? <><span className="animate-spin inline-block">↻</span> Running…</>
              : <><span>🚫</span> Run Without Memory</>}
          </button>
          <button
            onClick={runWarm}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {warmStatus === 'retrieving'
              ? <><span className="animate-spin inline-block">↻</span> Querying Loci…</>
              : warmStatus === 'calling'
              ? <><span className="animate-spin inline-block">↻</span> Calling Claude…</>
              : <><span>🧠</span> Run With Loci Memory</>}
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {!hasAny && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-8 py-12 text-center">
          <div className="text-5xl mb-3">🧠</div>
          <div className="text-slate-600 font-semibold text-lg">See memory in action</div>
          <div className="text-slate-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
            Paste a task above and click both buttons. The left panel shows a cold-start agent;
            the right shows exactly what Loci injects into the system prompt — and how the agent uses it.
          </div>
          <div className="mt-4 text-xs text-slate-400">
            After each run, click <span className="font-semibold text-blue-500">Save This Episode</span> to
            store it in Loci. Subsequent runs will retrieve it automatically.
          </div>
        </div>
      )}

      {/* ── Side-by-side results ── */}
      {hasAny && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* ── Cold panel ── */}
          <div className="rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
            <div className="bg-slate-100 px-4 py-3 flex items-center gap-2 border-b border-slate-200">
              <span className="text-lg">🚫</span>
              <span className="font-bold text-slate-700 text-sm">Without Memory</span>
              <span className="ml-auto text-xs text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                Cold Start
              </span>
            </div>

            <div className="p-4 space-y-4">
              {/* System prompt */}
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  System Prompt
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-400 italic">
                  (none — bare user message only)
                </div>
              </div>

              {/* Response */}
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Agent Response
                </div>
                {coldStatus === 'idle' && (
                  <div className="text-xs text-slate-400 italic py-2">
                    Click "Run Without Memory" to see cold-start output.
                  </div>
                )}
                {coldStatus === 'loading' && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                    <span className="animate-spin inline-block text-base">↻</span>
                    Calling <span className="font-mono">claude-sonnet-4-20250514</span>…
                  </div>
                )}
                {coldStatus === 'error' && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 break-words">
                    {coldError}
                  </div>
                )}
                {coldStatus === 'done' && (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-slate-200 max-h-96 overflow-y-auto leading-relaxed">
                    {coldReply}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Warm panel ── */}
          <div className="rounded-xl border-2 border-blue-300 bg-white overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 flex items-center gap-2 border-b border-blue-200">
              <span className="text-lg">🧠</span>
              <span className="font-bold text-blue-800 text-sm">With Loci Memory</span>
              <span className="ml-auto text-xs text-blue-600 bg-white border border-blue-200 rounded-full px-2 py-0.5">
                Memory-Augmented
              </span>
            </div>

            <div className="p-4 space-y-4">

              {/* Memory context box */}
              <div>
                <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span>⚡</span>
                  Memory Context Injected into System Prompt
                  {memContexts.length > 0 && (
                    <span className="ml-auto text-blue-500 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 normal-case font-semibold">
                      {memContexts.length} retrieved
                    </span>
                  )}
                </div>

                {warmStatus === 'idle' && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-400 italic">
                    Click "Run With Loci Memory" to see what gets injected.
                  </div>
                )}

                {warmStatus === 'retrieving' && (
                  <div className="rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-green-400 font-mono flex items-center gap-2">
                    <span className="animate-spin inline-block">↻</span>
                    Querying Vectorize for similar episodes…
                  </div>
                )}

                {(warmStatus === 'calling' || warmStatus === 'done' || warmStatus === 'error') && (
                  memContexts.length === 0 ? (
                    <div className="rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-sm font-mono">
                      <span className="text-yellow-400">No prior episodes found.</span>
                      <span className="text-slate-400 block mt-1 text-xs">
                        Save episodes below to build up memory — future runs will retrieve them.
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-slate-900 border border-slate-700 p-3 font-mono text-xs text-green-300 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {systemPrompt}
                    </div>
                  )
                )}
              </div>

              {/* Response */}
              <div>
                <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1.5">
                  Agent Response
                </div>

                {warmStatus === 'idle' && (
                  <div className="text-xs text-slate-400 italic py-2">Waiting…</div>
                )}
                {(warmStatus === 'retrieving' || warmStatus === 'calling') && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                    <span className="animate-spin inline-block text-base">↻</span>
                    {warmStatus === 'calling'
                      ? <>Calling <span className="font-mono">claude-sonnet-4-20250514</span> with memory context…</>
                      : 'Retrieving episodes from Loci…'}
                  </div>
                )}
                {warmStatus === 'error' && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 break-words">
                    {warmError}
                  </div>
                )}
                {warmStatus === 'done' && (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap bg-blue-50 rounded-lg p-3 border border-blue-100 max-h-96 overflow-y-auto leading-relaxed">
                    {warmReply}
                  </div>
                )}
              </div>

              {/* Save button */}
              {warmStatus === 'done' && (
                <div className="border-t border-blue-100 pt-3">
                  {saveStatus === 'saved' ? (
                    <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-sm text-green-700">
                      <span className="text-base mt-0.5">✓</span>
                      <div>
                        <div className="font-semibold">Episode saved to Loci</div>
                        <div className="font-mono text-xs mt-0.5 text-green-600">
                          {savedId.slice(0, 20)}…
                        </div>
                        <div className="text-xs mt-0.5 text-green-600">
                          The next "Run With Loci Memory" will retrieve this interaction.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={saveEpisode}
                        disabled={saveStatus === 'saving'}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        {saveStatus === 'saving'
                          ? <><span className="animate-spin inline-block">↻</span> Saving to Loci…</>
                          : <><span>💾</span> Save This Episode to Loci</>}
                      </button>
                      {saveStatus === 'error' && (
                        <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                          {saveError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── How it works callout ── */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 space-y-1">
        <div className="font-semibold text-slate-700 mb-2">How this works</div>
        <div className="flex gap-2"><span className="text-blue-500 font-bold shrink-0">1.</span> "Run Without Memory" calls Claude with no system prompt — pure cold start.</div>
        <div className="flex gap-2"><span className="text-blue-500 font-bold shrink-0">2.</span> "Run With Loci Memory" first queries the Vectorize index for similar past episodes, formats them into a <span className="font-mono text-xs bg-white border border-slate-200 rounded px-1">[MEMORY CONTEXT]</span> block, then calls Claude with that block as the system prompt.</div>
        <div className="flex gap-2"><span className="text-blue-500 font-bold shrink-0">3.</span> "Save This Episode" stores the interaction in Cloudflare D1 and upserts its embedding into Vectorize — making it retrievable in future runs.</div>
      </div>

    </div>
  );
}
