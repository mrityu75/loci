import type { MemoryContext } from '../src/types/index';

const SECTION_DIVIDER = '---';

/**
 * Formats a list of MemoryContext entries into a system prompt block.
 *
 * Structure:
 *   [MEMORY CONTEXT]
 *   --- Learned facts ---
 *   <bullet list of learnings>
 *   --- Past episodes ---
 *   <numbered summaries with timestamps>
 *   [END MEMORY CONTEXT]
 *
 * The learnings section (contexts with relevantLearningIds) is always placed
 * first so the model sees stable facts before episodic detail.
 */
export function buildMemoryPrompt(contexts: MemoryContext[]): string {
  if (contexts.length === 0) return '';

  const learningContexts = contexts.filter((c) => c.relevantLearningIds?.length);
  const episodeContexts = contexts.filter(
    (c) => c.episodeId && !c.relevantLearningIds?.length,
  );

  const sections: string[] = ['[MEMORY CONTEXT]'];

  if (learningContexts.length > 0) {
    sections.push(`${SECTION_DIVIDER} Learned facts ${SECTION_DIVIDER}`);
    for (const ctx of learningContexts) {
      const lines = ctx.content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of lines) {
        sections.push(`• ${line}`);
      }
    }
  }

  if (episodeContexts.length > 0) {
    sections.push(`${SECTION_DIVIDER} Past episodes ${SECTION_DIVIDER}`);
    episodeContexts.forEach((ctx, i) => {
      const date = new Date(ctx.timestamp).toISOString().slice(0, 16).replace('T', ' ');
      sections.push(`${i + 1}. [${date}] ${ctx.content.trim()}`);
    });
  }

  sections.push('[END MEMORY CONTEXT]');
  return sections.join('\n');
}

/**
 * Strips the memory context block from a prompt string.
 * Useful when you need to log the clean user-facing prompt without the injected header.
 */
export function stripMemoryPrompt(prompt: string): string {
  return prompt
    .replace(/\[MEMORY CONTEXT\][\s\S]*?\[END MEMORY CONTEXT\]\n?/g, '')
    .trim();
}
