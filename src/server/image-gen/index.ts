import { httpProviderFromEnv } from "./http-adapter";
import { stubProvider } from "./stub";
import type { ImageProvider } from "./types";

export function getImageProvider(): ImageProvider {
  return httpProviderFromEnv() ?? stubProvider;
}

export type { GenerateRequest, GenerateResult, ImageProvider } from "./types";
export { buildGenerationRequest } from "./prompt";
