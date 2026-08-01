import { GeneratedRecap, RecapGenerator, RecapPromptInput } from './types';

/** Test-only stand-in for RecapGenerator — no network, no API key required. */
export function createFakeRecapGenerator(response: GeneratedRecap, onGenerate?: (input: RecapPromptInput) => void): RecapGenerator {
  return {
    async generate(input: RecapPromptInput): Promise<GeneratedRecap> {
      onGenerate?.(input);
      return response;
    },
  };
}
