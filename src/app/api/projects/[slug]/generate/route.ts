import { NextResponse } from "next/server";
import { finishesAlreadyReady, structureAttemptCount, STRUCTURE_ATTEMPT_CAP } from "@/lib/generation-budget";
import type { GenerationDTO } from "@/lib/types";
import { runSeedreamFanFlow, type FlowEvent } from "@/server/image-gen/fan-seedream-flow";
import { generationFromRow, getProjectBySlug, recordGeneration } from "@/server/projects";

export const runtime = "nodejs";

type GenerateBody = { action?: "run" | "regenerate"; scheme?: string };

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const project = await getProjectBySlug(slug);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as GenerateBody;
  const arkKey = process.env.ARK_API_KEY?.trim() ?? "";
  if (!arkKey) {
    return NextResponse.json(
      { error: "missing_key", message: "ARK_API_KEY is empty. Seedream was not called." },
      { status: 400 },
    );
  }

  const prior: Record<string, number> = {};
  for (const scheme of project.schemes) prior[scheme.key] = structureAttemptCount(project.generations, scheme.key);
  const saved: GenerationDTO[] = [];
  const onEvent = (event: FlowEvent) => recordFlowEvent(slug, event, saved);

  if (body.action === "regenerate") {
    const scheme = project.schemes.find((item) => item.key === body.scheme);
    if (!scheme) return NextResponse.json({ error: "scheme_not_found" }, { status: 404 });
    if ((prior[scheme.key] ?? 0) >= STRUCTURE_ATTEMPT_CAP) {
      return NextResponse.json({ paywall: true, generations: [] });
    }
    const outcome = await runSeedreamFanFlow({
      arkKey,
      project,
      sourcePhoto: project.room.beforeSrc,
      schemes: [scheme],
      priorStructureAttempts: prior,
      structureBudget: 1,
      skipFinishes: finishesAlreadyReady(project.generations, scheme.key),
      onEvent,
    });
    return NextResponse.json({ paywall: false, exitCode: outcome.exitCode, generations: saved });
  }

  const fresh = project.schemes.filter((scheme) => (prior[scheme.key] ?? 0) === 0);
  if (fresh.length === 0) return NextResponse.json({ paywall: true, generations: [] });
  const outcome = await runSeedreamFanFlow({
    arkKey,
    project,
    sourcePhoto: project.room.beforeSrc,
    schemes: fresh,
    priorStructureAttempts: prior,
    onEvent,
  });
  return NextResponse.json({ paywall: false, exitCode: outcome.exitCode, generations: saved });
}

async function recordFlowEvent(slug: string, event: FlowEvent, saved: GenerationDTO[]) {
  const row = await recordGeneration(slug, {
    provider: event.result.provider,
    status: event.accepted ? event.result.status : "error",
    prompt: event.result.prompt,
    message: event.result.message,
    imageSrc: event.accepted ? event.result.imageSrc : null,
    stage: event.stage,
    schemeKey: event.schemeKey,
    presetKey: event.presetKey,
    attempt: event.attempt,
    accepted: event.accepted,
  });
  if (row) saved.push(generationFromRow(row));
}
