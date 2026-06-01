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
    const text = await res.text().catch(function() { return res.statusText; });
    throw new Error('Chat error ' + res.status + ': ' + text);
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
      border: `2px solid rgba(255,255,255,0.08)`, borderTopColor: color, borderRadius: '50%',
    }} />
  );
}

// ── Palette ────────────────────────────────────────────────────────────────────
// All colors in one place so nothing leaks old blue values.

const C = {
  bgPage:      '#0a0a0f',
  bgCard:      '#13131a',
  bgInput:     '#0d0d14',
  bgRaised:    '#1a1a28',
  bgTerminal:  '#050508',
  bgTermHdr:   '#08080f',
  border:      'rgba(60,55,110,0.35)',
  borderMd:    'rgba(80,70,140,0.5)',
  borderPurp:  'rgba(124,58,237,0.38)',
  borderGreen: 'rgba(16,185,129,0.3)',
  borderRed:   'rgba(248,113,113,0.2)',
  text1:       '#f0f0ff',
  text2:       '#9090b0',
  text3:       '#4a4a6a',
  purple:      '#7c3aed',
  purpleHi:    '#a855f7',
  purpleDim:   'rgba(124,58,237,0.14)',
  green:       '#10b981',
  greenHi:     '#34d399',
  red:         '#f87171',
  amber:       '#fbbf24',
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
    if (!task.trim()) { setColdError('Enter a task first.'); setWarmError('Enter a task first.'); return false; }
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
    } catch (e: unknown) { setColdError(e instanceof Error ? e.message : String(e)); setColdStatus('error'); }
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
    } catch (e: unknown) { setWarmError(e instanceof Error ? e.message : String(e)); setWarmStatus('error'); }
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
    } catch (e: unknown) { setSaveError(e instanceof Error ? e.message : String(e)); setSaveStatus('error'); }
  }

  const busy   = coldStatus === 'loading' || warmStatus === 'retrieving' || warmStatus === 'calling';
  const hasAny = coldStatus !== 'idle' || warmStatus !== 'idle';

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function card(extra: React.CSSProperties = {}): React.CSSProperties {
    return { background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, ...extra };
  }
  function label(): React.CSSProperties {
    return { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: C.text3, marginBottom: 10 };
  }
  function idleBox(text: string): React.ReactElement {
    return (
      <div style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: C.text3 }}>{text}</span>
      </div>
    );
  }
  function errorBox(msg: string): React.ReactElement {
    return (
      <div style={{ background: 'rgba(248,113,113,0.07)', border: C.borderRed, borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: C.red, wordBreak: 'break-word' as const }}>
        {msg}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 980, margin: '0 auto' }}>

      {/* ═══════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════ */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 18,
        background: 'linear-gradient(140deg, #0e0c1a 0%, #110d20 40%, #0c0c14 100%)',
        border: `1px solid ${C.borderMd}`,
        padding: '36px 32px 30px', marginBottom: 20,
      }}>
        {/* Background glow blobs */}
        <div style={{ position: 'absolute', top: -80, right: -60, width: 340, height: 340, background: 'radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: 60,  width: 220, height: 220, background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            {/* Live pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 9999, padding: '4px 12px', marginBottom: 18,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.greenHi, display: 'inline-block', animation: 'pulse-dot 2s ease infinite' }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.greenHi, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live Interactive Demo</span>
            </div>

            <h1 style={{
              fontSize: 34, fontWeight: 800, margin: '0 0 14px',
              letterSpacing: '-0.04em', lineHeight: 1.1,
              background: 'linear-gradient(135deg, #f0f0ff 0%, #9090b0 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Memory Changes<br />Everything
            </h1>
            <p style={{ fontSize: 14.5, color: C.text2, margin: 0, lineHeight: 1.65, maxWidth: 380 }}>
              Paste a coding task. Run it{' '}
              <span style={{ color: C.text1, fontWeight: 600 }}>cold</span> for the baseline,
              then{' '}
              <span style={{ color: C.purpleHi, fontWeight: 600 }}>with Loci</span> to see
              retrieved context injected into the system prompt in real time.
            </p>
          </div>

          {/* Episode counter */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'rgba(124,58,237,0.07)',
            border: `1px solid ${C.borderPurp}`,
            borderRadius: 16, padding: '22px 28px',
            boxShadow: '0 0 40px rgba(124,58,237,0.12), inset 0 0 20px rgba(124,58,237,0.04)',
          }}>
            <span style={{
              fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.05em',
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {episodeCount === null ? '—' : episodeCount}
            </span>
            <span style={{ fontSize: 10.5, color: C.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 7 }}>
              {episodeCount === 1 ? 'episode' : 'episodes'} in memory
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          TASK INPUT
      ═══════════════════════════════════════════════ */}
      <div style={{ ...card(), padding: 22, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={label()}>Your Task or Bug</div>
          <div style={{ fontSize: 11, color: C.text3 }}>Shift+Enter → run with memory</div>
        </div>

        {/* THE FIX: fully explicit, no class, no rgba white */}
        <textarea
          value={task}
          onChange={function(e: React.ChangeEvent<HTMLTextAreaElement>) { setTask(e.target.value); }}
          onKeyDown={function(e: React.KeyboardEvent<HTMLTextAreaElement>) {
            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); runWarm(); }
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
            background: '#0d0d14',
            border: `1px solid rgba(80,70,140,0.5)`,
            borderRadius: 10,
            color: '#e0e0f0',
            fontFamily: "'SF Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12.5,
            lineHeight: 1.75,
            padding: '14px 16px',
            outline: 'none',
            resize: 'vertical',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            WebkitAppearance: 'none',
            appearance: 'none',
          }}
          onFocus={function(e) {
            (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(124,58,237,0.6)';
            (e.target as HTMLTextAreaElement).style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)';
          }}
          onBlur={function(e) {
            (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(80,70,140,0.5)';
            (e.target as HTMLTextAreaElement).style.boxShadow = 'none';
          }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          {/* Cold — ghost */}
          <button
            onClick={runCold}
            disabled={busy}
            style={{
              flex: '1 1 160px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 20px', fontSize: 13.5, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${C.borderMd}`,
              color: C.text2, borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.45 : 1,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={function(e) {
              if (!busy) {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.background = 'rgba(255,255,255,0.07)';
                b.style.color = C.text1;
                b.style.borderColor = C.borderPurp;
              }
            }}
            onMouseLeave={function(e) {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.background = 'rgba(255,255,255,0.04)';
              b.style.color = C.text2;
              b.style.borderColor = C.borderMd;
            }}
          >
            {coldStatus === 'loading'
              ? <><Spinner color={C.text2} /><span>Running cold…</span></>
              : <><span style={{ fontSize: 16 }}>🚫</span><span>Without Memory</span></>}
          </button>

          {/* Warm — purple primary */}
          <button
            onClick={runWarm}
            disabled={busy}
            style={{
              flex: '2 1 200px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 24px', fontSize: 13.5, fontWeight: 700,
              background: busy
                ? 'rgba(124,58,237,0.3)'
                : 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 50%, #9333ea 100%)',
              border: 'none', color: '#fff', borderRadius: 10,
              cursor: busy ? 'not-allowed' : 'pointer',
              boxShadow: busy ? 'none' : '0 0 24px rgba(124,58,237,0.4), 0 2px 8px rgba(0,0,0,0.25)',
              transition: 'opacity 0.15s, transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={function(e) {
              if (!busy) {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.transform = 'translateY(-1px)';
                b.style.boxShadow = '0 0 40px rgba(168,85,247,0.55), 0 4px 16px rgba(0,0,0,0.3)';
              }
            }}
            onMouseLeave={function(e) {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.transform = '';
              b.style.boxShadow = busy ? 'none' : '0 0 24px rgba(124,58,237,0.4), 0 2px 8px rgba(0,0,0,0.25)';
            }}
          >
            {warmStatus === 'retrieving'
              ? <><Spinner color="#c084fc" /><span>Querying Loci…</span></>
              : warmStatus === 'calling'
              ? <><Spinner color="#c084fc" /><span>Calling Claude…</span></>
              : <><span style={{ fontSize: 16 }}>🧠</span><span>Run With Loci Memory</span></>}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          EMPTY STATE
      ═══════════════════════════════════════════════ */}
      {!hasAny && (
        <div style={{
          border: `1px dashed ${C.border}`, borderRadius: 16,
          padding: '64px 32px', textAlign: 'center',
          background: 'rgba(124,58,237,0.02)',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
            background: C.purpleDim, border: `1px solid ${C.borderPurp}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
          }}>🧠</div>
          <div style={{ fontSize: 21, fontWeight: 700, color: C.text1, marginBottom: 10, letterSpacing: '-0.025em' }}>
            See memory in action
          </div>
          <div style={{ fontSize: 14, color: C.text2, maxWidth: 400, margin: '0 auto 14px', lineHeight: 1.7 }}>
            Paste a coding task above and click both buttons to compare cold-start vs.
            memory-augmented responses side by side.
          </div>
          <div style={{ fontSize: 12, color: C.text3 }}>
            Save episodes after each warm run — future runs retrieve them automatically.
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          SIDE-BY-SIDE COMPARISON
      ═══════════════════════════════════════════════ */}
      {hasAny && (
        <div>
          {/* Column labels */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 36px 1fr',
            gap: 10, alignItems: 'center', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 9999, padding: '3px 10px',
                fontSize: 9, fontWeight: 800, color: '#f87171', letterSpacing: '0.1em', textTransform: 'uppercase',
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
                background: C.purpleDim, border: `1px solid ${C.borderPurp}`,
                borderRadius: 9999, padding: '3px 10px',
                fontSize: 9, fontWeight: 800, color: C.purpleHi, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>AFTER</span>
              <span style={{ fontSize: 11.5, color: C.text2 }}>Loci memory injected</span>
            </div>
          </div>

          {/* Panel grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', alignItems: 'start' }}>

            {/* ── BEFORE panel ────────────────────────────────── */}
            <div style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRight: 'none',
              borderLeft: `3px solid rgba(248,113,113,0.35)`,
              borderRadius: '14px 0 0 14px',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '13px 18px', borderBottom: `1px solid ${C.border}`,
                background: 'rgba(248,113,113,0.04)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                }}>🚫</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Without Memory</div>
                  <div style={{ fontSize: 10.5, color: C.text3, marginTop: 1 }}>Baseline · no system prompt</div>
                </div>
              </div>

              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* System prompt */}
                <div>
                  <div style={label()}>System Prompt</div>
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
                  <div style={label()}>Response</div>
                  {coldStatus === 'idle'    && idleBox('Click "Without Memory" to run cold.')}
                  {coldStatus === 'loading' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 16px', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text2, fontSize: 13 }}>
                      <Spinner color={C.text2} />
                      <span>Calling <code style={{ fontSize: 10.5, color: C.text3 }}>claude-sonnet-4</code>…</span>
                    </div>
                  )}
                  {coldStatus === 'error' && errorBox(coldError)}
                  {coldStatus === 'done' && (
                    <div style={{
                      background: C.bgRaised, border: `1px solid ${C.border}`, borderRadius: 10,
                      padding: '14px 16px', fontSize: 13, lineHeight: 1.75, color: '#d0d0f0',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflowY: 'auto',
                    }}>{coldReply}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ background: C.border, alignSelf: 'stretch' }} />

            {/* ── AFTER panel ─────────────────────────────────── */}
            <div style={{
              background: '#0e0c18',
              border: `1px solid ${C.borderPurp}`,
              borderLeft: 'none',
              borderRight: `3px solid rgba(16,185,129,0.3)`,
              borderRadius: '0 14px 14px 0',
              overflow: 'hidden',
              boxShadow: '4px 0 32px rgba(124,58,237,0.06)',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '13px 18px', borderBottom: `1px solid ${C.borderPurp}`,
                background: 'rgba(124,58,237,0.07)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(124,58,237,0.15)', border: `1px solid ${C.borderPurp}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                }}>🧠</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.purpleHi }}>With Loci Memory</div>
                  <div style={{ fontSize: 10.5, color: `${C.purpleHi}66`, marginTop: 1 }}>Vectorize retrieval · system prompt injection</div>
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

                {/* Memory Context / Terminal */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={label()}>Memory Context</div>
                    {(warmStatus === 'calling' || warmStatus === 'done') && memContexts.length > 0 && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: 'rgba(16,185,129,0.08)', border: `1px solid ${C.borderGreen}`,
                        borderRadius: 9999, padding: '2px 8px',
                        fontSize: 9, fontWeight: 800, color: C.greenHi,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.greenHi, display: 'inline-block' }} />
                        Injected
                      </div>
                    )}
                  </div>

                  {warmStatus === 'idle' && idleBox('Click "Run With Loci Memory" to see retrieval.')}

                  {warmStatus !== 'idle' && (
                    <div style={{
                      background: C.bgTerminal,
                      border: `1px solid rgba(124,58,237,0.18)`,
                      borderRadius: 12, overflow: 'hidden',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02)',
                    }}>
                      {/* Terminal chrome */}
                      <div style={{
                        background: C.bgTermHdr,
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span className="terminal-dot" style={{ background: '#ff5f57' }} />
                        <span className="terminal-dot" style={{ background: '#febc2e' }} />
                        <span className="terminal-dot" style={{ background: '#28c840' }} />
                        <span style={{
                          fontFamily: "'SF Mono', ui-monospace, monospace",
                          fontSize: 10.5, color: 'rgba(144,144,176,0.3)', marginLeft: 8,
                        }}>loci · memory-context</span>
                        {warmStatus === 'retrieving' && (
                          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: `${C.purpleHi}88` }}>
                            <Spinner size={10} color={C.purpleHi} />
                            <span style={{ color: C.purpleHi }}>retrieving…</span>
                          </span>
                        )}
                      </div>
                      {/* Terminal body */}
                      <div
                        className={warmStatus === 'calling' ? 'cursor-blink' : ''}
                        style={{
                          padding: '14px 16px',
                          fontFamily: "'SF Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                          fontSize: 11.5, lineHeight: 1.72,
                          color: '#7fff7f',
                          maxHeight: 280, overflowY: 'auto',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}
                      >
                        {warmStatus === 'retrieving' && (
                          <span style={{ color: 'rgba(127,255,127,0.35)' }}>
                            {'$ loci retrieve \\\n'}
                            <span style={{ color: C.purpleHi }}>  --userId </span>
                            {userId + ' \\\n'}
                            <span style={{ color: C.purpleHi }}>  --topK </span>
                            {'5 --minScore 0.1\n\n'}
                            {'  Querying Vectorize index…'}
                          </span>
                        )}
                        {(warmStatus === 'calling' || warmStatus === 'done' || warmStatus === 'error') && (
                          memContexts.length === 0
                            ? <>
                                <span style={{ color: 'rgba(127,255,127,0.35)' }}>{'$ loci retrieve --userId ' + userId + '\n\n'}</span>
                                <span style={{ color: C.amber }}>No prior episodes found.</span>
                                <span style={{ color: 'rgba(144,144,176,0.4)' }}>{'\n\nSave an episode after this run —\nfuture calls will retrieve it automatically.'}</span>
                              </>
                            : <>
                                <span style={{ color: 'rgba(127,255,127,0.35)' }}>
                                  {'$ loci retrieve --userId ' + userId + ' --topK 5\n'}
                                  <span style={{ color: C.purpleHi }}>  → </span>
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
                  <div style={label()}>Response</div>
                  {warmStatus === 'idle' && idleBox('Waiting…')}
                  {(warmStatus === 'retrieving' || warmStatus === 'calling') && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '24px 16px', border: `1px solid ${C.borderPurp}`,
                      borderRadius: 10, color: C.text2, fontSize: 13,
                    }}>
                      <Spinner color={C.purpleHi} />
                      <span>
                        {warmStatus === 'calling'
                          ? <>Calling <code style={{ fontSize: 10.5, color: C.text3 }}>claude-sonnet-4</code> with memory context…</>
                          : 'Retrieving from Loci…'}
                      </span>
                    </div>
                  )}
                  {warmStatus === 'error' && errorBox(warmError)}
                  {warmStatus === 'done' && (
                    <div style={{
                      background: 'rgba(124,58,237,0.05)', border: `1px solid ${C.borderPurp}`,
                      borderRadius: 10, padding: '14px 16px',
                      fontSize: 13, lineHeight: 1.75, color: '#e0d0ff',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflowY: 'auto',
                    }}>{warmReply}</div>
                  )}
                </div>

                {/* Save episode */}
                {warmStatus === 'done' && (
                  <div style={{ borderTop: `1px solid rgba(124,58,237,0.12)`, paddingTop: 16 }}>
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
                            opacity: saveStatus === 'saving' ? 0.7 : 1,
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

      {/* ═══════════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════════ */}
      <div style={{ ...card(), padding: '18px 22px', marginTop: 20 }}>
        <div style={{ ...label(), marginBottom: 14 }}>How it works</div>
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
                  background: C.purpleDim, border: `1px solid ${C.borderPurp}`,
                  color: C.purpleHi, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
