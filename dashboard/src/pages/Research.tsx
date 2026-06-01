// Global scope — React is window.React (UMD). No import/export.

function Research() {
  return (
    <div className="space-y-10 max-w-4xl">

      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Research Context</h2>
        <p className="text-slate-500 mt-1">
          The problem Loci solves, how it compares to prior work, and what the benchmark shows.
        </p>
      </div>

      {/* ── The Problem ── */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-600 text-sm font-bold shrink-0">1</span>
          The Problem: LLMs Are Stateless By Design
        </h3>

        <p className="text-slate-600 text-sm leading-relaxed">
          Every invocation of a large language model starts from zero. There is no persistent identity,
          no accumulated experience, no memory of prior interactions — only the current context window.
          For one-shot queries this is fine. For agents that perform recurring tasks, work with evolving
          codebases, or interact with the same users over time, this statelessness is a fundamental
          architectural flaw: the agent perpetually rediscovers facts it has already learned.
        </p>

        {/* Diagram */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Without memory row */}
          <div className="p-5 border-b border-slate-100">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 text-center">
              Without Memory — Each session starts cold
            </div>
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              {[
                { label: 'Session 1', task: 'Fix: i ≤ arr.length', fix: '→ Changed to i < arr.length ✓' },
                { label: 'Session 2', task: 'Fix: missing await',   fix: '→ Added await keyword ✓'     },
                { label: 'Session 3', task: 'Fix: !user.age',       fix: '→ Changed to === null ✓'     },
              ].map(function(s, i) {
                return (
                  <div key={i} className="flex-1 flex flex-col gap-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                      <div className="text-xs font-bold text-slate-500 mb-2">{s.label}</div>
                      <div className="text-xs font-mono bg-white border border-slate-100 rounded px-2 py-1.5 text-slate-700 text-left">{s.task}</div>
                      <div className="mt-2 text-xs text-green-600 font-medium">{s.fix}</div>
                    </div>
                    <div className="text-center">
                      <span className="inline-block text-xs bg-red-100 text-red-600 rounded-full px-3 py-1 font-semibold">
                        ↓ forgotten
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* With Loci row */}
          <div className="p-5 bg-blue-50/40">
            <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-3 text-center">
              With Loci — Memory accumulates across sessions
            </div>
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              {[
                { label: 'Session 1', recall: null,                           task: 'Fix: i ≤ arr.length', fix: '→ Changed to i < arr.length ✓' },
                { label: 'Session 2', recall: '📋 Recall: off-by-one fix',   task: 'Fix: missing await',   fix: '→ Added await keyword ✓'     },
                { label: 'Session 3', recall: '📋 + off-by-one, await fixes', task: 'Fix: !user.age',       fix: '→ Changed to === null ✓'     },
              ].map(function(s, i) {
                return (
                  <div key={i} className="flex-1 flex flex-col gap-2">
                    <div className="rounded-lg border border-blue-200 bg-white p-3 text-center">
                      <div className="text-xs font-bold text-blue-700 mb-2">{s.label}</div>
                      {s.recall && (
                        <div className="text-xs bg-green-50 border border-green-200 rounded px-2 py-1 mb-2 text-green-700 text-left font-mono">
                          {s.recall}
                        </div>
                      )}
                      <div className="text-xs font-mono bg-slate-50 border border-blue-100 rounded px-2 py-1.5 text-slate-700 text-left">{s.task}</div>
                      <div className="mt-2 text-xs text-green-600 font-medium">{s.fix}</div>
                    </div>
                    <div className="text-center">
                      <span className="inline-block text-xs bg-blue-100 text-blue-600 rounded-full px-3 py-1 font-semibold">
                        ↓ stored in Loci
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 leading-relaxed">
          <strong>The core insight:</strong> the information needed to avoid re-learning the same lesson already
          exists in prior agent runs. The problem is that nothing persists it, structures it, or makes it
          queryable at retrieval time.
        </div>
      </section>

      {/* ── Prior Work ── */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-600 text-sm font-bold shrink-0">2</span>
          Prior Work
        </h3>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">
                  <th className="px-4 py-3">System</th>
                  <th className="px-4 py-3">Memory Type</th>
                  <th className="px-4 py-3 text-center">Persistent?</th>
                  <th className="px-4 py-3 text-center">Open API?</th>
                  <th className="px-4 py-3">Key Limitation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  {
                    name: 'ChatGPT Memory',
                    type: 'User-curated summaries',
                    persistent: true,
                    open: false,
                    limit: 'Black box; not programmable; accessible via ChatGPT UI only, never via API',
                  },
                  {
                    name: 'LangChain Memory',
                    type: 'Buffer / summary / knowledge graph',
                    persistent: false,
                    open: true,
                    limit: 'In-process only by default; no cross-restart persistence; framework lock-in',
                  },
                  {
                    name: 'MemGPT',
                    type: 'OS-style context paging',
                    persistent: false,
                    open: true,
                    limit: 'Requires the MemGPT agent framework; high overhead; not a thin drop-in layer',
                  },
                  {
                    name: 'Zep',
                    type: 'Episodic + semantic (chat-centric)',
                    persistent: true,
                    open: true,
                    limit: 'Designed for chat history, not agent tasks; hosted SaaS; no edge deployment',
                  },
                ].map(function(row, i) {
                  return (
                    <tr key={i} className="text-slate-600 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{row.name}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{row.type}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={'text-xs font-semibold px-2 py-0.5 rounded-full ' + (row.persistent ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                          {row.persistent ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={'text-xs font-semibold px-2 py-0.5 rounded-full ' + (row.open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                          {row.open ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs">{row.limit}</td>
                    </tr>
                  );
                })}
                {/* Loci highlight row */}
                <tr className="bg-blue-50 border-t-2 border-blue-200 font-semibold">
                  <td className="px-4 py-3 text-blue-900 whitespace-nowrap">Loci <span className="text-xs font-normal text-blue-600">(this work)</span></td>
                  <td className="px-4 py-3 text-blue-700 text-xs whitespace-nowrap">Working / Episodic / Semantic</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-200 text-blue-800">Yes</span>
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-200 text-blue-800">Yes</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-blue-700">Drop-in SDK; edge-native; wraps any agent function in one line</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── How Loci Is Different ── */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-sm font-bold shrink-0">3</span>
          How Loci Is Different
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              icon: '🔌',
              color: 'blue',
              title: 'Infrastructure, not a framework',
              body: 'wrapWithMemory() wraps any async (input) → output function in a single line. No agent refactor, no framework lock-in, no new runtime.',
              code: 'const agent = wrapWithMemory(myFn, loci, userId);',
            },
            {
              icon: '🌍',
              color: 'green',
              title: 'Edge-native and globally distributed',
              body: 'Built entirely on Cloudflare Workers + D1 + Vectorize. Runs at the edge in every region — sub-millisecond cold start, no server to manage.',
              code: null,
            },
            {
              icon: '🧬',
              color: 'purple',
              title: 'Three-layer cognitive model',
              body: 'Working memory (active session), episodic memory (past runs), semantic memory (distilled rules). Mirrors the human cognitive architecture that makes memory efficient.',
              code: null,
            },
            {
              icon: '🔍',
              color: 'orange',
              title: 'Fully programmable and queryable',
              body: 'Every memory layer is readable and writable via a typed REST API. Agents and humans can inspect, search, prune, and augment memory at any time.',
              code: null,
            },
          ].map(function(card, i) {
            const border: Record<string, string> = {
              blue:   'border-blue-200',
              green:  'border-green-200',
              purple: 'border-purple-200',
              orange: 'border-orange-200',
            };
            const bg: Record<string, string> = {
              blue:   'bg-blue-50',
              green:  'bg-green-50',
              purple: 'bg-purple-50',
              orange: 'bg-orange-50',
            };
            const text: Record<string, string> = {
              blue:   'text-blue-900',
              green:  'text-green-900',
              purple: 'text-purple-900',
              orange: 'text-orange-900',
            };
            const sub: Record<string, string> = {
              blue:   'text-blue-700',
              green:  'text-green-700',
              purple: 'text-purple-700',
              orange: 'text-orange-700',
            };
            return (
              <div key={i} className={'rounded-xl border p-4 ' + border[card.color] + ' ' + bg[card.color]}>
                <div className={'flex items-center gap-2 mb-2 ' + text[card.color]}>
                  <span className="text-xl">{card.icon}</span>
                  <span className="font-bold text-sm">{card.title}</span>
                </div>
                <p className={'text-xs leading-relaxed mb-2 ' + sub[card.color]}>{card.body}</p>
                {card.code && (
                  <div className="bg-slate-900 rounded-lg px-3 py-2 font-mono text-xs text-green-300 mt-2">
                    {card.code}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Benchmark Results ── */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-600 text-sm font-bold shrink-0">4</span>
          Benchmark Results
        </h3>

        <p className="text-sm text-slate-500">
          Agent: <span className="font-mono bg-slate-100 px-1 rounded text-slate-700">claude-sonnet-4-20250514</span> ·
          3 TypeScript bug-fix tasks · run end-to-end against deployed Cloudflare Worker
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Cold */}
          <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-4 py-3 flex items-center gap-2 border-b border-slate-200">
              <span>🚫</span>
              <span className="font-bold text-slate-700 text-sm">Without Loci</span>
              <span className="ml-auto text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">Cold Start</span>
            </div>
            <div className="p-4">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-slate-400 font-semibold border-b border-slate-100">
                    <th className="pb-2">Task</th>
                    <th className="pb-2 text-center">Fix</th>
                    <th className="pb-2 text-right">Input tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600">
                  {[
                    { task: 'Off-by-one',    pass: true, tokens: 250  },
                    { task: 'Missing await', pass: true, tokens: 238  },
                    { task: 'Falsy zero',    pass: true, tokens: 344  },
                  ].map(function(r, i) {
                    return (
                      <tr key={i}>
                        <td className="py-2">{r.task}</td>
                        <td className="py-2 text-center text-green-600">✓</td>
                        <td className="py-2 text-right font-mono">~{r.tokens}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-slate-200 font-bold text-slate-700">
                    <td className="pt-2">Total</td>
                    <td className="pt-2 text-center text-green-600">3/3</td>
                    <td className="pt-2 text-right font-mono">~832</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3 text-xs">
                <div className="font-semibold text-red-700 mb-0.5">Cross-session recall</div>
                <div className="text-red-600 font-bold">0 episodes stored</div>
                <div className="text-red-500 mt-0.5">Each task starts from scratch. No patterns carried forward.</div>
              </div>
            </div>
          </div>

          {/* With Loci */}
          <div className="bg-white rounded-xl border-2 border-blue-300 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 flex items-center gap-2 border-b border-blue-200">
              <span>🧠</span>
              <span className="font-bold text-blue-800 text-sm">With Loci</span>
              <span className="ml-auto text-xs text-blue-600 bg-white border border-blue-200 rounded-full px-2 py-0.5">Memory-Augmented</span>
            </div>
            <div className="p-4">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-slate-400 font-semibold border-b border-slate-100">
                    <th className="pb-2">Task</th>
                    <th className="pb-2 text-center">Fix</th>
                    <th className="pb-2 text-center">Injected</th>
                    <th className="pb-2 text-right">Input tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600">
                  {[
                    { task: 'Off-by-one',    pass: true, injected: 5, tokens: 3076 },
                    { task: 'Missing await', pass: true, injected: 2, tokens: 1320 },
                    { task: 'Falsy zero',    pass: true, injected: 2, tokens: 1426 },
                  ].map(function(r, i) {
                    return (
                      <tr key={i}>
                        <td className="py-2">{r.task}</td>
                        <td className="py-2 text-center text-green-600">✓</td>
                        <td className="py-2 text-center">
                          <span className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-bold">{r.injected}</span>
                        </td>
                        <td className="py-2 text-right font-mono">~{r.tokens.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-blue-200 font-bold text-blue-800">
                    <td className="pt-2">Total</td>
                    <td className="pt-2 text-center text-green-600">3/3</td>
                    <td className="pt-2 text-center">
                      <span className="bg-blue-200 text-blue-900 rounded-full px-2 py-0.5">9</span>
                    </td>
                    <td className="pt-2 text-right font-mono">~5,822</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs">
                <div className="font-semibold text-blue-800 mb-0.5">Cross-session recall</div>
                <div className="text-green-600 font-bold">3 episodes persisted to D1 + Vectorize</div>
                <div className="text-blue-600 mt-0.5">Prior fixes visible in subsequent tasks' system prompts. Patterns compound over time.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 px-5 py-4 text-sm text-slate-600 leading-relaxed">
          <strong className="text-slate-800">Interpretation:</strong> Both agents score 3/3 on these
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
