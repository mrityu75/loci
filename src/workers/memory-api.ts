import type { WorkingMemoryState, MemoryContext } from '../types/index';
import type { D1Database } from '../memory/episodic-store';
import type { VectorizeIndex } from '../memory/retrieval-engine';
import {
  insertEpisode,
  getEpisodeById,
  getRecentEpisodes,
} from '../memory/episodic-store';
import { getAllLearnings } from '../memory/semantic-store';
import { assembleMemoryContext } from '../memory/retrieval-engine';

interface Env {
  DB: D1Database;
  EPISODES_INDEX: VectorizeIndex;
  LEARNINGS_INDEX: VectorizeIndex;
  WORKING_MEMORY: DurableObjectNamespace;
  MEMORY_QUEUE: Queue;
}

// Minimal DO + Queue stubs so TypeScript resolves without @cloudflare/workers-types
interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}
interface DurableObjectId { toString(): string }
interface DurableObjectStub { fetch(req: Request): Promise<Response> }
interface Queue {
  send(message: unknown): Promise<void>;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// ── working_memory D1 helpers ─────────────────────────────────────────────────

interface WorkingMemoryRow {
  id: string;
  session_id: string;
  user_id: string;
  state: string;
  active_episode_id: string | null;
  context_window: string;
  updated_at: number;
}

function rowToWorkingMemory(row: WorkingMemoryRow): WorkingMemoryState {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    state: row.state as WorkingMemoryState['state'],
    activeEpisodeId: row.active_episode_id ?? undefined,
    contextWindow: JSON.parse(row.context_window ?? '[]') as MemoryContext[],
    updatedAt: row.updated_at,
  };
}

async function upsertWorkingMemory(
  db: D1Database,
  wm: WorkingMemoryState,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO working_memory (id, session_id, user_id, state, active_episode_id, context_window, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         state             = excluded.state,
         active_episode_id = excluded.active_episode_id,
         context_window    = excluded.context_window,
         updated_at        = excluded.updated_at`,
    )
    .bind(
      wm.id,
      wm.sessionId,
      wm.userId,
      wm.state,
      wm.activeEpisodeId ?? null,
      JSON.stringify(wm.contextWindow),
      wm.updatedAt,
    )
    .run();
}

async function getWorkingMemory(
  db: D1Database,
  sessionId: string,
): Promise<WorkingMemoryState | null> {
  const row = await db
    .prepare('SELECT * FROM working_memory WHERE session_id = ?')
    .bind(sessionId)
    .first<WorkingMemoryRow>();
  return row ? rowToWorkingMemory(row) : null;
}

// ── route handlers ────────────────────────────────────────────────────────────

async function handlePostEpisode(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return err('Invalid JSON body');
  }

  const { sessionId, userId, startedAt, endedAt, summary, embeddingId, metadata } = body;
  if (typeof sessionId !== 'string' || typeof userId !== 'string') {
    return err('sessionId and userId are required strings');
  }

  const episode = {
    id: crypto.randomUUID(),
    sessionId,
    userId,
    startedAt: typeof startedAt === 'number' ? startedAt : Date.now(),
    endedAt: typeof endedAt === 'number' ? endedAt : undefined,
    summary: typeof summary === 'string' ? summary : undefined,
    embeddingId: typeof embeddingId === 'string' ? embeddingId : undefined,
    metadata: (metadata && typeof metadata === 'object' && !Array.isArray(metadata))
      ? metadata as Record<string, unknown>
      : {},
  };

  await insertEpisode(env.DB, episode);
  return json({ id: episode.id, episode }, 201);
}

// GET /retrieve
// Accepts JSON body: { userId, vector, topK?, minScore?, includeHighConfidenceLearnings? }
// Using a body with GET is intentional — vectors are too large for query params.
async function handleGetRetrieve(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return err('JSON body required: { userId, vector }');
  }

  const { userId, vector, topK, minScore, includeHighConfidenceLearnings } = body;

  if (typeof userId !== 'string') return err('userId must be a string');
  if (!Array.isArray(vector) || vector.length === 0) {
    return err('vector must be a non-empty array of numbers');
  }
  if (!vector.every((v) => typeof v === 'number')) {
    return err('all vector elements must be numbers');
  }

  const contexts = await assembleMemoryContext(env.DB, env.EPISODES_INDEX, {
    userId,
    queryVector: vector as number[],
    topK: typeof topK === 'number' ? topK : undefined,
    minScore: typeof minScore === 'number' ? minScore : undefined,
    includeHighConfidenceLearnings:
      typeof includeHighConfidenceLearnings === 'boolean'
        ? includeHighConfidenceLearnings
        : undefined,
  });

  return json({ contexts });
}

// POST /session
// Body: { sessionId, userId, state?, activeEpisodeId?, contextWindow? }
async function handlePostSession(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return err('Invalid JSON body');
  }

  const { sessionId, userId, state, activeEpisodeId, contextWindow } = body;
  if (typeof sessionId !== 'string' || typeof userId !== 'string') {
    return err('sessionId and userId are required strings');
  }

  // Merge with existing session if present
  const existing = await getWorkingMemory(env.DB, sessionId);

  const wm: WorkingMemoryState = {
    id: existing?.id ?? crypto.randomUUID(),
    sessionId,
    userId,
    state:
      typeof state === 'string' &&
      ['idle', 'active', 'consolidating'].includes(state)
        ? (state as WorkingMemoryState['state'])
        : existing?.state ?? 'idle',
    activeEpisodeId:
      typeof activeEpisodeId === 'string'
        ? activeEpisodeId
        : existing?.activeEpisodeId,
    contextWindow: Array.isArray(contextWindow)
      ? (contextWindow as MemoryContext[])
      : existing?.contextWindow ?? [],
    updatedAt: Date.now(),
  };

  await upsertWorkingMemory(env.DB, wm);
  return json(wm, existing ? 200 : 201);
}

// GET /episodes?userId=xxx&limit=50
async function handleGetEpisodes(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
  if (!userId) return err('userId query param is required');
  const episodes = await getRecentEpisodes(env.DB, userId, limit);
  return json({ episodes });
}

// GET /episode/:id
async function handleGetEpisodeById(id: string, env: Env): Promise<Response> {
  const episode = await getEpisodeById(env.DB, id);
  if (!episode) return err('Episode not found', 404);
  return json({ episode });
}

// GET /learnings?userId=xxx
async function handleGetLearnings(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return err('userId query param is required');
  const learnings = await getAllLearnings(env.DB, userId);
  return json({ learnings });
}

async function handleGetHealth(env: Env): Promise<Response> {
  // Quick D1 liveness check
  try {
    await env.DB.prepare('SELECT 1').first();
  } catch {
    return json({ status: 'degraded', db: false, timestamp: Date.now() }, 503);
  }
  return json({ status: 'ok', timestamp: Date.now() });
}

// ── fetch export ──────────────────────────────────────────────────────────────

interface MessageBatch {
  messages: { body: unknown; ack(): void }[];
}

export default {
  async queue(batch: MessageBatch, _env: Env): Promise<void> {
    // Placeholder: acknowledge all messages so the queue doesn't stall.
    // Memory consolidation logic (reinforcement, embedding) goes here.
    for (const msg of batch.messages) msg.ack();
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (method === 'POST' && pathname === '/episode') {
      return handlePostEpisode(request, env);
    }
    if (method === 'GET' && pathname === '/episodes') {
      return handleGetEpisodes(request, env);
    }
    if (method === 'GET' && pathname.startsWith('/episode/')) {
      return handleGetEpisodeById(pathname.slice('/episode/'.length), env);
    }
    if (method === 'GET' && pathname === '/retrieve') {
      return handleGetRetrieve(request, env);
    }
    if (method === 'GET' && pathname === '/learnings') {
      return handleGetLearnings(request, env);
    }
    if (method === 'POST' && pathname === '/session') {
      return handlePostSession(request, env);
    }
    if (method === 'GET' && pathname === '/health') {
      return handleGetHealth(env);
    }

    return err('Not found', 404);
  },
};

// ── Durable Object — working memory stub ─────────────────────────────────────
// Referenced by wrangler.jsonc; full session logic is handled via D1 in the
// routes above. Extend this class when real-time collaborative state is needed.

export class WorkingMemoryDO {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    return new Response('WorkingMemoryDO not yet implemented', { status: 501 });
  }
}

// Minimal DO state type to satisfy the constructor above
interface DurableObjectState {
  storage: unknown;
}
