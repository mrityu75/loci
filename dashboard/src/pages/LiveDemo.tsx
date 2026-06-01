// Global scope — React is window.React (UMD). No import/export.

// ── Pure logic ────────────────────────────────────────────────────────────────

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
  const episodes = contexts.filter(function(c: MemoryContext) { return !!c.episodeId; });
  if (learnings.length > 0) {
    lines.push('--- High-confidence learnings ---');
    learnings.forEach(function(l: MemoryContext) {
      l.content.split('\n').forEach(function(line: string) { if (line.trim()) lines.push('• ' + line.trim()); });
    });
  }
  if (episodes.length > 0) {
    lines.push('--- Past episodes ---');
    episodes.forEach(function(ep: MemoryContext, i: number) {
      const d = new Date(ep.timestamp);
      const dateStr = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      lines.push((i + 1) + '. [' + dateStr + '] ' + ep.content);
    });
  }
  lines.push('[END MEMORY CONTEXT]');
  return lines.join('\n');
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(window.location.origin + '/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userMessage, systemPrompt: systemPrompt || undefined }),
  });
  if (!res.ok) {
    const text = await res.text().catch(function() { return res.statusText; });
    throw new Error('Chat error ' + res.status + ': ' + text);
  }
  const data = await res.json() as { reply: string };
  return data.reply;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type WarmStatus = 'idle' | 'retrieving' | 'calling' | 'done' | 'error';
type ColdStatus = 'idle' | 'loading' | 'done' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner({ size = 14, color = 'rgba(255,255,255,0.8)' }: { size?: number; color?: string }) {
  return (
    <span className="spin" style={{
      display: 'inline-block', width: size, height: size, flexShrink: 0,
      border: `${size <= 14 ? 2 : 2.5}px solid rgba(255,255,255,0.1)`,
      borderTopColor: color, borderRadius: '50%',
    }} />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

function LiveDemo({ client, userId }: { client: LociApiClient; userId: string }) {
  const { useState, useEffect, useCallback, useRef } = React;

  const [task, setTask]                 = useState('');
  const [episodeCount, setEpisodeCount] = useState<number | null>(null);

  const [coldStatus, setColdStatus] = useState<ColdStatus>('idle');
  const [coldReply, setColdReply]   = useState('');
  const [coldError, setColdError]   = useState('');

  const [warmStatus, setWarmStatus]     = useState<WarmStatus>('idle');
  const [warmReply, setWarmReply]       = useState('');
  const [warmError, setWarmError]       = useState('');
  const [memContexts, setMemContexts]   = useState<MemoryContext[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedId, setSavedId]       = useState('');
  const [saveError, setSaveError]   = useState('');

  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const startedAtRef = useRef<number>(Date.now());

  const refreshCount = useCallback(async function() {
    try {
      const eps = await client.getEpisodes(userId);
      setEpisodeCount(eps.length);
    } catch (_) {}
  }, [client, userId]);

  useEffect(function() { refreshCount(); }, [refreshCount]);

  function requireTask(): boolean {
    if (!task.trim()) {
      setColdError('Enter a task first.'); setWarmError('Enter a task first.'); return false;
    }
    return true;
  }

  async function runCold() {
    if (!requireTask()) return;
    sessionIdRef.current = crypto.randomUUID(); startedAtRef.current = Date.now();
    setColdStatus('loading'); setColdReply(''); setColdError('');
    setWarmStatus('idle'); setWarmReply(''); setWarmError('');
    setMemContexts([]); setSystemPrompt('');
    setSaveStatus('idle'); setSavedId(''); setSaveError('');
    try {
      const reply = await callClaude('', task);
      setColdReply(reply); setColdStatus('done');
    } catch (e: unknown) {
      setColdError(e instanceof Error ? e.message : String(e)); setColdStatus('error');
    }
  }

  async function runWarm() {
    if (!requireTask()) return;
    setWarmStatus('retrieving'); setWarmReply(''); setWarmError('');
    setMemContexts([]); setSystemPrompt('');
    setSaveStatus('idle'); setSavedId(''); setSaveError('');
    startedAtRef.current = Date.now();
    try {
      const vector   = liveEmbedText(task, 1536);
      const contexts = await client.retrieve({ userId, vector, topK: 5, minScore: 0.1 });
      const prompt   = buildLiveSystemPrompt(contexts);
      setMemContexts(contexts); setSystemPrompt(prompt);
      setWarmStatus('calling');
      const reply = await callClaude(prompt, task);
      setWarmReply(reply); setWarmStatus('done');
    } catch (e: unknown) {
      setWarmError(e instanceof Error ? e.message : String(e)); setWarmStatus('error');
    }
  }

  async function saveEpisode() {
    if (!warmReply) return;
    setSaveStatus('saving'); setSaveError('');
    try {
      const summary = 'User: ' + task + '\nAssistant: ' + warmReply;
      const result  = await client.storeEpisode({
        sessionId: sessionIdRef.current, userId,
        startedAt: startedAtRef.current, endedAt: Date.now(),
        summary, metadata: { source: 'live-demo' },
      });
      setSavedId(result.id); setSaveStatus('saved');
      await refreshCount();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : String(e)); setSaveStatus('error');
    }
  }

  const busy   = coldStatus === 'loading' || warmStatus === 'retrieving' || warmStatus === 'calling';
  const hasAny = coldStatus !== 'idle' || warmStatus !== 'idle';

  // ── Design tokens ──────────────────────────────────────────────────────────

  const S = {
    // backgrounds
    bgBase:    '#0c0e14',
    bgCard:    '#13161e',
    bgRaised:  '#1a1e2a',
    bgHover:   'rgba(255,255,255,0.03)',
    // borders
    border:    'rgba(255,255,255,0.07)',
    borderMd:  'rgba(255,255,255,0.11)',
    borderBlue:'rgba(59,130,246,0.3)',
    // text
    text1: '#e2e8f0',
    text2: '#94a3b8',
    text3: '#475569',
    // accent
    blue:  '#3b82f6',
    blue2: '#60a5fa',
    // status
    green:  '#10b981',
    green2: '#34d399',
    red:    '#f87171',
    amber:  '#fbbf24',
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 1000, margin: '0 auto' }}>

      {/* ════════════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0e1520 0%, #0c1128 50%, #0e1018 100%)',
        border: `1px solid ${S.borderMd}`,
        borderRadius: 20, padding: '36px 32px 32px', marginBottom: 24,
      }}>
        {/* Glow orb */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 320, height: 320,
          background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: 100, width: 240, height: 240,
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            {/* Label */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 9999, padding: '4px 12px', marginBottom: 16,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa', display: 'inline-block', animation: 'pulse-dot 2s ease infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Interactive
              </span>
            </div>

            <h1 style={{
              fontSize: 32, fontWeight: 800, margin: '0 0 12px',
              letterSpacing: '-0.04em', lineHeight: 1.1,
              background: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Live Demo
            </h1>
            <p style={{ fontSize: 14.5, color: S.text2, margin: 0, lineHeight: 1.65, maxWidth: 400 }}>
              Type any coding task. Run it{' '}
              <span style={{ color: S.text1, fontWeight: 600 }}>cold</span> to see the baseline, then{' '}
              <span style={{ color: S.blue2, fontWeight: 600 }}>with Loci memory</span> to see prior
              context retrieved and injected in real time.
            </p>
          </div>

          {/* Episode counter pill */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'rgba(59,130,246,0.07)',
            border: '1px solid rgba(59,130,246,0.22)',
            borderRadius: 16, padding: '20px 28px',
            boxShadow: '0 0 40px rgba(59,130,246,0.12), inset 0 0 20px rgba(59,130,246,0.04)',
          }}>
            <span style={{
              fontSize: 44, fontWeight: 800, lineHeight: 1,
              letterSpacing: '-0.05em',
              background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {episodeCount === null ? '—' : episodeCount}
            </span>
            <span style={{ fontSize: 11, color: S.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 6 }}>
              {episodeCount === 1 ? 'episode' : 'episodes'} stored
            </span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TASK INPUT
      ════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: S.bgCard, border: `1px solid ${S.border}`,
        borderRadius: 16, padding: 24, marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: S.text3,
          }}>Task / Bug Description</div>
          <div style={{ fontSize: 11, color: S.text3 }}>
            Shift+Enter to run
          </div>
        </div>

        <textarea
          value={task}
          onChange={function(e: React.ChangeEvent<HTMLTextAreaElement>) { setTask(e.target.value); }}
          onKeyDown={function(e: React.KeyboardEvent<HTMLTextAreaElement>) {
            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); runWarm(); }
          }}
          rows={8}
          className="inp font-mono"
          style={{
            padding: '14px 16px', fontSize: 12.5, lineHeight: 1.75,
            resize: 'vertical', minHeight: 160,
          }}
          placeholder={[
            'Paste a bug or coding task. For example:',
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
        />

        {/* Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          {/* Cold button */}
          <button
            onClick={runCold}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 20px', fontSize: 13, fontWeight: 600,
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${S.borderMd}`,
              color: S.text2, borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={function(e) {
              if (!busy) {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)';
                (e.currentTarget as HTMLButtonElement).style.color = S.text1;
              }
            }}
            onMouseLeave={function(e) {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLButtonElement).style.color = S.text2;
            }}
          >
            {coldStatus === 'loading'
              ? <><Spinner /><span>Running cold…</span></>
              : <><span style={{ fontSize: 15 }}>🚫</span><span>Without Memory</span></>}
          </button>

          {/* Warm button */}
          <button
            onClick={runWarm}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 22px', fontSize: 13, fontWeight: 700,
              background: busy ? 'rgba(37,99,235,0.4)' : 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
              border: 'none', color: '#fff', borderRadius: 10,
              cursor: busy ? 'not-allowed' : 'pointer',
              boxShadow: busy ? 'none' : '0 0 24px rgba(59,130,246,0.35)',
              transition: 'opacity 0.15s, transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={function(e) {
              if (!busy) {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 36px rgba(59,130,246,0.5)';
              }
            }}
            onMouseLeave={function(e) {
              (e.currentTarget as HTMLButtonElement).style.transform = '';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = busy ? 'none' : '0 0 24px rgba(59,130,246,0.35)';
            }}
          >
            {warmStatus === 'retrieving'
              ? <><Spinner /><span>Querying Loci…</span></>
              : warmStatus === 'calling'
              ? <><Spinner /><span>Calling Claude…</span></>
              : <><span style={{ fontSize: 15 }}>🧠</span><span>Run With Loci Memory</span></>}
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          EMPTY STATE
      ════════════════════════════════════════════════════════════════ */}
      {!hasAny && (
        <div style={{
          border: `1px dashed ${S.border}`,
          borderRadius: 16, padding: '60px 32px', textAlign: 'center',
          background: 'rgba(255,255,255,0.01)',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(59,130,246,0.08)', border: `1px solid rgba(59,130,246,0.15)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 34, margin: '0 auto 20px',
          }}>🧠</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: S.text1, marginBottom: 10, letterSpacing: '-0.02em' }}>
            See memory in action
          </div>
          <div style={{ fontSize: 14, color: S.text2, maxWidth: 400, margin: '0 auto 16px', lineHeight: 1.7 }}>
            Paste a coding task above and click both buttons. The left shows a cold-start agent.
            The right shows exactly what Loci retrieves — and how it changes the response.
          </div>
          <div style={{ fontSize: 12, color: S.text3 }}>
            Save episodes after each warm run to build up memory for future interactions.
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          COMPARISON COLUMNS
      ════════════════════════════════════════════════════════════════ */}
      {hasAny && (
        <div>
          {/* Column labels */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 40px 1fr',
            gap: 12, alignItems: 'center', marginBottom: 14,
          }}>
            {/* BEFORE label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)',
                borderRadius: 9999, padding: '3px 10px',
              }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: S.text3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>BEFORE</span>
              </div>
              <span style={{ fontSize: 11.5, color: S.text3 }}>No memory · Cold start</span>
            </div>

            {/* VS chip */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: S.bgRaised, border: `1px solid ${S.borderMd}`,
              borderRadius: 9999, color: S.text3,
              fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
              padding: '4px 0',
            }}>VS</div>

            {/* AFTER label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: 9999, padding: '3px 10px',
              }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: S.blue2, letterSpacing: '0.1em', textTransform: 'uppercase' }}>AFTER</span>
              </div>
              <span style={{ fontSize: 11.5, color: S.text2 }}>Loci memory injected</span>
            </div>
          </div>

          {/* Panel grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 0, alignItems: 'start' }}>

            {/* ── BEFORE panel ─────────────────────────────────────────── */}
            <div style={{
              background: S.bgCard, border: `1px solid ${S.border}`,
              borderRight: 'none', borderRadius: '16px 0 0 16px', overflow: 'hidden',
            }}>
              {/* Panel header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 18px', borderBottom: `1px solid ${S.border}`,
                background: 'rgba(255,255,255,0.02)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(148,163,184,0.08)', border: `1px solid ${S.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                }}>🚫</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: S.text2 }}>Without Memory</div>
                  <div style={{ fontSize: 10.5, color: S.text3, marginTop: 1 }}>Baseline · No system prompt</div>
                </div>
              </div>

              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* System prompt indicator */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.text3, marginBottom: 8 }}>System Prompt</div>
                  <div style={{
                    background: 'rgba(255,255,255,0.02)', border: `1px dashed ${S.border}`,
                    borderRadius: 8, padding: '9px 12px', fontSize: 12,
                    color: S.text3, fontStyle: 'italic',
                  }}>
                    (none — bare user message)
                  </div>
                </div>

                {/* Response */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.text3, marginBottom: 8 }}>Response</div>

                  {coldStatus === 'idle' && (
                    <div style={{
                      border: `1px dashed ${S.border}`, borderRadius: 10,
                      padding: '28px 16px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 12, color: S.text3 }}>
                        Click "Without Memory" to run cold.
                      </div>
                    </div>
                  )}
                  {coldStatus === 'loading' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '28px 16px', border: `1px solid ${S.border}`,
                      borderRadius: 10, color: S.text2, fontSize: 13,
                    }}>
                      <Spinner />
                      <span>Calling <code style={{ fontSize: 10.5, color: S.text3 }}>claude-sonnet-4</code>…</span>
                    </div>
                  )}
                  {coldStatus === 'error' && (
                    <div style={{
                      background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)',
                      borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: S.red, wordBreak: 'break-word',
                    }}>{coldError}</div>
                  )}
                  {coldStatus === 'done' && (
                    <div style={{
                      background: 'rgba(255,255,255,0.025)', border: `1px solid ${S.border}`,
                      borderRadius: 10, padding: '14px 16px',
                      fontSize: 13, lineHeight: 1.75, color: '#cbd5e1',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      maxHeight: 420, overflowY: 'auto',
                    }}>{coldReply}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ background: S.border, alignSelf: 'stretch' }} />

            {/* ── AFTER panel ──────────────────────────────────────────── */}
            <div style={{
              background: '#0e1520',
              border: `1px solid rgba(59,130,246,0.25)`,
              borderLeft: 'none', borderRadius: '0 16px 16px 0', overflow: 'hidden',
              boxShadow: '4px 0 40px rgba(59,130,246,0.08)',
            }}>
              {/* Panel header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 18px', borderBottom: '1px solid rgba(59,130,246,0.15)',
                background: 'rgba(59,130,246,0.06)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                }}>🧠</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#93c5fd' }}>With Loci Memory</div>
                  <div style={{ fontSize: 10.5, color: '#60a5fa88', marginTop: 1 }}>Vectorize retrieval · System prompt injection</div>
                </div>
                {memContexts.length > 0 && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: 9999, padding: '3px 10px',
                    fontSize: 10.5, fontWeight: 700, color: S.blue2,
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: S.blue2, display: 'inline-block' }} />
                    {memContexts.length} retrieved
                  </div>
                )}
              </div>

              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* ── Terminal ── */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.text3 }}>
                      Memory Context
                    </div>
                    {(warmStatus === 'calling' || warmStatus === 'done') && memContexts.length > 0 && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                        borderRadius: 9999, padding: '2px 8px',
                        fontSize: 9.5, fontWeight: 700, color: S.green2,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: S.green2, display: 'inline-block' }} />
                        Injected
                      </div>
                    )}
                  </div>

                  {warmStatus === 'idle' && (
                    <div style={{
                      border: `1px dashed ${S.border}`, borderRadius: 10,
                      padding: '28px 16px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 12, color: S.text3 }}>
                        Click "Run With Loci Memory" to see retrieval.
                      </div>
                    </div>
                  )}

                  {warmStatus !== 'idle' && (
                    <div style={{
                      background: '#060810', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12, overflow: 'hidden',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
                    }}>
                      {/* Terminal chrome */}
                      <div style={{
                        background: '#0c0f18', borderBottom: '1px solid rgba(255,255,255,0.06)',
                        padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {[['#ff5f57','#ff5f57'], ['#febc2e','#febc2e'], ['#28c840','#28c840']].map(function([bg], i) {
                          return <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: bg, display: 'inline-block' }} />;
                        })}
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: 'rgba(148,163,184,0.35)', marginLeft: 8 }}>
                          loci · memory-context
                        </span>
                        {warmStatus === 'retrieving' && (
                          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'rgba(74,222,128,0.5)' }}>
                            <Spinner size={10} color="rgba(74,222,128,0.8)" />
                            <span>retrieving…</span>
                          </span>
                        )}
                      </div>

                      {/* Terminal body */}
                      <div
                        className={warmStatus === 'calling' ? 'cursor-blink' : ''}
                        style={{
                          padding: '14px 16px',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          fontSize: 11.5, lineHeight: 1.7, color: '#4ade80',
                          maxHeight: 280, overflowY: 'auto',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}
                      >
                        {warmStatus === 'retrieving' && (
                          <span style={{ color: 'rgba(74,222,128,0.45)' }}>
                            {'$ loci retrieve \\\n  --userId ' + userId + ' \\\n  --topK 5 --minScore 0.1\n\n  Querying Vectorize index…'}
                          </span>
                        )}
                        {(warmStatus === 'calling' || warmStatus === 'done' || warmStatus === 'error') && (
                          memContexts.length === 0
                            ? <>
                                <span style={{ color: 'rgba(74,222,128,0.45)' }}>{'$ loci retrieve --userId ' + userId + '\n\n'}</span>
                                <span style={{ color: S.amber }}>No prior episodes found.</span>
                                <span style={{ color: 'rgba(148,163,184,0.4)' }}>{'\n\nSave episodes below — future runs\nwill retrieve them automatically.'}</span>
                              </>
                            : <>
                                <span style={{ color: 'rgba(74,222,128,0.45)' }}>
                                  {'$ loci retrieve --userId ' + userId + ' --topK 5\n  → ' + memContexts.length + ' context' + (memContexts.length !== 1 ? 's' : '') + ' retrieved\n\n'}
                                </span>
                                {systemPrompt}
                              </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Agent Response ── */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.text3, marginBottom: 8 }}>Response</div>

                  {warmStatus === 'idle' && (
                    <div style={{ border: `1px dashed ${S.border}`, borderRadius: 10, padding: '28px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: S.text3 }}>Waiting…</div>
                    </div>
                  )}
                  {(warmStatus === 'retrieving' || warmStatus === 'calling') && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '28px 16px', border: '1px solid rgba(59,130,246,0.15)',
                      borderRadius: 10, color: S.text2, fontSize: 13,
                    }}>
                      <Spinner color="#60a5fa" />
                      <span>
                        {warmStatus === 'calling'
                          ? <>Calling <code style={{ fontSize: 10.5, color: S.text3 }}>claude-sonnet-4</code> with memory context…</>
                          : 'Retrieving from Loci…'}
                      </span>
                    </div>
                  )}
                  {warmStatus === 'error' && (
                    <div style={{
                      background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)',
                      borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: S.red, wordBreak: 'break-word',
                    }}>{warmError}</div>
                  )}
                  {warmStatus === 'done' && (
                    <div style={{
                      background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)',
                      borderRadius: 10, padding: '14px 16px',
                      fontSize: 13, lineHeight: 1.75, color: '#dbeafe',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      maxHeight: 420, overflowY: 'auto',
                    }}>{warmReply}</div>
                  )}
                </div>

                {/* ── Save Episode ── */}
                {warmStatus === 'done' && (
                  <div style={{ borderTop: '1px solid rgba(59,130,246,0.1)', paddingTop: 16 }}>
                    {saveStatus === 'saved' ? (
                      <div style={{
                        display: 'flex', gap: 14, alignItems: 'flex-start',
                        background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
                        borderRadius: 12, padding: '14px 16px',
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, color: S.green2,
                        }}>✓</div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: S.green2 }}>Episode saved to Loci</div>
                          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: 'rgba(52,211,153,0.5)', marginTop: 3 }}>
                            id: {savedId.slice(0, 28)}…
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(52,211,153,0.65)', marginTop: 5, lineHeight: 1.5 }}>
                            Future runs will retrieve this interaction automatically.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={saveEpisode}
                          disabled={saveStatus === 'saving'}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 8, padding: '13px 0', fontSize: 13.5, fontWeight: 700,
                            background: saveStatus === 'saving'
                              ? 'rgba(16,185,129,0.2)'
                              : 'rgba(16,185,129,0.15)',
                            border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: 10, color: S.green2,
                            cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                            transition: 'background 0.15s, box-shadow 0.15s',
                          }}
                          onMouseEnter={function(e) {
                            if (saveStatus !== 'saving') {
                              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.22)';
                              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(16,185,129,0.2)';
                            }
                          }}
                          onMouseLeave={function(e) {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.15)';
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                          }}
                        >
                          {saveStatus === 'saving'
                            ? <><Spinner color="#34d399" /><span>Saving to Loci…</span></>
                            : <><span>💾</span><span>Save This Episode to Memory</span></>}
                        </button>
                        {saveStatus === 'error' && (
                          <div style={{
                            marginTop: 8, fontSize: 12, color: S.red,
                            background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.15)',
                            borderRadius: 8, padding: '8px 12px',
                          }}>{saveError}</div>
                        )}
                      </>
                    )}
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: S.bgCard, border: `1px solid ${S.border}`,
        borderRadius: 14, padding: '18px 22px', marginTop: 24,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
          How it works
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { n: '1', text: '"Without Memory" calls Claude with no system prompt — pure cold start, no context.' },
            { n: '2', text: '"Run With Loci Memory" queries the Vectorize index for similar past episodes, formats them into a [MEMORY CONTEXT] block, and calls Claude with that block as the system prompt.' },
            { n: '3', text: '"Save This Episode" stores the interaction in Cloudflare D1 and upserts its embedding into Vectorize — making it retrievable in all future runs.' },
          ].map(function(step) {
            return (
              <div key={step.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
                  color: S.blue2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, marginTop: 1,
                }}>{step.n}</span>
                <span style={{ fontSize: 13, color: S.text2, lineHeight: 1.65 }}>{step.text}</span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
