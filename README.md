# Loci — Persistent Episodic Memory for AI Agents

[![Live Demo](https://img.shields.io/badge/Live%20Demo-loci.mrityu75.workers.dev-brightgreen?style=flat-square)](https://loci.mrityu75.workers.dev)
[![GitHub](https://img.shields.io/badge/GitHub-mrityu75%2Floci-181717?style=flat-square&logo=github)](https://github.com/mrityu75/loci)
[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Deploy%20to-Cloudflare%20Workers-F38020?style=flat-square&logo=cloudflare)](https://deploy.workers.cloudflare.com/?url=https://github.com/mrityu75/loci)
[![Stanford CS153](https://img.shields.io/badge/Stanford-CS153%20Spring%202026-8C1515?style=flat-square)](https://github.com/mrityu75/loci)

**Stanford CS153 Final Project · Spring 2026 · Mrityunjay Kumar**

---

## The Problem

AI assistants like Claude, GPT-4, and Gemini have no memory between conversations. Every time you open a new chat, they start completely fresh — they don't remember what you told them last time, what mistakes they made, or what they already figured out. Imagine hiring a contractor who showed up every morning with no memory of the blueprints they studied the day before. That's how AI agents work today. If you spent an hour teaching Claude your codebase's conventions in one session, and then opened a new chat the next day, it would have forgotten everything. You'd have to explain it all over again. Loci solves this by giving agents a persistent memory layer — so what an agent learns in one session is available in the next.

---

## What Loci Does

Loci is a memory system that sits between your AI agent and its past experiences. When an agent finishes a task, Loci stores it as an "episode" — a structured record of what the task was, what the agent did, and what it learned. Before the agent starts its next task, Loci searches those stored episodes and injects the most relevant ones directly into the agent's context. The agent can see its own history.

---

## Live Demo

**Link:** [https://loci.mrityu75.workers.dev](https://loci.mrityu75.workers.dev)

Open the link, paste any coding task into the text box, then click both buttons — **"Run Without Memory"** and **"Run With Memory"** — to see the difference side by side. The version with memory shows what prior episodes were injected and what gets stored after.

---

## Why This Matters — Use Cases

- **Coding agents** that accumulate knowledge about your codebase: your naming conventions, recurring bugs, team preferences, and architectural decisions — building up expertise the same way a senior developer does.
- **Research agents** that remember what sources they've already consulted, what hypotheses were already ruled out, and what findings should carry forward into the next research session.
- **Production AI systems** where cold-start failure is expensive: customer support agents that remember past tickets, data pipeline agents that remember which transformations already failed, or any long-running automated workflow where forgetting is a bug.

---

## How It Works — Architecture

When an agent runs a task, Loci stores it as an episode containing the task description, the agent's full response, a summary, and a vector embedding. Before the next task, Loci retrieves similar past episodes by comparing vectors and injects them into the system prompt. The agent sees its own history as structured context — not raw logs, but formatted memory blocks that tell it what it already knows.

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

Both agents score 3/3 on these tasks — the bugs are simple enough that a cold LLM handles them fine. That's intentional: the goal of the benchmark is to demonstrate the memory pipeline works end-to-end (store, retrieve, inject), not to manufacture an artificial accuracy gap.

The meaningful difference shows in the **Episodes Injected** and **Episodes Stored** columns:

- **With Loci**, the agent's prompt for task 2 contained the full context from task 1 — the exact fix, the reasoning, and the explanation. On a real codebase with domain-specific conventions, repeated patterns, or project-specific invariants, that accumulated context is the difference between an agent that improves over time and one that perpetually rediscovers the same answers.
- **Persistence**: episodes survive process restarts, model changes, and new sessions. A human developer joining a project reads past tickets and Slack threads; an agent using Loci reads past episodes.
- On complex real-world tasks (long multi-file refactors, tasks with project-specific constraints, agents that make mistakes and self-correct), the accuracy gap between cold and memory-augmented agents would be substantially larger.

---

## Limitations

These are real limitations, not hedges:

- **Character-frequency embeddings, not semantic embeddings.** The current demo uses a 1536-dimensional character-frequency vector for retrieval. This means two episodes with similar words but different meanings may score higher than two semantically related episodes with different vocabulary. Swapping in a real embedding model (Cloudflare Workers AI, OpenAI `text-embedding-3-small`, or Cohere) would dramatically improve retrieval quality.
- **Distillation pipeline is scaffolded, not complete.** The Cloudflare Queue and queue handler exist and the architecture is wired up, but the reinforcement logic — extracting generalizations from episodes, updating confidence scores on learnings — is a stub that acknowledges messages without processing them. The semantic memory layer (learnings table) is populated through the API but not yet auto-populated from episodes.
- **Single-user demo, no auth.** The live demo has no authentication. Any user can read or write any episodes by setting an arbitrary `user_id`. This is fine for a demo but would need proper auth before any real deployment.
- **Simple benchmark tasks don't show the accuracy gap.** The three TypeScript bugs used in the benchmark are solvable by any modern LLM from scratch. The memory layer's value shows more clearly on tasks that require accumulated project-specific knowledge — and those are harder to demonstrate in a reproducible, automated benchmark without a real long-running codebase.

---

## Technical Stack

- **Cloudflare Workers** — serverless compute at the edge, handles all HTTP routes
- **Cloudflare D1** — SQLite at the edge, stores episodes and learnings with full-text search
- **Cloudflare Vectorize** — managed vector database, 1536-dim cosine similarity search
- **Cloudflare Durable Objects** — per-session stateful working memory
- **Cloudflare Queues** — async pipeline for background learning consolidation
- **React 18** — dashboard UI, loaded from CDN with no build step
- **TypeScript** — entire codebase, strict mode
- **Anthropic API** — `claude-sonnet-4-20250514` powers the demo coding agent

---

## Repository Structure

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

## Setup & Reproduction

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

## What I Would Add Next

- **Real semantic embeddings.** Swap the character-frequency vector for `@cf/baai/bge-large-en-v1.5` via Cloudflare Workers AI — no extra API keys, runs at the edge, and would dramatically improve retrieval precision. Set the `minScore` threshold to `0.5–0.7` to match.
- **Distillation pipeline.** Complete the Cloudflare Queue consumer to extract generalizations from episodes: identify patterns across multiple episodes, generate rule-level learnings, and update confidence scores over time. This is where the "semantic memory" layer becomes real.
- **Multi-agent shared memory.** Allow multiple agents (or multiple instances of the same agent) to read from and write to the same memory store — so a coding agent and a code review agent on the same team share accumulated project knowledge.
- **Confidence decay.** Learnings should decay in confidence over time if they stop being reinforced. A project convention from two years ago might not apply anymore. Time-weighted retrieval would surface recent, high-confidence memories preferentially over stale ones.

---

## Research Context & Prior Work

Several systems have tackled agent memory before. Here's how Loci compares:

| System | Persistence | Vector Retrieval | Open Source | Edge-Deployable | Episodic Structure |
|---|---|---|---|---|---|
| **ChatGPT Memory** | ✓ | Unknown | ✗ | ✗ | ✗ |
| **LangChain Memory** | Partial | ✓ (with plugins) | ✓ | ✗ | ✗ |
| **MemGPT** | ✓ | ✓ | ✓ | ✗ | ✓ |
| **Zep** | ✓ | ✓ | ✓ | ✗ | Partial |
| **Loci** | ✓ | ✓ | ✓ | ✓ | ✓ |

Loci's distinguishing design choices are: (1) it runs entirely on serverless edge infrastructure with no persistent server to manage, (2) it explicitly models the three-layer cognitive architecture (working/episodic/semantic) rather than treating memory as a single flat store, and (3) the `wrapWithMemory()` SDK makes it a drop-in wrapper for any existing agent function.

The name "Loci" comes from the *method of loci*, an ancient Greek mnemonic technique: to remember a long list, you imagine placing each item at a location along a familiar path. To recall, you walk the path and each location triggers its memory. Loci applies this metaphor to AI agents — episodes are placed at moments in time, and retrieval is walking that path to surface what's relevant now.

---

## AI Usage Disclosure

**Claude Code** (Anthropic's CLI) was used for code generation throughout this project. I designed the architecture, made all technical decisions, wrote the specifications for each component, and reviewed and tested all code end-to-end. The **Anthropic API** (`claude-sonnet-4-20250514`) powers the coding agent in the live demo. Every piece of generated code was read, understood, and validated by me before being committed.

---

## Commit History & Development Process

This project was built over 3 weeks with 25+ commits covering: initial architecture design, D1 schema and episodic store, Vectorize integration, retrieval engine, SDK (`LociClient`, `wrapWithMemory`, `buildMemoryPrompt`), the demo benchmark runner, dashboard UI, and a series of visual and UX iterations on the live demo.

Full commit history: [github.com/mrityu75/loci/commits/main](https://github.com/mrityu75/loci/commits/main)

---

## License

MIT — see [LICENSE](./LICENSE)

---

*Loci · Stanford CS153 · Spring 2026 · Mrityunjay Kumar*
