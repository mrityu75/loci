// Global scope — no import/export. Loaded before all component scripts.
// TypeScript interfaces and generics are stripped by Babel at runtime;
// they exist solely as in-file documentation and editor hints.

interface Episode {
  id: string;
  sessionId: string;
  userId: string;
  startedAt: number;
  endedAt?: number;
  summary?: string;
  embeddingId?: string;
  metadata: Record<string, unknown>;
}

interface Learning {
  id: string;
  episodeId: string;
  userId: string;
  content: string;
  category: string;
  confidence: number;
  reinforcementCount: number;
  embeddingId?: string;
  createdAt: number;
  lastReinforcedAt: number;
  metadata: Record<string, unknown>;
}

interface MemoryContext {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  episodeId?: string;
  relevantLearningIds?: string[];
}

interface HealthStatus {
  status: string;
  timestamp: number;
}

class LociApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async health(): Promise<HealthStatus> {
    return this.get<HealthStatus>('/health');
  }

  async getEpisodes(userId: string, limit = 50): Promise<Episode[]> {
    const q = new URLSearchParams({ userId, limit: String(limit) });
    const data = await this.get<{ episodes: Episode[] }>(`/episodes?${q}`);
    return data.episodes;
  }

  async getEpisodeById(id: string): Promise<Episode> {
    const data = await this.get<{ episode: Episode }>(`/episode/${encodeURIComponent(id)}`);
    return data.episode;
  }

  async getLearnings(userId: string): Promise<Learning[]> {
    const q = new URLSearchParams({ userId });
    const data = await this.get<{ learnings: Learning[] }>(`/learnings?${q}`);
    return data.learnings;
  }
}
