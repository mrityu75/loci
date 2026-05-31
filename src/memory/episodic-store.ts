import type { Episode } from '../types/index';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta: Record<string, unknown> }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface EpisodeRow {
  id: string;
  session_id: string;
  user_id: string;
  started_at: number;
  ended_at: number | null;
  summary: string | null;
  embedding_id: string | null;
  metadata: string;
}

function rowToEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    summary: row.summary ?? undefined,
    embeddingId: row.embedding_id ?? undefined,
    metadata: JSON.parse(row.metadata ?? '{}'),
  };
}

export async function insertEpisode(db: D1Database, episode: Episode): Promise<void> {
  await db
    .prepare(
      `INSERT INTO episodes (id, session_id, user_id, started_at, ended_at, summary, embedding_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      episode.id,
      episode.sessionId,
      episode.userId,
      episode.startedAt,
      episode.endedAt ?? null,
      episode.summary ?? null,
      episode.embeddingId ?? null,
      JSON.stringify(episode.metadata),
    )
    .run();
}

export async function getEpisodeById(db: D1Database, id: string): Promise<Episode | null> {
  const row = await db.prepare('SELECT * FROM episodes WHERE id = ?').bind(id).first<EpisodeRow>();
  return row ? rowToEpisode(row) : null;
}

export async function getRecentEpisodes(
  db: D1Database,
  userId: string,
  limit = 20,
): Promise<Episode[]> {
  const { results } = await db
    .prepare('SELECT * FROM episodes WHERE user_id = ? ORDER BY started_at DESC LIMIT ?')
    .bind(userId, limit)
    .all<EpisodeRow>();
  return results.map(rowToEpisode);
}

export async function searchEpisodesByText(
  db: D1Database,
  userId: string,
  query: string,
  limit = 10,
): Promise<Episode[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM episodes WHERE user_id = ? AND summary LIKE ? ORDER BY started_at DESC LIMIT ?`,
    )
    .bind(userId, `%${query}%`, limit)
    .all<EpisodeRow>();
  return results.map(rowToEpisode);
}

export async function updateEpisode(
  db: D1Database,
  id: string,
  updates: Partial<Pick<Episode, 'endedAt' | 'summary' | 'embeddingId' | 'metadata'>>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.endedAt !== undefined) {
    fields.push('ended_at = ?');
    values.push(updates.endedAt);
  }
  if (updates.summary !== undefined) {
    fields.push('summary = ?');
    values.push(updates.summary);
  }
  if (updates.embeddingId !== undefined) {
    fields.push('embedding_id = ?');
    values.push(updates.embeddingId);
  }
  if (updates.metadata !== undefined) {
    fields.push('metadata = ?');
    values.push(JSON.stringify(updates.metadata));
  }

  if (fields.length === 0) return;

  values.push(id);
  await db
    .prepare(`UPDATE episodes SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}
