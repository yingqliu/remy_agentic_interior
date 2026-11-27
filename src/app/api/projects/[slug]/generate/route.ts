import { NextResponse } from "next/server";
import type { GenerationDTO } from "@/lib/types";
import { getImageProvider, buildGenerationRequests } from "@/server/image-gen";
import { getProjectBySlug, recordGeneration } from "@/server/projects";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const project = await getProjectBySlug(slug);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const provider = getImageProvider();
  const requests = buildGenerationRequests(project);
  const generations: GenerationDTO[] = [];
  for (const request of requests) {
    const result = await provider.generate(request);
    const row = await recordGeneration(slug, { ...result, schemeKey: request.schemeKey });
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
    generations.push({
      id: row.id,
      provider: row.provider,
      status: row.status,
      prompt: row.prompt,
      message: result.message,
      imageSrc: result.imageSrc,
      schemeKey: request.schemeKey,
      createdAt: row.createdAt.toISOString(),
    });
  }
  return NextResponse.json({
    generations,
    generation: generations[0] ?? null,
  });
}
