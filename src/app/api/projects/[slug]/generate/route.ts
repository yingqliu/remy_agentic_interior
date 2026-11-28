import { NextResponse } from "next/server";
import { getImageProvider, buildGenerationRequest } from "@/server/image-gen";
import { getProjectBySlug, recordGeneration } from "@/server/projects";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const project = await getProjectBySlug(slug);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const schemeKey = new URL(request.url).searchParams.get("scheme")?.trim() || null;
  const scheme = schemeKey ? project.schemes.find((item) => item.key === schemeKey) : null;
  if (schemeKey && !scheme) return NextResponse.json({ error: "scheme_not_found" }, { status: 404 });
  const provider = getImageProvider();
  const generationRequest = buildGenerationRequest(project, scheme);
  const result = await provider.generate(generationRequest);
  const row = await recordGeneration(slug, result);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    generation: {
      id: row.id,
      provider: row.provider,
      status: row.status,
      prompt: row.prompt,
      message: result.message,
      imageSrc: result.imageSrc,
      createdAt: row.createdAt.toISOString(),
    },
  });
}
