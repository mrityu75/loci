# Contributing to Loci

Thanks for your interest. This document explains how to reproduce the demo results, understand the project structure, and make changes safely.

---

## Reproducing the Benchmark

These steps take you from zero to a running side-by-side comparison.

### Requirements

- Node.js 18+
- A Cloudflare account (free tier is sufficient)
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))
- Wrangler CLI: `npm install -g wrangler`

### Steps

```bash
# 1. Clone and install
git clone https://github.com/mrityu75/loci.git
cd loci
npm install

# 2. Authenticate with Cloudflare
wrangler login

# 3. Create a D1 database and paste the returned database_id into wrangler.jsonc
wrangler d1 create loci-db

# 4. Apply schema
wrangler d1 execute loci-db --remote --file=src/db/schema.sql

# 5. Create Vectorize indexes
wrangler vectorize create loci-episodes --dimensions=1536 --metric=cosine
wrangler vectorize create loci-learnings --dimensions=1536 --metric=cosine

# 6. Create the Queue
wrangler queues create loci-memory-consolidation

# 7. Deploy the Worker
npx wrangler deploy

# 8. Copy your credentials
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY and LOCI_API_URL

# 9. Run without Loci (cold start baseline)
source .env
npx tsx demo/run-without-loci.ts

# 10. Run with Loci (memory-augmented)
npx tsx demo/run-with-loci.ts
```

Expected output: 3/3 fixes detected in both runs. The with-Loci run prints a `[MEMORY CONTEXT]` block injected into each task's system prompt, growing richer with each successive task.

---

## Project Structure

```
src/memory/          Core memory logic — episodic store, semantic store, retrieval engine
src/workers/         Cloudflare Worker entry point (HTTP routes + queue handler)
src/types/           Shared TypeScript interfaces
sdk/                 LociClient, wrapWithMemory, buildMemoryPrompt
demo/                Standalone demo scripts and task fixtures
dashboard/           Browser dashboard (React 18 + Tailwind, no build step)
```

Key invariants:
- `src/` contains only Worker-compatible code (no Node.js built-ins)
- `sdk/` and `demo/` are Node.js — they call the Worker over HTTP
- The `D1Database` and `VectorizeIndex` interfaces are hand-typed in `src/`; do not add `@cloudflare/workers-types` as a hard dependency in code paths shared with `sdk/`

---

## Making Changes

### Worker changes

```bash
# Type-check
npx tsc --noEmit

# Deploy and test
npx wrangler deploy
curl https://loci.<your-subdomain>.workers.dev/health
```

### SDK / demo changes

```bash
npx tsc --noEmit
# Then re-run the demo to verify end-to-end
```

### Local development

```bash
# Run Worker locally (uses local D1 + Vectorize mocks)
npx wrangler dev
# Then set LOCI_API_URL=http://localhost:8787 in .env
```

Note: `wrangler dev` mocks Vectorize — stored vectors will not persist between `dev` restarts. Use `--remote` for full end-to-end fidelity:

```bash
npx wrangler dev --remote
```

---

## Secrets and Security

- **Never commit `.env`** — it is gitignored. Use `.env.example` for templates.
- **Never commit `wrangler.jsonc` API tokens** — authenticate via `wrangler login` only.
- The `account_id` in `wrangler.jsonc` is a non-sensitive public identifier (visible in Cloudflare dashboard URLs). It does not grant access on its own.
- If you accidentally commit a real API key: rotate it immediately at [console.anthropic.com](https://console.anthropic.com) or the relevant provider, then use `git filter-repo` to scrub history.

---

## Embedding Models

The demo uses a character-frequency vector (`demoEmbed`) — fast, no extra keys, but not semantically meaningful. For real retrieval quality, replace it in two places:

1. `src/workers/memory-api.ts` — `demoEmbed()` call in `handlePostEpisode` (embedding at store time)
2. `demo/run-with-loci.ts` — `demoEmbed()` call passed as `vector` to `wrapWithMemory` (query vector)

Good drop-in options:
- **Cloudflare Workers AI** — runs in the same Worker, no extra key: `@cf/baai/bge-large-en-v1.5` (1024-dim); change Vectorize index dimensions to 1024
- **OpenAI** — `text-embedding-3-small` (1536-dim); set `OPENAI_API_KEY` in `.env`
- **Cohere** — `embed-english-v3.0` (1024-dim)

When using a real embedding model, raise `minScore` from `0.1` back to `0.5–0.7` in `src/memory/retrieval-engine.ts`.

---

## Questions

Open an issue or reach out via the Stanford CS153 course channel.
