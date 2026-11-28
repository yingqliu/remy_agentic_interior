import { unlink } from "node:fs/promises";
import path from "node:path";
import { FINISH_PRESET_KEYS, STRUCTURE_ATTEMPT_CAP } from "@/lib/generation-budget";
import type { DecorPreset, ProjectDTO, SchemeDTO } from "@/lib/types";
import { assessImageBytes, passthroughQualityJudge, type ImageAssessment, type QualityJudge } from "./image-check";
import { presetFinishLine } from "./preset-wording";
import { buildGenerationRequest } from "./prompt";
import { generateWithSeedream } from "./seedream-adapter";
import type { GenerateRequest, GenerateResult } from "./types";

export const MAX_SEEDREAM_CALLS_PER_FULL_RUN = 4 * STRUCTURE_ATTEMPT_CAP + 4 * FINISH_PRESET_KEYS.length;

const EMPTY_KEY =
  "ARK_API_KEY is empty. Copy .env.ready to .env, set ARK_API_KEY, then run npm run gen:fan. Seedream was not called.";

export type FlowEvent = {
  stage: "structure" | "finish";
  schemeKey: string;
  presetKey?: string;
  attempt: number;
  accepted: boolean;
  result: GenerateResult;
};

export async function runSeedreamFanFlow(input: {
  arkKey: string;
  project: ProjectDTO;
  sourcePhoto: string;
  schemes?: SchemeDTO[];
  priorStructureAttempts?: Record<string, number>;
  /** When set, only these schemes are run, and each gets at most this many new attempts. */
  structureBudget?: number;
  skipFinishes?: boolean;
  judge?: QualityJudge;
  log?: (line: string) => void;
  error?: (line: string) => void;
  generate?: typeof generateWithSeedream;
  readBytes?: (imageSrc: string) => Promise<Buffer>;
  onEvent?: (event: FlowEvent) => Promise<void> | void;
}): Promise<{ exitCode: number; events: FlowEvent[] }> {
  const log = input.log ?? console.log;
  const error = input.error ?? console.error;
  const generate = input.generate ?? generateWithSeedream;
  const judge = input.judge ?? passthroughQualityJudge;
  const readBytes = input.readBytes ?? readPublicBytes;
  const events: FlowEvent[] = [];
  if (!input.arkKey.trim()) {
    error(EMPTY_KEY);
    return { exitCode: 1, events };
  }

  const schemes = input.schemes ?? input.project.schemes;
  const presets = finishPresets(input.project);
  let failures = 0;
  for (const scheme of schemes) {
    const used = input.priorStructureAttempts?.[scheme.key] ?? 0;
    const budget = input.structureBudget ?? Math.max(0, STRUCTURE_ATTEMPT_CAP - used);
    if (budget <= 0) {
      error(`Seedream ${scheme.name} (${scheme.key}) already used ${STRUCTURE_ATTEMPT_CAP} structure attempts.`);
      failures += 1;
      continue;
    }
    const structure = buildGenerationRequest(input.project, scheme);
    structure.sourcePhoto = input.sourcePhoto;
    let approved: string | null = null;
    for (let step = 1; step <= budget; step += 1) {
      const attempt = used + step;
      log(`Seedream ${scheme.name} (${scheme.key}) structure attempt ${attempt}`);
      const result = await generate(input.arkKey, structure, {
        outputBase: "structure",
        folder: `fan/seedream/${scheme.key}`,
      });
      const verdict = await evaluate({
        result,
        readBytes,
        judge,
        stage: "structure",
        schemeKey: scheme.key,
      });
      const accepted = verdict.ok;
      const event: FlowEvent = { stage: "structure", schemeKey: scheme.key, attempt, accepted, result };
      events.push(event);
      await input.onEvent?.(event);
      if (!accepted) {
        if (result.imageSrc) await discard(result.imageSrc);
        error(`Seedream ${scheme.name} (${scheme.key}) structure attempt ${attempt} was poor: ${verdict.reason ?? result.message}`);
        continue;
      }
      approved = result.imageSrc;
      log(`Seedream ${scheme.name} (${scheme.key}) structure -> public${result.imageSrc}`);
      break;
    }
    if (!approved) {
      failures += 1;
      continue;
    }
    if (input.skipFinishes) continue;
    for (const preset of presets) {
      const finish = finishRequest(input.project, scheme, preset, approved);
      log(`Seedream ${scheme.name} (${scheme.key}) finish ${preset.name} (${preset.key})`);
      const result = await generate(input.arkKey, finish, {
        outputBase: preset.key,
        folder: `fan/seedream/${scheme.key}`,
      });
      const verdict = await evaluate({
        result,
        readBytes,
        judge,
        stage: "finish",
        schemeKey: scheme.key,
        presetKey: preset.key,
      });
      const event: FlowEvent = {
        stage: "finish",
        schemeKey: scheme.key,
        presetKey: preset.key,
        attempt: 1,
        accepted: verdict.ok,
        result,
      };
      events.push(event);
      await input.onEvent?.(event);
      if (!verdict.ok) {
        failures += 1;
        if (result.imageSrc) await discard(result.imageSrc);
        error(`Seedream ${scheme.name} (${scheme.key}) finish ${preset.key} was poor: ${verdict.reason ?? result.message}`);
        continue;
      }
      log(`Seedream ${scheme.name} (${scheme.key}) ${preset.key} -> public${result.imageSrc}`);
    }
  }
  return { exitCode: failures === 0 ? 0 : 1, events };
}

export function finishPresets(project: ProjectDTO): DecorPreset[] {
  return FINISH_PRESET_KEYS.map((key) => {
    const preset = project.decor.presets.find((item) => item.key === key);
    if (!preset) throw new Error(`missing finish preset ${key}`);
    return preset;
  });
}

export function finishRequest(project: ProjectDTO, scheme: SchemeDTO, preset: DecorPreset, structureSrc: string): GenerateRequest {
  const request = buildGenerationRequest(project, scheme);
  const line = presetFinishLine(preset);
  request.sourcePhoto = structureSrc;
  request.requirements = [...request.requirements, line];
  request.prompt = `${request.prompt}\n${line}\nThe attached image is the approved structure rendering. Change finishes only. Keep the structure, windows, and layout locked.`;
  return request;
}

async function evaluate(input: {
  result: GenerateResult;
  readBytes: (imageSrc: string) => Promise<Buffer>;
  judge: QualityJudge;
  stage: "structure" | "finish";
  schemeKey: string;
  presetKey?: string;
}): Promise<ImageAssessment> {
  if (input.result.status !== "ready" || !input.result.imageSrc) {
    return { ok: false, reason: input.result.message || "empty or invalid output" };
  }
  let bytes: Buffer;
  try {
    bytes = await input.readBytes(input.result.imageSrc);
  } catch {
    return { ok: false, reason: "empty or invalid output" };
  }
  const cheap = assessImageBytes(bytes);
  if (!cheap.ok || cheap.width == null || cheap.height == null) return cheap;
  const judged = await input.judge({
    stage: input.stage,
    schemeKey: input.schemeKey,
    presetKey: input.presetKey,
    bytes,
    width: cheap.width,
    height: cheap.height,
  });
  if (!judged.ok) return { ok: false, reason: judged.reason ?? "quality judge rejected the image", width: cheap.width, height: cheap.height };
  return cheap;
}

async function readPublicBytes(imageSrc: string): Promise<Buffer> {
  const { readFile } = await import("node:fs/promises");
  return readFile(path.join(process.cwd(), "public", imageSrc.replace(/^\/+/, "")));
}

async function discard(imageSrc: string): Promise<void> {
  const abs = path.join(process.cwd(), "public", imageSrc.replace(/^\/+/, ""));
  await unlink(abs).catch(() => undefined);
}
