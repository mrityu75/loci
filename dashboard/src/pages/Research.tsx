// Global scope — React is window.React (UMD). No import/export.

function Research() {
  return (
    <div style={{ maxWidth: 860 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 40 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Research Context</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
          Why Episodic Memory?
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.6 }}>
          The problem Loci solves, how it compares to prior work, and what the benchmark shows.
        </p>
      </div>

      {/* ── Section 1: The Problem ── */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#f87171',
          }}>1</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
            LLMs Are Stateless By Design
          </h3>
        </div>

        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 20 }}>
          Every invocation of a large language model starts from zero. There is no persistent identity,
          no accumulated experience, no memory of prior interactions — only the current context window.
          For one-shot queries this is fine. For agents that perform recurring tasks, work with evolving
          codebases, or interact with the same users over time, this statelessness is a fundamental
          architectural flaw: the agent perpetually rediscovers facts it has already learned.
        </p>

        {/* Diagram */}
        <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
          {/* Without memory */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <div className="section-label" style={{ textAlign: 'center', marginBottom: 16 }}>
              Without Memory — Each session starts cold
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Session 1', task: 'Fix: i ≤ arr.length', fix: '→ i < arr.length ✓' },
                { label: 'Session 2', task: 'Fix: missing await',   fix: '→ Added await ✓'   },
                { label: 'Session 3', task: 'Fix: !user.age',       fix: '→ === null ✓'       },
              ].map(function(s, i) {
                return (
                  <div key={i} style={{ flex: 1, minWidth: 140 }}>
                    <div className="card-raised" style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8 }}>{s.label}</div>
                      <div style={{
                        fontFamily: 'ui-monospace, monospace', fontSize: 11,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '6px 8px', color: 'var(--text-2)', textAlign: 'left',
                      }}>{s.task}</div>
                      <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, marginTop: 8 }}>{s.fix}</div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <span className="tag tag-red">↓ forgotten</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* With Loci */}
          <div style={{ padding: '20px 24px', background: 'rgba(245,158,11,0.04)' }}>
            <div className="section-label" style={{ textAlign: 'center', marginBottom: 16, color: '#f59e0b' }}>
              With Loci — Memory accumulates across sessions
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Session 1', recall: null,                            task: 'Fix: i ≤ arr.length', fix: '→ i < arr.length ✓' },
                { label: 'Session 2', recall: '📋 Recall: off-by-one fix',    task: 'Fix: missing await',   fix: '→ Added await ✓'   },
                { label: 'Session 3', recall: '📋 + off-by-one, await fixes', task: 'Fix: !user.age',       fix: '→ === null ✓'       },
              ].map(function(s, i) {
                return (
                  <div key={i} style={{ flex: 1, minWidth: 140 }}>
                    <div style={{
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border-amber)',
                      borderRadius: 10, padding: '12px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>{s.label}</div>
                      {s.recall && (
                        <div style={{
                          fontFamily: 'ui-monospace, monospace', fontSize: 10,
                          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                          borderRadius: 6, padding: '4px 8px', color: '#34d399',
                          marginBottom: 8, textAlign: 'left',
                        }}>{s.recall}</div>
                      )}
                      <div style={{
                        fontFamily: 'ui-monospace, monospace', fontSize: 11,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '6px 8px', color: 'var(--text-2)', textAlign: 'left',
                      }}>{s.task}</div>
                      <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, marginTop: 8 }}>{s.fix}</div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <span className="tag tag-amber">↓ stored in Loci</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 10, padding: '12px 16px',
          fontSize: 13, color: '#fbbf24', lineHeight: 1.7,
        }}>
          <strong style={{ color: '#fde68a' }}>The core insight:</strong> the information needed to avoid re-learning
          the same lesson already exists in prior agent runs. The problem is that nothing persists it, structures it,
          or makes it queryable at retrieval time.
        </div>
      </section>

      {/* ── Section 2: Prior Work ── */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#a78bfa',
          }}>2</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Prior Work</h3>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['System', 'Memory Type', 'Persistent?', 'Open API?', 'Key Limitation'].map(function(h, i) {
                    return (
                      <th key={i} style={{
                        padding: '10px 16px', textAlign: i >= 2 && i <= 3 ? 'center' : 'left',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'var(--text-3)', background: 'var(--bg-raised)', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'ChatGPT Memory', type: 'User-curated summaries', persistent: true,  open: false, limit: 'Black box; not programmable; ChatGPT UI only, never via API' },
                  { name: 'LangChain',      type: 'Buffer / summary / KG',   persistent: false, open: true,  limit: 'In-process only; no cross-restart persistence; framework lock-in' },
                  { name: 'MemGPT',         type: 'OS-style context paging', persistent: false, open: true,  limit: 'Requires MemGPT agent framework; high overhead; not a thin layer' },
                  { name: 'Zep',            type: 'Episodic + semantic (chat)', persistent: true, open: true, limit: 'Designed for chat history, not tasks; hosted SaaS; no edge deploy' },
                ].map(function(row, i) {
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{row.name}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-2)', fontSize: 12, whiteSpace: 'nowrap' }}>{row.type}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <span className={'tag ' + (row.persistent ? 'tag-green' : 'tag-red')}>{row.persistent ? 'Yes' : 'No'}</span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <span className={'tag ' + (row.open ? 'tag-green' : 'tag-red')}>{row.open ? 'Yes' : 'No'}</span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-2)', maxWidth: 280 }}>{row.limit}</td>
                    </tr>
                  );
                })}
                {/* Loci row */}
                <tr style={{ background: 'rgba(245,158,11,0.05)', borderTop: '1px solid var(--border-amber)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: '#f59e0b', whiteSpace: 'nowrap' }}>
                    Loci <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)' }}>(this work)</span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#f59e0b', whiteSpace: 'nowrap' }}>Working / Episodic / Semantic</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span className="tag tag-amber">Yes</span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span className="tag tag-amber">Yes</span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#f59e0b' }}>Drop-in SDK; edge-native; wraps any agent function in one line</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Section 3: How Loci Is Different ── */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#f59e0b',
          }}>3</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>How Loci Is Different</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {[
            {
              icon: '🔌',
              title: 'Infrastructure, not a framework',
              body: 'wrapWithMemory() wraps any async (input) → output function in a single line. No agent refactor, no framework lock-in, no new runtime.',
              code: 'const agent = wrapWithMemory(myFn, loci, userId);',
            },
            {
              icon: '🌍',
              title: 'Edge-native and globally distributed',
              body: 'Built entirely on Cloudflare Workers + D1 + Vectorize. Runs at the edge in every region — sub-millisecond cold start, no server to manage.',
              code: null,
            },
            {
              icon: '🧬',
              title: 'Three-layer cognitive model',
              body: 'Working memory (active session), episodic memory (past runs), semantic memory (distilled rules). Mirrors the human cognitive architecture.',
              code: null,
            },
            {
              icon: '🔍',
              title: 'Fully programmable and queryable',
              body: 'Every memory layer is readable and writable via a typed REST API. Agents and humans can inspect, search, prune, and augment memory at any time.',
              code: null,
            },
          ].map(function(card, i) {
            return (
              <div key={i} className="card-raised" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>{card.icon}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>{card.title}</span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }}>{card.body}</p>
                {card.code && (
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
                    background: '#080b10', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '8px 12px', color: '#4ade80', marginTop: 12,
                  }}>{card.code}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 4: Benchmark Results ── */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#34d399',
          }}>4</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Benchmark Results</h3>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 20 }}>
          Agent:{' '}
          <span style={{ fontFamily: 'ui-monospace, monospace', background: 'var(--bg-raised)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-2)', fontSize: 11.5 }}>
            claude-sonnet-4-20250514
          </span>
          {' '}· 3 TypeScript bug-fix tasks · run end-to-end against deployed Cloudflare Worker
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>

          {/* Cold */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{
              background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>🚫</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-2)' }}>Without Loci</span>
              <span className="tag tag-gray" style={{ marginLeft: 'auto' }}>Cold Start</span>
            </div>
            <div style={{ padding: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Task', 'Fix', 'Tokens'].map(function(h, i) {
                      return (
                        <th key={i} style={{
                          padding: '6px 0', textAlign: i === 2 ? 'right' : i === 1 ? 'center' : 'left',
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.08em', color: 'var(--text-3)',
                        }}>{h}</th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { task: 'Off-by-one',    tokens: 250  },
                    { task: 'Missing await', tokens: 238  },
                    { task: 'Falsy zero',    tokens: 344  },
                  ].map(function(r, i) {
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 0', color: 'var(--text-2)' }}>{r.task}</td>
                        <td style={{ padding: '8px 0', textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>✓</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: 'var(--text-3)' }}>~{r.tokens}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td style={{ paddingTop: 10, fontWeight: 700, color: 'var(--text-1)' }}>Total</td>
                    <td style={{ paddingTop: 10, textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>3/3</td>
                    <td style={{ paddingTop: 10, textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--text-1)' }}>~832</td>
                  </tr>
                </tbody>
              </table>
              <div style={{
                marginTop: 14, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', marginBottom: 2 }}>Cross-session recall</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>0 episodes stored</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Each task starts from scratch. No patterns carried forward.</div>
              </div>
            </div>
          </div>

          {/* With Loci */}
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-amber)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 0 30px rgba(245,158,11,0.07)',
          }}>
            <div style={{
              background: 'rgba(245,158,11,0.07)', borderBottom: '1px solid var(--border-amber)',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>🧠</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#f59e0b' }}>With Loci</span>
              <span className="tag tag-amber" style={{ marginLeft: 'auto' }}>Memory-Augmented</span>
            </div>
            <div style={{ padding: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Task', 'Fix', 'Injected', 'Tokens'].map(function(h, i) {
                      return (
                        <th key={i} style={{
                          padding: '6px 0', textAlign: i >= 1 ? 'center' : 'left',
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.08em', color: 'var(--text-3)',
                        }}>{h}</th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { task: 'Off-by-one',    injected: 5, tokens: 3076 },
                    { task: 'Missing await', injected: 2, tokens: 1320 },
                    { task: 'Falsy zero',    injected: 2, tokens: 1426 },
                  ].map(function(r, i) {
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 0', color: 'var(--text-2)' }}>{r.task}</td>
                        <td style={{ padding: '8px 0', textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>✓</td>
                        <td style={{ padding: '8px 0', textAlign: 'center' }}>
                          <span className="tag tag-amber">{r.injected}</span>
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'center', fontFamily: 'ui-monospace, monospace', color: 'var(--text-3)' }}>~{r.tokens.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td style={{ paddingTop: 10, fontWeight: 700, color: '#f59e0b' }}>Total</td>
                    <td style={{ paddingTop: 10, textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>3/3</td>
                    <td style={{ paddingTop: 10, textAlign: 'center' }}>
                      <span className="tag tag-amber">9</span>
                    </td>
                    <td style={{ paddingTop: 10, textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#f59e0b' }}>~5,822</td>
                  </tr>
                </tbody>
              </table>
              <div style={{
                marginTop: 14, background: 'rgba(245,158,11,0.07)', border: '1px solid var(--border-amber)',
                borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 2 }}>Cross-session recall</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>3 episodes persisted to D1 + Vectorize</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Prior fixes visible in subsequent tasks' system prompts. Patterns compound over time.</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '14px 18px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.75,
        }}>
          <strong style={{ color: 'var(--text-1)' }}>Interpretation:</strong> Both agents score 3/3 on these
          introductory tasks — a cold LLM handles simple bugs fine. The value of Loci's memory
          shows at scale: on production codebases with domain-specific invariants, project conventions,
          and repeated error patterns, accumulated episodic context gives the agent concrete prior
          knowledge that cold-start cannot replicate. The token overhead (~7× per task) is the
          measurable cost of continuity.
        </div>
      </section>

    </div>
  );
}
