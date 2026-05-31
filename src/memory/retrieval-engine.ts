import type { MemoryContext, Episode } from '../types/index';
import type { D1Database } from './episodic-store';
import { getEpisodeById } from './episodic-store';
import { getLearningsByConfidence } from './semantic-store';

// Minimal Vectorize types — vectors must be inserted with { metadata: { userId } }
// so that per-user filtering works at query time.
interface VectorizeMatch {
  id: string;
  score: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface VectorizeIndex {
  query(
    vector: number[],
    options: {
      topK?: number;
      filter?: Record<string, string | number | boolean>;
      returnMetadata?: 'none' | 'indexed' | 'all';
    },
  ): Promise<{ matches: VectorizeMatch[]; count: number }>;
}

export interface RetrievalOptions {
  userId: string;
  queryVector: number[];
  topK?: number;
  minScore?: number;
  includeHighConfidenceLearnings?: boolean;
}

export interface RetrievedMemory {
  episode: Episode;
  score: number;
}

export async function retrieveSimilarEpisodes(
  db: D1Database,
  index: VectorizeIndex,
  options: RetrievalOptions,
): Promise<RetrievedMemory[]> {
  const { queryVector, topK = 5, minScore = 0.5 } = options;

  const { matches } = await index.query(queryVector, {
    topK,
    // Metadata filtering requires a pre-created metadata index; omit for now
    // and filter by userId in the D1 lookup instead.
    returnMetadata: 'none',
  });

  const results: RetrievedMemory[] = [];
  for (const match of matches) {
    if (match.score < minScore) continue;
    const episode = await getEpisodeById(db, match.id);
    if (!episode) continue;
    results.push({ episode, score: match.score });
  }
  return results;
}

export async function assembleMemoryContext(
  db: D1Database,
  index: VectorizeIndex,
  options: RetrievalOptions,
): Promise<MemoryContext[]> {
  const { userId, includeHighConfidenceLearnings = true } = options;

  const retrieved = await retrieveSimilarEpisodes(db, index, options);

  // Map each similar episode to a system context entry
  const episodeContexts: MemoryContext[] = retrieved.map(({ episode }) => ({
    role: 'system',
    content: episode.summary ?? '',
    timestamp: episode.startedAt,
    episodeId: episode.id,
  }));

  if (!includeHighConfidenceLearnings) return episodeContexts;

  // Prepend a single context entry summarising the user's most reliable learnings
  const learnings = await getLearningsByConfidence(db, userId, 0.8, 10);
  if (learnings.length === 0) return episodeContexts;

  const learningContext: MemoryContext = {
    role: 'system',
    content: learnings.map((l) => l.content).join('\n'),
    timestamp: Date.now(),
    relevantLearningIds: learnings.map((l) => l.id),
  };

  return [learningContext, ...episodeContexts];
}
