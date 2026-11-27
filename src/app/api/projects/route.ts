import { NextResponse } from "next/server";
import { createProject } from "@/server/projects";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  if (!title) return NextResponse.json({ error: "title" }, { status: 400 });
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return NextResponse.json({ error: "photo" }, { status: 400 });
  if (photo.size > MAX_BYTES) return NextResponse.json({ error: "size" }, { status: 400 });
  const ext = photo.type === "image/png" ? ".png" : photo.type === "image/webp" ? ".webp" : photo.type === "image/jpeg" ? ".jpg" : "";
  if (!ext) return NextResponse.json({ error: "type" }, { status: 400 });
  const requirements = String(form.get("requirements") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const created = await createProject({
    title,
    clientName: String(form.get("clientName") ?? ""),
    roomKind: String(form.get("roomKind") ?? "other"),
    roomName: String(form.get("roomName") ?? ""),
    requirements,
    photo: { bytes: Buffer.from(await photo.arrayBuffer()), ext },
  });
  return NextResponse.json(created);
}
