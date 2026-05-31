import type { Learning } from '../types/index';
import type { D1Database } from './episodic-store';

interface LearningRow {
  id: string;
  episode_id: string;
  user_id: string;
  content: string;
  category: string;
  confidence: number;
  reinforcement_count: number;
  embedding_id: string | null;
  created_at: number;
  last_reinforced_at: number;
  metadata: string;
}

function rowToLearning(row: LearningRow): Learning {
  return {
    id: row.id,
    episodeId: row.episode_id,
    userId: row.user_id,
    content: row.content,
    category: row.category,
    confidence: row.confidence,
    reinforcementCount: row.reinforcement_count,
    embeddingId: row.embedding_id ?? undefined,
    createdAt: row.created_at,
    lastReinforcedAt: row.last_reinforced_at,
    metadata: JSON.parse(row.metadata ?? '{}'),
  };
}

export async function insertLearning(db: D1Database, learning: Learning): Promise<void> {
  await db
    .prepare(
      `INSERT INTO learnings
         (id, episode_id, user_id, content, category, confidence,
          reinforcement_count, embedding_id, created_at, last_reinforced_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      learning.id,
      learning.episodeId,
      learning.userId,
      learning.content,
      learning.category,
      learning.confidence,
      learning.reinforcementCount,
      learning.embeddingId ?? null,
      learning.createdAt,
      learning.lastReinforcedAt,
      JSON.stringify(learning.metadata),
    )
    .run();
}

export async function getAllLearnings(db: D1Database, userId: string): Promise<Learning[]> {
  const { results } = await db
    .prepare('SELECT * FROM learnings WHERE user_id = ? ORDER BY last_reinforced_at DESC')
    .bind(userId)
    .all<LearningRow>();
  return results.map(rowToLearning);
}

export async function getLearningsByConfidence(
  db: D1Database,
  userId: string,
  minConfidence: number,
  limit = 20,
): Promise<Learning[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM learnings
       WHERE user_id = ? AND confidence >= ?
       ORDER BY confidence DESC LIMIT ?`,
    )
    .bind(userId, minConfidence, limit)
    .all<LearningRow>();
  return results.map(rowToLearning);
}

export async function updateConfidence(
  db: D1Database,
  id: string,
  confidence: number,
  now = Date.now(),
): Promise<void> {
  await db
    .prepare(
      `UPDATE learnings
       SET confidence = ?, reinforcement_count = reinforcement_count + 1, last_reinforced_at = ?
       WHERE id = ?`,
    )
    .bind(confidence, now, id)
    .run();
}

export async function getLearningById(db: D1Database, id: string): Promise<Learning | null> {
  const row = await db
    .prepare('SELECT * FROM learnings WHERE id = ?')
    .bind(id)
    .first<LearningRow>();
  return row ? rowToLearning(row) : null;
}
