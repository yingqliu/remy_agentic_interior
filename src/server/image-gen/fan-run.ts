import type { ProjectDTO } from "@/lib/types";
import { buildGenerationRequest } from "./prompt";
import { DEFAULT_GEMINI_IMAGE_MODEL, generateWithGemini } from "./gemini-adapter";
import { generateWithSeedream } from "./seedream-adapter";
import type { GenerateResult } from "./types";

export type FanProviderName = "seedream" | "gemini";

export function providersFromArgv(argv: string[]): FanProviderName[] | null {
  const index = argv.indexOf("--provider");
  if (index < 0) return ["seedream"];
  const value = argv[index + 1];
  if (value === "seedream" || value === "gemini") return [value];
  if (value === "both") return ["seedream", "gemini"];
  return null;
}

const EMPTY_SEEDREAM =
  "ARK_API_KEY is empty. Copy .env.ready to .env, set ARK_API_KEY, then run npm run gen:fan. Seedream was not called.";
const EMPTY_GEMINI =
  "GEMINI_API_KEY is empty. Copy .env.ready to .env, set GEMINI_API_KEY, then run npm run gen:fan -- --provider gemini. Gemini was not called.";

/**
 * Runs the selected providers as separate passes. A Seedream failure does not call Gemini.
 * Returns 1 before any request when a selected provider's key is empty.
 */
export async function runFanSchemes(input: {
  providers: FanProviderName[];
  arkKey: string;
  geminiKey: string;
  project: ProjectDTO;
  sourcePhotoFor: (provider: FanProviderName) => string;
  log?: (line: string) => void;
  error?: (line: string) => void;
  generateSeedream?: typeof generateWithSeedream;
  generateGemini?: typeof generateWithGemini;
}): Promise<number> {
  const log = input.log ?? console.log;
  const error = input.error ?? console.error;
  const generateSeedream = input.generateSeedream ?? generateWithSeedream;
  const generateGemini = input.generateGemini ?? generateWithGemini;
  if (input.providers.includes("seedream") && !input.arkKey.trim()) {
    error(EMPTY_SEEDREAM);
    return 1;
  }
  if (input.providers.includes("gemini") && !input.geminiKey.trim()) {
    error(EMPTY_GEMINI);
    return 1;
  }

  const geminiModel = process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
  let failures = 0;
  for (const provider of input.providers) {
    for (const scheme of input.project.schemes) {
      const request = buildGenerationRequest(input.project, scheme);
      request.sourcePhoto = input.sourcePhotoFor(provider);
      const label = provider === "seedream" ? "Seedream" : "Gemini";
      log(`${label} ${scheme.name} (${scheme.key})`);
      let result: GenerateResult;
      if (provider === "seedream") {
        result = await generateSeedream(input.arkKey, request, { outputBase: scheme.key, folder: "fan/seedream" });
      } else {
        result = await generateGemini(input.geminiKey, geminiModel, request, { outputBase: scheme.key, folder: "fan/gemini" });
      }
      if (result.status !== "ready" || !result.imageSrc) {
        failures += 1;
        error(`${label} ${scheme.name} (${scheme.key}) failed: ${result.message}`);
        continue;
      }
      log(`${label} ${scheme.name} (${scheme.key}) -> public${result.imageSrc}`);
    }
  }
  return failures === 0 ? 0 : 1;
}
