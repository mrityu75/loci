// Global scope — React is window.React (UMD). No import/export.

// ── Pure logic ─────────────────────────────────────────────────────────────────

function liveEmbedText(text: string, dims: number): number[] {
  dims = dims || 1536;
  const vec: number[] = new Array(dims).fill(0);
  for (let i = 0; i < text.length; i++) { vec[i % dims] += text.charCodeAt(i) / 255; }
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
      const ds = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      lines.push((i + 1) + '. [' + ds + '] ' + ep.content);
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
    const txt = await res.text().catch(function() { return res.statusText; });
    throw new Error('Chat error ' + res.status + ': ' + txt);
  }
  const data = await res.json() as { reply: string };
  return data.reply;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type WarmStatus = 'idle' | 'retrieving' | 'calling' | 'done' | 'error';
type ColdStatus = 'idle' | 'loading' | 'done' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Spinner ────────────────────────────────────────────────────────────────────

function Spinner({ size = 13, color = 'rgba(255,255,255,0.75)' }: { size?: number; color?: string }) {
  return (
    <span className="spin" style={{
      display: 'inline-block', width: size, height: size, flexShrink: 0,
      border: '2px solid rgba(255,255,255,0.08)', borderTopColor: color, borderRadius: '50%',
    }} />
  );
}

// ── Palette ────────────────────────────────────────────────────────────────────

const C = {
  bgPage:      '#0d0e14',
  bgCard:      '#13141c',
  bgCardDeep:  '#0f1018',
  bgRaised:    '#1a1b26',
  bgInput:     '#0a0a12',
  bgTerminal:  '#050508',
  border:      '#1e1f2e',
  borderMd:    '#2a2a40',
  borderAmber: 'rgba(245,158,11,0.35)',
  borderGreen: 'rgba(16,185,129,0.3)',
  borderRed:   'rgba(248,113,113,0.2)',
  text1:       '#ffffff',
  text2:       '#8888aa',
  text3:       '#555577',
  amber:       '#f59e0b',
  amberHi:     '#fbbf24',
  amberDim:    'rgba(245,158,11,0.1)',
  amberDark:   '#d97706',
  green:       '#10b981',
  greenHi:     '#34d399',
  red:         '#f87171',
  orange:      '#fb923c',
};

// ── Component ──────────────────────────────────────────────────────────────────

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
    try { const eps = await client.getEpisodes(userId); setEpisodeCount(eps.length); } catch (_) {}
  }, [client, userId]);

  useEffect(function() { refreshCount(); }, [refreshCount]);

  function requireTask(): boolean {
    if (!task.trim()) {
      setColdError('Enter a task first.');
      setWarmError('Enter a task first.');
      return false;
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
      setColdReply(await callClaude('', task));
      setColdStatus('done');
    } catch (e: unknown) {
      setColdError(e instanceof Error ? e.message : String(e));
      setColdStatus('error');
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
      setWarmReply(await callClaude(prompt, task));
      setWarmStatus('done');
    } catch (e: unknown) {
      setWarmError(e instanceof Error ? e.message : String(e));
      setWarmStatus('error');
    }
  }

  async function saveEpisode() {
    if (!warmReply) return;
    setSaveStatus('saving'); setSaveError('');
    try {
      const result = await client.storeEpisode({
        sessionId: sessionIdRef.current, userId,
        startedAt: startedAtRef.current, endedAt: Date.now(),
        summary: 'User: ' + task + '\nAssistant: ' + warmReply,
        metadata: { source: 'live-demo' },
      });
      setSavedId(result.id); setSaveStatus('saved');
      await refreshCount();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaveStatus('error');
    }
  }

  const busy   = coldStatus === 'loading' || warmStatus === 'retrieving' || warmStatus === 'calling';
  const hasAny = coldStatus !== 'idle' || warmStatus !== 'idle';

  // ── Shared style helpers ──────────────────────────────────────────────────────

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.1em', color: C.text3, marginBottom: 10,
  };
  function idleBox(text: string): React.ReactElement {
    return (
      <div style={{
        border: `1px dashed ${C.border}`, borderRadius: 10,
        padding: '22px 16px', textAlign: 'center',
      }}>
        <span style={{ fontSize: 12, color: C.text3 }}>{text}</span>
      </div>
    );
  }
  function errBox(msg: string): React.ReactElement {
    return (
      <div style={{
        background: 'rgba(248,113,113,0.07)', border: `1px solid ${C.borderRed}`,
        borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: C.red, wordBreak: 'break-word' as const,
      }}>{msg}</div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 980, margin: '0 auto' }}>

      {/* ═══════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════ */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 18,
        background: 'linear-gradient(140deg, #0f1018 0%, #111220 50%, #0d0e16 100%)',
        border: `1px solid #1e2030`,
        padding: '40px 36px 34px', marginBottom: 20,
      }}>
        {/* Amber glow blobs */}
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 320, height: 320,
          background: 'radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: 80, width: 240, height: 240,
          background: 'radial-gradient(circle, rgba(217,119,6,0.06) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            {/* Pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: '#f59e0b', borderRadius: 9999,
              padding: '5px 14px', marginBottom: 20,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#0d0e14', display: 'inline-block' }} />
              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#0d0e14', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Live Interactive Demo
              </span>
            </div>

            <h1 style={{
              fontSize: 36, fontWeight: 800, margin: '0 0 14px',
              letterSpacing: '-0.04em', lineHeight: 1.08,
              color: '#ffffff',
            }}>
              Memory Changes<br />Everything
            </h1>
            <p style={{ fontSize: 14.5, color: '#c0c0d8', margin: 0, lineHeight: 1.65, maxWidth: 390 }}>
              Paste a coding task. Run it{' '}
              <span style={{ color: '#ffffff', fontWeight: 600 }}>cold</span> for the baseline, then{' '}
              <span style={{ color: C.amber, fontWeight: 600 }}>with Loci</span> to see prior context
              retrieved and injected into the system prompt in real time.
            </p>
          </div>

          {/* Episode counter */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'rgba(245,158,11,0.06)',
            border: `1px solid rgba(245,158,11,0.25)`,
            borderRadius: 16, padding: '22px 30px',
            boxShadow: '0 0 40px rgba(245,158,11,0.1)',
          }}>
            <span style={{
              fontSize: 52, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.05em',
              color: C.amber,
            }}>
              {episodeCount === null ? '—' : episodeCount}
            </span>
            <span style={{
              fontSize: 11, color: '#ffffff', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8,
            }}>
              {episodeCount === 1 ? 'episode' : 'episodes'} in memory
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          TASK INPUT
      ═══════════════════════════════════════════ */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: 24, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={sectionLabelStyle}>Your Task or Bug</div>
          <div style={{ fontSize: 11, color: C.text3 }}>Shift+Enter → run with memory</div>
        </div>

        {/* Textarea — fully explicit, no class inheritance */}
        <textarea
          value={task}
          onChange={function(e: React.ChangeEvent<HTMLTextAreaElement>) { setTask(e.target.value); }}
          onKeyDown={function(e: React.KeyboardEvent<HTMLTextAreaElement>) {
            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); runWarm(); }
          }}
          onFocus={function(e) {
            (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(245,158,11,0.55)';
            (e.target as HTMLTextAreaElement).style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)';
          }}
          onBlur={function(e) {
            (e.target as HTMLTextAreaElement).style.borderColor = '#2a2a40';
            (e.target as HTMLTextAreaElement).style.boxShadow = 'none';
          }}
          rows={9}
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
          style={{
            display: 'block',
            width: '100%',
            minHeight: 200,
            background: '#0a0a12',
            border: '1px solid #2a2a40',
            borderRadius: 10,
            color: '#ffffff',
            caretColor: C.amber,
            fontFamily: "'SF Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12.5,
            lineHeight: 1.75,
            padding: '14px 16px',
            outline: 'none',
            resize: 'vertical',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            WebkitAppearance: 'none' as any,
            appearance: 'none' as any,
          }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>

          {/* Cold — dark ghost */}
          <button
            onClick={runCold}
            disabled={busy}
            style={{
              flex: '1 1 160px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 20px', fontSize: 13.5, fontWeight: 600,
              background: '#1a1b26',
              border: '1px solid #2a2a40',
              color: '#ffffff', borderRadius: 10,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.45 : 1,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={function(e) {
              if (!busy) {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.background = '#22233a';
                b.style.borderColor = '#3a3a55';
              }
            }}
            onMouseLeave={function(e) {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.background = '#1a1b26';
              b.style.borderColor = '#2a2a40';
            }}
          >
            {coldStatus === 'loading'
              ? <><Spinner color="#8888aa" /><span>Running cold…</span></>
              : <><span style={{ fontSize: 16 }}>🚫</span><span>Without Memory</span></>}
          </button>

          {/* Warm — amber gradient, dark text */}
          <button
            onClick={runWarm}
            disabled={busy}
            style={{
              flex: '2 1 200px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 24px', fontSize: 13.5, fontWeight: 800,
              background: busy
                ? 'rgba(245,158,11,0.3)'
                : 'linear-gradient(135deg, #d97706 0%, #f59e0b 55%, #fbbf24 100%)',
              border: 'none',
              color: busy ? 'rgba(255,255,255,0.5)' : '#0d0e14',
              borderRadius: 10,
              cursor: busy ? 'not-allowed' : 'pointer',
              boxShadow: busy ? 'none' : '0 0 24px rgba(245,158,11,0.4), 0 2px 8px rgba(0,0,0,0.25)',
              transition: 'opacity 0.15s, transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={function(e) {
              if (!busy) {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.transform = 'translateY(-1px)';
                b.style.boxShadow = '0 0 40px rgba(245,158,11,0.58), 0 4px 16px rgba(0,0,0,0.3)';
              }
            }}
            onMouseLeave={function(e) {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.transform = '';
              b.style.boxShadow = busy ? 'none' : '0 0 24px rgba(245,158,11,0.4), 0 2px 8px rgba(0,0,0,0.25)';
            }}
          >
            {warmStatus === 'retrieving'
              ? <><Spinner color={C.amber} /><span style={{ color: '#ffffff' }}>Querying Loci…</span></>
              : warmStatus === 'calling'
              ? <><Spinner color={C.amber} /><span style={{ color: '#ffffff' }}>Calling Claude…</span></>
              : <><span style={{ fontSize: 16 }}>🧠</span><span>Run With Loci Memory</span></>}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          EMPTY STATE
      ═══════════════════════════════════════════ */}
      {!hasAny && (
        <div style={{
          border: `1px dashed ${C.border}`,
          borderRadius: 16, padding: '64px 32px', textAlign: 'center',
          background: 'rgba(245,158,11,0.02)',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
            background: 'rgba(245,158,11,0.08)',
            border: `1px solid rgba(245,158,11,0.2)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
          }}>🧠</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', marginBottom: 10, letterSpacing: '-0.025em' }}>
            See memory in action
          </div>
          <div style={{ fontSize: 14, color: '#c0c0d8', maxWidth: 400, margin: '0 auto 14px', lineHeight: 1.7 }}>
            Paste a coding task above and click both buttons to compare cold-start vs.
            memory-augmented responses side by side.
          </div>
          <div style={{ fontSize: 12, color: C.text3 }}>
            Save episodes after each warm run — future runs retrieve them automatically.
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          COMPARISON PANELS
      ═══════════════════════════════════════════ */}
      {hasAny && (
        <div>
          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 36px 1fr',
            gap: 10, alignItems: 'center', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)',
                borderRadius: 9999, padding: '3px 10px',
                fontSize: 9, fontWeight: 800, color: '#fb923c', letterSpacing: '0.1em',
              }}>BEFORE</span>
              <span style={{ fontSize: 11.5, color: C.text3 }}>No memory · cold start</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: C.bgRaised, border: `1px solid ${C.borderMd}`,
              borderRadius: 9999, color: C.text3, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
              width: 36, height: 22,
            }}>VS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: 'rgba(245,158,11,0.1)', border: `1px solid rgba(245,158,11,0.28)`,
                borderRadius: 9999, padding: '3px 10px',
                fontSize: 9, fontWeight: 800, color: C.amber, letterSpacing: '0.1em',
              }}>AFTER</span>
              <span style={{ fontSize: 11.5, color: C.text2 }}>Loci memory injected</span>
            </div>
          </div>

          {/* Panel grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', alignItems: 'start' }}>

            {/* ── BEFORE panel ─────────────────────────────────── */}
            <div style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRight: 'none',
              borderTop: '3px solid rgba(251,146,60,0.45)',
              borderRadius: '14px 0 0 14px',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '13px 18px', borderBottom: `1px solid ${C.border}`,
                background: 'rgba(251,146,60,0.04)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                }}>🚫</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>Without Memory</div>
                  <div style={{ fontSize: 10.5, color: C.text3, marginTop: 1 }}>Baseline · no system prompt</div>
                </div>
              </div>

              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* System prompt */}
                <div>
                  <div style={sectionLabelStyle}>System Prompt</div>
                  <div style={{
                    background: C.bgRaised, border: `1px dashed ${C.border}`,
                    borderRadius: 8, padding: '9px 12px',
                    fontSize: 12, color: C.text3, fontStyle: 'italic',
                  }}>
                    (none — bare user message)
                  </div>
                </div>

                {/* Response */}
                <div>
                  <div style={sectionLabelStyle}>Response</div>
                  {coldStatus === 'idle'    && idleBox('Click "Without Memory" to run cold.')}
                  {coldStatus === 'loading' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '24px 16px', border: `1px solid ${C.border}`,
                      borderRadius: 10, color: C.text2, fontSize: 13,
                    }}>
                      <Spinner color={C.text2} />
                      <span>Calling <code style={{ fontSize: 10.5, color: C.text3 }}>claude-sonnet-4</code>…</span>
                    </div>
                  )}
                  {coldStatus === 'error' && errBox(coldError)}
                  {coldStatus === 'done' && (
                    <div style={{
                      background: C.bgRaised, border: `1px solid ${C.border}`,
                      borderRadius: 10, padding: '14px 16px',
                      fontSize: 13, lineHeight: 1.75, color: '#c8c8e0',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflowY: 'auto',
                    }}>{coldReply}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ background: C.border, alignSelf: 'stretch' }} />

            {/* ── AFTER panel ──────────────────────────────────── */}
            <div style={{
              background: C.bgCardDeep,
              border: `1px solid rgba(245,158,11,0.2)`,
              borderLeft: 'none',
              borderTop: `3px solid rgba(245,158,11,0.55)`,
              borderRadius: '0 14px 14px 0',
              overflow: 'hidden',
              boxShadow: '4px 0 32px rgba(245,158,11,0.05)',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '13px 18px', borderBottom: `1px solid rgba(245,158,11,0.12)`,
                background: 'rgba(245,158,11,0.05)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(245,158,11,0.12)', border: `1px solid rgba(245,158,11,0.25)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                }}>🧠</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.amber }}>With Loci Memory</div>
                  <div style={{ fontSize: 10.5, color: `${C.amber}66`, marginTop: 1 }}>
                    Vectorize retrieval · system prompt injection
                  </div>
                </div>
                {memContexts.length > 0 && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(16,185,129,0.1)', border: `1px solid ${C.borderGreen}`,
                    borderRadius: 9999, padding: '3px 10px',
                    fontSize: 10, fontWeight: 700, color: C.greenHi,
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.greenHi, display: 'inline-block' }} />
                    {memContexts.length} retrieved
                  </div>
                )}
              </div>

              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* Terminal */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={sectionLabelStyle}>Memory Context</div>
                    {(warmStatus === 'calling' || warmStatus === 'done') && memContexts.length > 0 && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: 'rgba(16,185,129,0.08)', border: `1px solid ${C.borderGreen}`,
                        borderRadius: 9999, padding: '2px 8px',
                        fontSize: 9, fontWeight: 800, color: C.greenHi, letterSpacing: '0.08em', textTransform: 'uppercase',
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.greenHi, display: 'inline-block' }} />
                        INJECTED
                      </div>
                    )}
                  </div>

                  {warmStatus === 'idle' && idleBox('Click "Run With Loci Memory" to see retrieval.')}

                  {warmStatus !== 'idle' && (
                    <div style={{
                      background: C.bgTerminal,
                      border: '1px solid #1a1a2e',
                      borderRadius: 12, overflow: 'hidden',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}>
                      {/* Terminal chrome */}
                      <div style={{
                        background: '#08080f',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span className="terminal-dot" style={{ background: '#ff5f57' }} />
                        <span className="terminal-dot" style={{ background: '#febc2e' }} />
                        <span className="terminal-dot" style={{ background: '#28c840' }} />
                        <span style={{
                          fontFamily: "'SF Mono', ui-monospace, monospace",
                          fontSize: 10.5, color: 'rgba(136,136,170,0.35)', marginLeft: 8,
                        }}>loci · memory-context</span>
                        {warmStatus === 'retrieving' && (
                          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: `${C.amber}88` }}>
                            <Spinner size={10} color={C.amber} />
                            <span style={{ color: C.amber }}>retrieving…</span>
                          </span>
                        )}
                      </div>

                      {/* Terminal body */}
                      <div
                        className={warmStatus === 'calling' ? 'cursor-blink' : ''}
                        style={{
                          padding: '14px 16px',
                          fontFamily: "'SF Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                          fontSize: 11.5, lineHeight: 1.72, color: '#7fff7f',
                          maxHeight: 280, overflowY: 'auto',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}
                      >
                        {warmStatus === 'retrieving' && (
                          <span style={{ color: 'rgba(127,255,127,0.3)' }}>
                            {'$ loci retrieve \\\n'}
                            <span style={{ color: C.amber }}>  --userId </span>
                            {userId + ' \\\n'}
                            <span style={{ color: C.amber }}>  --topK </span>
                            {'5 --minScore 0.1\n\n'}
                            {'  Querying Vectorize index…'}
                          </span>
                        )}
                        {(warmStatus === 'calling' || warmStatus === 'done' || warmStatus === 'error') && (
                          memContexts.length === 0
                            ? <>
                                <span style={{ color: 'rgba(127,255,127,0.3)' }}>
                                  {'$ loci retrieve --userId ' + userId + '\n\n'}
                                </span>
                                <span style={{ color: '#fbbf24' }}>No prior episodes found.</span>
                                <span style={{ color: 'rgba(136,136,170,0.4)' }}>
                                  {'\n\nSave an episode after this run —\nfuture calls will retrieve it automatically.'}
                                </span>
                              </>
                            : <>
                                <span style={{ color: 'rgba(127,255,127,0.3)' }}>
                                  {'$ loci retrieve --userId ' + userId + ' --topK 5\n'}
                                  <span style={{ color: C.amber }}>  → </span>
                                  {memContexts.length + ' context' + (memContexts.length !== 1 ? 's' : '') + ' retrieved\n\n'}
                                </span>
                                {systemPrompt}
                              </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Response */}
                <div>
                  <div style={sectionLabelStyle}>Response</div>
                  {warmStatus === 'idle' && idleBox('Waiting…')}
                  {(warmStatus === 'retrieving' || warmStatus === 'calling') && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '24px 16px', border: `1px solid rgba(245,158,11,0.18)`,
                      borderRadius: 10, color: C.text2, fontSize: 13,
                    }}>
                      <Spinner color={C.amber} />
                      <span>
                        {warmStatus === 'calling'
                          ? <>Calling <code style={{ fontSize: 10.5, color: C.text3 }}>claude-sonnet-4</code> with memory context…</>
                          : 'Retrieving from Loci…'}
                      </span>
                    </div>
                  )}
                  {warmStatus === 'error' && errBox(warmError)}
                  {warmStatus === 'done' && (
                    <div style={{
                      background: 'rgba(245,158,11,0.04)', border: `1px solid rgba(245,158,11,0.15)`,
                      borderRadius: 10, padding: '14px 16px',
                      fontSize: 13, lineHeight: 1.75, color: '#f0e8d0',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflowY: 'auto',
                    }}>{warmReply}</div>
                  )}
                </div>

                {/* Save */}
                {warmStatus === 'done' && (
                  <div style={{ borderTop: 'rgba(245,158,11,0.1) 1px solid', paddingTop: 16 }}>
                    {saveStatus === 'saved' ? (
                      <div style={{
                        display: 'flex', gap: 14, alignItems: 'flex-start',
                        background: 'rgba(16,185,129,0.07)', border: `1px solid ${C.borderGreen}`,
                        borderRadius: 12, padding: '14px 16px',
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: 'rgba(16,185,129,0.15)', border: `1px solid ${C.borderGreen}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, color: C.greenHi,
                        }}>✓</div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.greenHi }}>Episode saved to Loci</div>
                          <div style={{ fontFamily: "'SF Mono', ui-monospace, monospace", fontSize: 10.5, color: 'rgba(52,211,153,0.45)', marginTop: 3 }}>
                            id: {savedId.slice(0, 30)}…
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(52,211,153,0.6)', marginTop: 5, lineHeight: 1.55 }}>
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
                            gap: 8, padding: '13px 0', fontSize: 14, fontWeight: 700,
                            background: 'rgba(16,185,129,0.12)',
                            border: `1px solid ${C.borderGreen}`,
                            borderRadius: 10, color: C.greenHi,
                            cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                            opacity: saveStatus === 'saving' ? 0.6 : 1,
                            transition: 'background 0.15s, box-shadow 0.15s',
                          }}
                          onMouseEnter={function(e) {
                            if (saveStatus !== 'saving') {
                              const b = e.currentTarget as HTMLButtonElement;
                              b.style.background = 'rgba(16,185,129,0.2)';
                              b.style.boxShadow = '0 0 20px rgba(16,185,129,0.2)';
                            }
                          }}
                          onMouseLeave={function(e) {
                            const b = e.currentTarget as HTMLButtonElement;
                            b.style.background = 'rgba(16,185,129,0.12)';
                            b.style.boxShadow = 'none';
                          }}
                        >
                          {saveStatus === 'saving'
                            ? <><Spinner color={C.greenHi} /><span>Saving to Loci…</span></>
                            : <><span>💾</span><span>Save This Episode to Memory</span></>}
                        </button>
                        {saveStatus === 'error' && (
                          <div style={{ marginTop: 8, fontSize: 12, color: C.red, background: 'rgba(248,113,113,0.07)', border: `1px solid ${C.borderRed}`, borderRadius: 8, padding: '8px 12px' }}>
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
        </div>
      )}

      {/* ═══════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════ */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: '18px 22px', marginTop: 20,
      }}>
        <div style={{ ...sectionLabelStyle, marginBottom: 14 }}>How it works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { n: '1', text: '"Without Memory" calls Claude with no system prompt — pure cold start, zero prior context.' },
            { n: '2', text: '"Run With Loci Memory" queries the Vectorize index for similar past episodes, formats them into a [MEMORY CONTEXT] block, and calls Claude with that block as the system prompt.' },
            { n: '3', text: '"Save This Episode" stores the interaction in Cloudflare D1 and upserts its embedding into Vectorize — making it retrievable in all future runs.' },
          ].map(function(step) {
            return (
              <div key={step.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(245,158,11,0.1)', border: `1px solid rgba(245,158,11,0.25)`,
                  color: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, marginTop: 1,
                }}>{step.n}</span>
                <span style={{ fontSize: 13, color: C.text2, lineHeight: 1.65 }}>{step.text}</span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
