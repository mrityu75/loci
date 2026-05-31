/**
 * run-with-loci.ts
 *
 * Runs all three buggy tasks through wrapWithMemory, showing how the agent's
 * system prompt grows richer with each task as Loci stores and retrieves
 * episodic context.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... LOCI_API_URL=http://localhost:8787 tsx demo/run-with-loci.ts
 *
 * LOCI_API_URL must point to a running `wrangler dev` instance.
 *
 * Embedding note:
 *   A real deployment would call an embedding model (OpenAI, Cohere, or
 *   Cloudflare AI) to produce the query vector. This demo uses a
 *   character-frequency vector so the full wrapWithMemory lifecycle runs
 *   end-to-end without extra API keys. Swap demoEmbed() for a real model
 *   to get semantically meaningful similarity search.
 */

import { codingAgent } from './coding-agent';
import { buggyTasks } from './tasks/buggy-tasks';
import type { BuggyTask } from './tasks/buggy-tasks';
import { LociClient } from '../sdk/loci-client';
import { wrapWithMemory } from '../sdk/agent-wrapper';
import { buildMemoryPrompt } from '../sdk/prompt-builder';
import type { MemoryContext } from '../src/types/index';

// ── terminal colours ──────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function header(text: string) {
  const bar = '═'.repeat(64);
  console.log(`\n${c.bold}${c.blue}${bar}\n  ${text}\n${bar}${c.reset}`);
}

function section(label: string, value: string) {
  console.log(`${c.cyan}${c.bold}${label}:${c.reset}\n${c.dim}${value}${c.reset}\n`);
}

// ── demo embedding (replace with a real model in production) ──────────────────

function demoEmbed(text: string, dims = 1536): number[] {
  const vec = new Array<number>(dims).fill(0);
  for (let ci = 0; ci < text.length; ci++) {
    vec[ci % dims] += text.charCodeAt(ci) / 255;
  }
  const magnitude = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / magnitude);
}

// ── fix detection (same heuristic as run-without-loci) ────────────────────────

function fixDetected(task: BuggyTask, reply: string): boolean {
  const keywords = task.correctFix.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  const lower = reply.toLowerCase();
  const matched = keywords.filter((kw) => lower.includes(kw));
  return matched.length >= Math.ceil(keywords.length * 0.5);
}

// ── print the memory context that was injected into the system prompt ─────────

function printInjectedContext(contexts: MemoryContext[]) {
  if (contexts.length === 0) {
    console.log(`${c.dim}  (no prior episodes in memory yet)${c.reset}`);
    return;
  }
  const prompt = buildMemoryPrompt(contexts);
  const lines = prompt.split('\n').map((l) => `  ${c.dim}${l}${c.reset}`);
  console.log(lines.join('\n'));
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiUrl = process.env.LOCI_API_URL;
  if (!apiUrl) {
    console.error(
      `${c.red}Error: LOCI_API_URL is not set.\n` +
      `Run \`wrangler dev\` and set LOCI_API_URL=http://localhost:8787${c.reset}`,
    );
    process.exit(1);
  }

  const userId = 'demo-user-001';
  const sessionId = `demo-session-${Date.now()}`;

  const loci = new LociClient(apiUrl);
  const wrappedAgent = wrapWithMemory(codingAgent, loci, userId);

  header('WITH LOCI — Memory accumulates across tasks');
  console.log(
    `${c.green}Each task's fix is stored as an episode in Loci.\n` +
    `Subsequent tasks retrieve relevant past episodes and inject them\n` +
    `into the system prompt so the agent builds on prior context.\n${c.reset}`,
  );
  console.log(`${c.dim}  userId:    ${userId}${c.reset}`);
  console.log(`${c.dim}  sessionId: ${sessionId}${c.reset}`);

  let passCount = 0;

  for (let i = 0; i < buggyTasks.length; i++) {
    const task = buggyTasks[i];

    console.log(`\n${c.bold}${c.magenta}── Task ${i + 1} / ${buggyTasks.length}: ${task.id} ──${c.reset}`);
    console.log(`${c.dim}${task.description}${c.reset}\n`);

    section('Buggy code', task.buggyCode);
    section('Error', task.errorMessage);

    // Preview what memory context will be retrieved for this task
    // (we fetch contexts separately just to display them; wrapWithMemory will do it again)
    const previewContexts = await loci.retrieveContext({
      userId,
      vector: demoEmbed(task.description + task.buggyCode),
    }).catch(() => [] as MemoryContext[]);

    console.log(`${c.cyan}${c.bold}Injected memory context:${c.reset}`);
    printInjectedContext(previewContexts);
    console.log();

    console.log(`${c.dim}Calling claude-sonnet-4-20250514 via wrapWithMemory…${c.reset}`);

    const userMessage =
      `Fix the following TypeScript bug.\n\n` +
      `Code:\n\`\`\`typescript\n${task.buggyCode}\n\`\`\`\n\n` +
      `Error:\n${task.errorMessage}`;

    const startMs = Date.now();
    const output = await wrappedAgent({
      sessionId,
      userMessage,
      vector: demoEmbed(task.description + task.buggyCode),
      metadata: { taskId: task.id },
    });
    const elapsed = Date.now() - startMs;

    section('Agent reply', output.reply);

    const passed = fixDetected(task, output.reply);
    if (passed) passCount++;

    const status = passed
      ? `${c.green}✓ Fix detected${c.reset}`
      : `${c.red}✗ Fix unclear or incomplete${c.reset}`;

    const tokens = output.metadata as { inputTokens: number; outputTokens: number };
    console.log(
      `${status}  ${c.dim}(${elapsed}ms · in:${tokens.inputTokens} out:${tokens.outputTokens})${c.reset}`,
    );

    console.log(
      `\n${c.green}✓ Episode stored in Loci (id: ${output.episodeId}).` +
      `\n  Next task will see this fix in its memory context.${c.reset}`,
    );
  }

  header(`Summary: ${passCount} / ${buggyTasks.length} fixes detected`);
  console.log(
    `${c.green}The agent's context window grew with each task.\n` +
    `By task 3, the system prompt included summaries of the previous\n` +
    `two fixes — the agent could reference patterns and conventions\n` +
    `established in earlier turns rather than rediscovering them.${c.reset}\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
