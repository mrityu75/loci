# Loci — Persistent Episodic Memory for AI Agents

[![Live Demo](https://img.shields.io/badge/Live%20Demo-loci.mrityu75.workers.dev-brightgreen?style=flat-square)](https://loci.mrityu75.workers.dev)
[![GitHub](https://img.shields.io/badge/GitHub-mrityu75%2Floci-181717?style=flat-square&logo=github)](https://github.com/mrityu75/loci)
[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Deploy%20to-Cloudflare%20Workers-F38020?style=flat-square&logo=cloudflare)](https://deploy.workers.cloudflare.com/?url=https://github.com/mrityu75/loci)

> *"What we remember, we become."*

Loci gives AI agents the ability to remember across sessions. Most agent frameworks reset to zero on every run — no learning, no continuity, no accumulated context. Loci fixes that with a structured, retrievable memory layer built entirely on Cloudflare's edge infrastructure.

**Stanford CS153 Final Project · Spring 2026 · Mrityunjay Kumar**

---

## The Method of Loci

The name comes from an ancient Greek mnemonic technique: to remember a long list, you imagine placing each item at a specific location along a familiar path — a palace, a street, a garden. To recall, you simply walk the path again and each location triggers its memory.

Loci applies this metaphor to AI agents:

- **Episodes** are memories placed at specific moments in time (the "locations")
- **Learnings** are distilled rules extracted from those episodes (the "items stored")
- **Retrieval** is walking the path — querying by vector similarity to surface what's relevant *right now*

The result: an agent that compounds knowledge over time instead of starting from scratch on every run.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Process                            │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │  Your Agent  │───▶│         wrapWithMemory()             │   │
│  │   (any LLM)  │◀───│  sdk/agent-wrapper.ts                │   │
│  └──────────────┘    │                                      │   │
│                      │  1. retrieveContext (POST /retrieve) │   │
│                      │  2. buildMemoryPrompt                │   │
│                      │  3. call agent with enriched prompt  │   │
│                      │  4. storeEpisode (POST /episode)     │   │
│                      └──────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────┘
                                   │  HTTP (LociClient SDK)
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Cloudflare Worker (Edge)                      │
│                   src/workers/memory-api.ts                     │
│                                                                 │
│  POST /episode      GET /episodes      GET /episode/:id         │
│  POST /retrieve     GET /learnings     POST /session            │
│  GET /health        OPTIONS (CORS)                              │
│                                                                 │
│  ┌──────────────────────┐   ┌──────────────────────────────┐    │
│  │   Episodic Store     │   │     Retrieval Engine         │    │
│  │ episodic-store.ts    │   │   retrieval-engine.ts        │    │
│  └──────────┬───────────┘   └──────────────┬───────────────┘    │
│             │                              │                    │
└─────────────┼──────────────────────────────┼────────────────────┘
              │                              │
    ┌─────────▼──────────┐       ┌───────────▼────────────┐
    │   Cloudflare D1    │       │  Cloudflare Vectorize  │
    │  (SQLite at edge)  │       │  (1536-dim embeddings) │
    │                    │       │                        │
    │  episodes          │       │  loci-episodes index   │
    │  learnings         │       │  loci-learnings index  │
    │  working_memory    │       │                        │
    └────────────────────┘       └────────────────────────┘

    ┌─────────────────────────────────────────────────────────┐
    │              Cloudflare Durable Objects                 │
    │              WorkingMemoryDO (per-session state)        │
    └─────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────┐
    │              Cloudflare Queues                          │
    │              loci-memory-consolidation                  │
    │              (async learning extraction pipeline)       │
    └─────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────┐
    │                    Dashboard                            │
    │  dashboard/index.html  (React 18 + Tailwind, no build) │
    │                                                         │
    │  Episodes tab    Learnings tab    Retrieval Trace tab   │
    └─────────────────────────────────────────────────────────┘
```

---

## Memory Model

Loci separates memory into three layers, mirroring human cognitive architecture:

| Layer | Storage | Purpose | Retrieval |
|---|---|---|---|
| **Working Memory** | Durable Objects + D1 | Active session state, in-flight context | Direct session lookup |
| **Episodic Memory** | D1 + Vectorize | Full record of past agent runs | Vector similarity search |
| **Semantic Memory** | D1 | Distilled rules, reinforced learnings | Confidence threshold query |

**D1 schema** — three tables, all indexed:
```sql
episodes        (id, session_id, user_id, started_at, ended_at, summary, embedding_id, metadata)
learnings       (id, episode_id, user_id, content, category, confidence, reinforcement_count, ...)
working_memory  (id, session_id, user_id, state, active_episode_id, context_window, updated_at)
```

---

## Benchmark Results

The demo runs a coding agent (`claude-sonnet-4-20250514`) against 3 realistic TypeScript bugs:
1. Off-by-one loop condition (`<=` vs `<`)
2. Missing `await` on async call
3. Falsy-zero null check (`!user.age` vs `user.age === null`)

### Cold Start (Without Loci)

| Task | Fix Detected | System Prompt | Input Tokens | Cross-Session Recall |
|---|---|---|---|---|
| task-1-off-by-one | ✓ | None | ~250 | None |
| task-2-missing-await | ✓ | None | ~238 | None |
| task-3-falsy-zero | ✓ | None | ~344 | None |
| **Total** | **3 / 3** | — | **~832** | **0 episodes stored** |

### Memory-Augmented (With Loci)

| Task | Fix Detected | Episodes Injected | Input Tokens | Episodes Stored |
|---|---|---|---|---|
| task-1-off-by-one | ✓ | 5 (from prior runs) | ~3,076 | 1 new |
| task-2-missing-await | ✓ | 2 | ~1,320 | 1 new |
| task-3-falsy-zero | ✓ | 2 | ~1,426 | 1 new |
| **Total** | **3 / 3** | **9 injected** | **~5,822** | **3 persisted** |

### What the Numbers Mean

Both agents score 3/3 — the tasks are straightforward enough that a cold LLM handles them. The value of Loci shows in the context column and the last:

- **With Loci**, the agent's system prompt for task 2 contained the full solution to task 1, including the exact fix pattern and its explanation. On real codebases with idiosyncratic conventions, repeated patterns, or domain-specific invariants, that accumulated context is the difference between an agent that improves over time and one that perpetually rediscovers the same answers.
- **Persistence**: episodes survive process restarts, model changes, and new sessions. A human developer joining the project reads past tickets; an agent using Loci reads past episodes.

---

## Repository Layout

```
loci/
├── src/
│   ├── types/index.ts          — Episode, Learning, WorkingMemoryState, MemoryContext
│   ├── db/schema.sql           — D1 table definitions
│   └── memory/
│       ├── episodic-store.ts   — D1 CRUD for episodes
│       ├── semantic-store.ts   — D1 CRUD for learnings
│       └── retrieval-engine.ts — Vectorize similarity + context assembly
├── src/workers/
│   └── memory-api.ts           — Cloudflare Worker: all HTTP routes + queue handler
├── sdk/
│   ├── loci-client.ts          — Typed HTTP client (LociClient class)
│   ├── agent-wrapper.ts        — wrapWithMemory() higher-order function
│   └── prompt-builder.ts       — buildMemoryPrompt() / stripMemoryPrompt()
├── demo/
│   ├── coding-agent.ts         — AgentFn: claude-sonnet-4-20250514 via Anthropic SDK
│   ├── tasks/buggy-tasks.ts    — 3 TypeScript bug fixtures
│   ├── run-without-loci.ts     — Baseline: cold-start agent, no memory
│   └── run-with-loci.ts        — Memory-augmented: wrapWithMemory lifecycle
├── dashboard/
│   └── index.html              — React 18 + Tailwind dashboard (CDN, no build step)
├── wrangler.jsonc              — Cloudflare Worker config (D1, Vectorize, DO, Queue)
├── .env.example                — Required environment variables (template)
└── CONTRIBUTING.md             — How to reproduce results locally
```

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- Wrangler CLI: `npm install -g wrangler`
- Anthropic API key (for the demo agent only — get one at [console.anthropic.com](https://console.anthropic.com))

### 1. Clone and install

```bash
git clone https://github.com/mrityu75/loci.git
cd loci
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY
```

### 3. Authenticate with Cloudflare

```bash
wrangler login
```

### 4. Create Cloudflare resources

```bash
# D1 database
wrangler d1 create loci-db
# Copy the database_id from the output into wrangler.jsonc → d1_databases[0].database_id

# Apply schema
wrangler d1 execute loci-db --remote --file=src/db/schema.sql

# Vectorize indexes (1536 dimensions, cosine similarity)
wrangler vectorize create loci-episodes --dimensions=1536 --metric=cosine
wrangler vectorize create loci-learnings --dimensions=1536 --metric=cosine

# Queue
wrangler queues create loci-memory-consolidation
```

### 5. Deploy

```bash
npx wrangler deploy
# Outputs: https://loci.<your-subdomain>.workers.dev
```

### 6. Run the demos

```bash
# Baseline — cold start, no memory
ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d= -f2) \
  npx tsx demo/run-without-loci.ts

# Memory-augmented — episodes stored and retrieved across tasks
ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d= -f2) \
  LOCI_API_URL=https://loci.<your-subdomain>.workers.dev \
  npx tsx demo/run-with-loci.ts
```

### 7. Open the dashboard

Navigate to `https://loci.<your-subdomain>.workers.dev` in a browser. Set the API URL and a user ID (e.g. `demo-user-001`) to browse stored episodes, learnings, and retrieval traces.

---

## SDK Usage

```typescript
import { LociClient } from './sdk/loci-client';
import { wrapWithMemory } from './sdk/agent-wrapper';

const loci = new LociClient('https://loci.<your-subdomain>.workers.dev');

// Wrap any agent function — the memory lifecycle is handled automatically
const myAgent = async ({ systemPrompt, userMessage }) => { /* call your LLM */ };
const memoryAgent = wrapWithMemory(myAgent, loci, 'user-id');

const result = await memoryAgent({
  sessionId: 'session-001',
  userMessage: 'Fix this TypeScript bug: ...',
  vector: myEmbedFn('Fix this TypeScript bug: ...'),
});

console.log(result.reply);      // agent response
console.log(result.episodeId);  // UUID of the stored episode
```

`wrapWithMemory` handles the full lifecycle automatically:

1. `upsertSession(active)` — mark session as in-progress in D1
2. `retrieveContext` — vector similarity search across prior episodes
3. `buildMemoryPrompt` — format retrieved episodes into a `[MEMORY CONTEXT]` system prompt block
4. Call your agent with the enriched prompt
5. `storeEpisode` — persist the interaction to D1 + Vectorize
6. `upsertSession(idle)` — mark session complete

---

## Production Notes

**Embeddings**: The demo uses a character-frequency vector (1536-dim, unit-normalized) so the full pipeline runs without extra API keys. For semantic search, swap `demoEmbed()` for a real model:
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/models/text-embeddings/) — `@cf/baai/bge-large-en-v1.5` (1024-dim, runs at edge, no extra key)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings) — `text-embedding-3-small` (1536-dim)
- [Cohere Embed v3](https://docs.cohere.com/docs/embeddings) (1024-dim)

**minScore threshold**: Default is `0.1` (tuned for character-frequency vectors). Raise to `0.5–0.7` when using a real semantic embedding model.

**Learning consolidation**: The Cloudflare Queue and `queue` export in `memory-api.ts` provide the hook for async learning extraction. The current stub acknowledges all messages; reinforcement logic (extracting generalizations from episodes, updating confidence scores) goes there.

---

## AI Usage Disclosure

This project was built with:
- **[Claude Code](https://claude.ai/code)** (Anthropic) — used throughout development for code generation, debugging, and iteration
- **Anthropic API** (`claude-sonnet-4-20250514`) — powers the coding agent in the demo

All code was reviewed, tested end-to-end, and understood by the author.

---

## License

MIT — see [LICENSE](./LICENSE)

---

*Loci · Stanford CS153 · Spring 2026 · Mrityunjay Kumar*
