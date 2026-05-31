import type { Episode, MemoryContext, WorkingMemoryState } from '../src/types/index';

export interface StoreEpisodeInput {
  sessionId: string;
  userId: string;
  startedAt?: number;
  endedAt?: number;
  summary?: string;
  embeddingId?: string;
  metadata?: Record<string, unknown>;
}

export interface StoreEpisodeResult {
  id: string;
  episode: Episode;
}

export interface RetrieveContextInput {
  userId: string;
  vector: number[];
  topK?: number;
  minScore?: number;
  includeHighConfidenceLearnings?: boolean;
}

export interface UpsertSessionInput {
  sessionId: string;
  userId: string;
  state?: WorkingMemoryState['state'];
  activeEpisodeId?: string;
  contextWindow?: MemoryContext[];
}

export class LociClient {
  private apiUrl: string;

  constructor(apiUrl: string) {
    // Strip trailing slash so callers don't have to think about it
    this.apiUrl = apiUrl.replace(/\/$/, '');
  }

  async storeEpisode(input: StoreEpisodeInput): Promise<StoreEpisodeResult> {
    const res = await fetch(`${this.apiUrl}/episode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`storeEpisode failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<StoreEpisodeResult>;
  }

  async retrieveContext(input: RetrieveContextInput): Promise<MemoryContext[]> {
    const res = await fetch(`${this.apiUrl}/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`retrieveContext failed (${res.status}): ${text}`);
    }

    const data = await res.json() as { contexts: MemoryContext[] };
    return data.contexts;
  }

  async upsertSession(input: UpsertSessionInput): Promise<WorkingMemoryState> {
    const res = await fetch(`${this.apiUrl}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`upsertSession failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<WorkingMemoryState>;
  }
}
