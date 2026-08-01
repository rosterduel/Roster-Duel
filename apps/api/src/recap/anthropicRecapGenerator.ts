import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { buildRecapPrompt, RECAP_SYSTEM_PROMPT } from './buildRecapPrompt';
import { RecapOutputSchema } from './recapSchema';
import { GeneratedRecap, RecapGenerator, RecapPromptInput } from './types';

/**
 * Cost-efficient model per explicit product decision (spec section 4b):
 * recap writing is a well-scoped structured-writing task, not something
 * needing frontier-level reasoning, so a fast/cheap model is deliberately
 * used here instead of a top-tier one.
 */
export const RECAP_MODEL = 'claude-haiku-4-5';
const RECAP_MAX_TOKENS = 2000;

/**
 * Reads ANTHROPIC_API_KEY from the environment via the SDK's default
 * resolution — no key is read or required until `.generate()` is actually
 * called, so constructing this doesn't fail in environments (like tests)
 * that never call it.
 */
export function createAnthropicRecapGenerator(client: Anthropic = new Anthropic()): RecapGenerator {
  return {
    async generate(input: RecapPromptInput): Promise<GeneratedRecap> {
      const response = await client.messages.parse({
        model: RECAP_MODEL,
        max_tokens: RECAP_MAX_TOKENS,
        system: RECAP_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildRecapPrompt(input) }],
        output_config: { format: zodOutputFormat(RecapOutputSchema) },
      });

      if (!response.parsed_output) {
        throw new Error('Recap generation failed: model response did not match the expected schema.');
      }

      return response.parsed_output;
    },
  };
}
