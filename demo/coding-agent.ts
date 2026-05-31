import Anthropic from '@anthropic-ai/sdk';
import type { MemoryContext } from '../src/types/index';
import type { AgentFn, AgentOutput } from '../sdk/agent-wrapper';

const BASE_SYSTEM =
  'You are an expert TypeScript/JavaScript developer. ' +
  'When given buggy code and an error, identify the root cause and return the corrected code ' +
  'with a concise explanation of what was wrong and why the fix works.';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export const codingAgent: AgentFn = async (
  userMessage: string,
  systemPrompt: string,
  contexts: MemoryContext[],
): Promise<AgentOutput> => {
  const system = systemPrompt
    ? `${BASE_SYSTEM}\n\n${systemPrompt}`
    : BASE_SYSTEM;

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  const reply = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return {
    reply,
    metadata: {
      model: message.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      contextCount: contexts.length,
    },
  };
};
