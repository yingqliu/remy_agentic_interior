import { httpProviderFromEnv } from "./http-adapter";
import { stubProvider } from "./stub";
import type { ImageProvider } from "./types";

export function getImageProvider(): ImageProvider {
  return httpProviderFromEnv() ?? stubProvider;
}

export type { GenerateRequest, GenerateResult, ImageProvider } from "./types";
export { STRUCTURAL_LOCKS, UNIVERSAL_CONSTRAINTS, buildGenerationRequest, constraintsFor, structuralLockConstraint } from "./prompt";
