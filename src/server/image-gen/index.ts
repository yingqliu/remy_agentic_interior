import { geminiProviderFromEnv } from "./gemini-adapter";
import { httpProviderFromEnv } from "./http-adapter";
import { seedreamProviderFromEnv } from "./seedream-adapter";
import { stubProvider } from "./stub";
import type { ImageProvider } from "./types";

/**
 * IMAGE_PROVIDER=seedream uses Seedream when ARK_API_KEY is set.
 * IMAGE_PROVIDER=gemini uses Gemini when GEMINI_API_KEY is set.
 * A missing key does not switch to the other image model. Otherwise the HTTP adapter, then the stub.
 */
export function getImageProvider(): ImageProvider {
  const choice = process.env.IMAGE_PROVIDER?.trim().toLowerCase();
  if (choice === "seedream") return seedreamProviderFromEnv() ?? httpProviderFromEnv() ?? stubProvider;
  if (choice === "gemini") return geminiProviderFromEnv() ?? httpProviderFromEnv() ?? stubProvider;
  return httpProviderFromEnv() ?? stubProvider;
}

export type { GenerateRequest, GenerateResult, ImageProvider } from "./types";
export { STRUCTURAL_LOCKS, UNIVERSAL_CONSTRAINTS, buildGenerationRequest, constraintsFor, structuralLockConstraint } from "./prompt";
