export interface Episode {
  id: string;
  sessionId: string;
  userId: string;
  startedAt: number;
  endedAt?: number;
  summary?: string;
  embeddingId?: string;
  metadata: Record<string, unknown>;
}

export interface Learning {
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

export interface WorkingMemoryState {
  id: string;
  sessionId: string;
  userId: string;
  state: 'idle' | 'active' | 'consolidating';
  activeEpisodeId?: string;
  contextWindow: MemoryContext[];
  updatedAt: number;
}

export interface MemoryContext {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  episodeId?: string;
  relevantLearningIds?: string[];
}
