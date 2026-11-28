import { geminiProviderFromEnv } from "./gemini-adapter";
import { httpProviderFromEnv } from "./http-adapter";
import { stubProvider } from "./stub";
import type { ImageProvider } from "./types";

/** Gemini when IMAGE_PROVIDER=gemini and GEMINI_API_KEY is set; else the HTTP adapter; else the stub. */
export function getImageProvider(): ImageProvider {
  return geminiProviderFromEnv() ?? httpProviderFromEnv() ?? stubProvider;
}

export type { GenerateRequest, GenerateResult, ImageProvider } from "./types";
export { STRUCTURAL_LOCKS, UNIVERSAL_CONSTRAINTS, buildGenerationRequest, constraintsFor, structuralLockConstraint } from "./prompt";
