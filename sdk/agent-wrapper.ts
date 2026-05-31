import type { MemoryContext } from '../src/types/index';
import { LociClient } from './loci-client';
import { buildMemoryPrompt } from './prompt-builder';

export interface AgentInput {
  sessionId: string;
  userMessage: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface AgentOutput {
  reply: string;
  metadata?: Record<string, unknown>;
}

export type AgentFn = (
  userMessage: string,
  systemPrompt: string,
  contexts: MemoryContext[],
) => Promise<AgentOutput>;

export interface WrappedAgentFn {
  (input: AgentInput): Promise<AgentOutput & { episodeId: string }>;
}

/**
 * Higher-order function that augments any AgentFn with episodic memory:
 *  1. Retrieves similar past episodes + high-confidence learnings from Loci.
 *  2. Builds a system prompt from those contexts and calls agentFn.
 *  3. Logs the completed episode (startedAt … endedAt + summary) back to Loci.
 */
export function wrapWithMemory(
  agentFn: AgentFn,
  lociClient: LociClient,
  userId: string,
): WrappedAgentFn {
  return async function wrappedAgent(input: AgentInput) {
    const { sessionId, userMessage, vector, metadata = {} } = input;
    const startedAt = Date.now();

    // 1. Mark session active
    await lociClient.upsertSession({ sessionId, userId, state: 'active' });

    // 2. Retrieve relevant memory context
    const contexts = await lociClient.retrieveContext({ userId, vector });

    // 3. Build system prompt and call the agent
    const systemPrompt = buildMemoryPrompt(contexts);
    const output = await agentFn(userMessage, systemPrompt, contexts);

    const endedAt = Date.now();

    // 4. Store the episode so future retrievals can surface it
    const { id: episodeId } = await lociClient.storeEpisode({
      sessionId,
      userId,
      startedAt,
      endedAt,
      summary: `User: ${userMessage}\nAssistant: ${output.reply}`,
      metadata: { ...metadata, ...output.metadata },
    });

    // 5. Return session to idle
    await lociClient.upsertSession({
      sessionId,
      userId,
      state: 'idle',
      activeEpisodeId: episodeId,
    });

    return { ...output, episodeId };
  };
}
