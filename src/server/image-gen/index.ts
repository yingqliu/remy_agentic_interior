import { httpProviderFromEnv } from "./http-adapter";
import { openaiProviderFromEnv } from "./openai";
import { stubProvider } from "./stub";
import type { ImageProvider } from "./types";

/**
 * OPENAI_API_KEY selects gpt-image-1. A generic OpenAI-compatible base URL
 * is used only when that key is absent. Otherwise the stub records the prompt
 * and returns no pixels.
 */
export function getImageProvider(): ImageProvider {
  return openaiProviderFromEnv() ?? httpProviderFromEnv() ?? stubProvider;
}

export type { GenerateRequest, GenerateResult, ImageProvider } from "./types";
export { buildGenerationRequest, buildGenerationRequests } from "./prompt";
