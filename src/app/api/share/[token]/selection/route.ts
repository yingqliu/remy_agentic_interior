import { NextResponse } from "next/server";
import { selectionSchema } from "@/lib/selection-schema";
import { saveSelection } from "@/server/projects";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const parsed = selectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const saved = await saveSelection(token, parsed.data);
  if (!saved) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt });
}
