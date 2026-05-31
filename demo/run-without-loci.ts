/**
 * run-without-loci.ts
 *
 * Runs all three buggy tasks through the coding agent with NO memory.
 * Each task starts cold — the agent has no knowledge of previous fixes.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... tsx demo/run-without-loci.ts
 */

import { codingAgent } from './coding-agent';
import { buggyTasks } from './tasks/buggy-tasks';
import type { BuggyTask } from './tasks/buggy-tasks';

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

function fixDetected(task: BuggyTask, reply: string): boolean {
  // Rough heuristic: does the reply address the core of the correct fix?
  const keywords = task.correctFix.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  const lower = reply.toLowerCase();
  const matched = keywords.filter((kw) => lower.includes(kw));
  return matched.length >= Math.ceil(keywords.length * 0.5);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  header('WITHOUT LOCI — No memory, every task starts cold');
  console.log(
    `${c.yellow}The agent has no context from previous tasks.\n` +
    `Each run is completely independent — no accumulated learning.\n${c.reset}`,
  );

  let passCount = 0;

  for (let i = 0; i < buggyTasks.length; i++) {
    const task = buggyTasks[i];

    console.log(`\n${c.bold}${c.magenta}── Task ${i + 1} / ${buggyTasks.length}: ${task.id} ──${c.reset}`);
    console.log(`${c.dim}${task.description}${c.reset}\n`);

    section('Buggy code', task.buggyCode);
    section('Error', task.errorMessage);

    console.log(`${c.dim}Calling claude-sonnet-4-20250514 (no system prompt, no memory)…${c.reset}`);

    const userMessage =
      `Fix the following TypeScript bug.\n\n` +
      `Code:\n\`\`\`typescript\n${task.buggyCode}\n\`\`\`\n\n` +
      `Error:\n${task.errorMessage}`;

    const startMs = Date.now();
    // Empty systemPrompt and empty contexts — cold start every time
    const output = await codingAgent(userMessage, '', []);
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
      `\n${c.yellow}⚠  No memory stored. Next task won't know this fix happened.${c.reset}`,
    );
  }

  header(`Summary: ${passCount} / ${buggyTasks.length} fixes detected`);
  console.log(
    `${c.yellow}Notice: the agent approached every task from scratch.\n` +
    `It can't reinforce patterns, recall what it's seen before,\n` +
    `or apply project conventions learned in earlier tasks.${c.reset}\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
