import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GenerateRequest, GenerateResult, ImageProvider } from "./types";

/**
 * Gemini image adapter (Interactions API).
 *
 * Model id verified 2026-11-28 against:
 * https://ai.google.dev/gemini-api/docs/pricing
 * https://ai.google.dev/gemini-api/docs/image-generation
 * Nano Banana 2.1, the update of Gemini 3.1 Flash Image, is `gemini-nano-banana-2.1`.
 *
 * Active only when IMAGE_PROVIDER=gemini and GEMINI_API_KEY is set.
 * A returned image is stored under public/uploads and reported on the
 * Generation row. It is not written onto a scheme.
 *
 * Request: POST https://generativelanguage.googleapis.com/v1beta/interactions
 * with the source photo as an inline base64 image. Output size is 2K
 * (response_format.image_size). Aspect ratio is 3:2, the nearest supported
 * ratio to the seeded 1280×800 before photo and the previous 1536×1024 frame.
 * Docs: uppercase K is required; 2K at 3:2 is 2528×1696.
 */
export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-nano-banana-2.1";
export const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
export const GEMINI_IMAGE_SIZE = "2K";
export const GEMINI_ASPECT_RATIO = "3:2";

export const GEMINI_EDIT_INSTRUCTION =
  "Edit the attached source photograph of this exact room. Keep the same camera viewpoint, the same window position, and the same walls. Change only what the prompt explicitly asks to change.";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type ImageBlock = { type?: string; data?: string; mime_type?: string };
type InteractionStep = { type?: string; content?: ImageBlock[] };
type InteractionResponse = {
  status?: string;
  error?: { message?: string } | string;
  output_image?: ImageBlock;
  steps?: InteractionStep[];
};

export function geminiProviderFromEnv(): ImageProvider | null {
  if (process.env.IMAGE_PROVIDER?.trim().toLowerCase() !== "gemini") return null;
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const model = process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
  return {
    id: "gemini",
    generate: (request) => generateWithGemini(key, model, request),
  };
}

export async function generateWithGemini(key: string, model: string, request: GenerateRequest): Promise<GenerateResult> {
  const photo = await readSourcePhoto(request.sourcePhoto);
  if ("error" in photo) {
    return { provider: "gemini", status: "error", imageSrc: null, message: photo.error, prompt: request.prompt };
  }
  const payload = {
    model,
    input: [
      { type: "text", text: `${GEMINI_EDIT_INSTRUCTION}\n\n${request.prompt}` },
      { type: "image", data: photo.data, mime_type: photo.mime },
    ],
    response_format: {
      type: "image",
      aspect_ratio: GEMINI_ASPECT_RATIO,
      image_size: GEMINI_IMAGE_SIZE,
      mime_type: "image/jpeg",
      delivery: "inline",
    },
  };
  try {
    const response = await fetch(GEMINI_INTERACTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      return {
        provider: "gemini",
        status: "error",
        imageSrc: null,
        message: `Gemini image API ${response.status} (model ${model}): ${detail}`,
        prompt: request.prompt,
      };
    }
    let json: InteractionResponse;
    try {
      json = (await response.json()) as InteractionResponse;
    } catch {
      return {
        provider: "gemini",
        status: "error",
        imageSrc: null,
        message: `Gemini image API returned a response that was not JSON (model ${model}).`,
        prompt: request.prompt,
      };
    }
    const image = lastModelImage(json);
    if (!image) {
      const status = json.status ? ` status ${json.status}` : "";
      const err = typeof json.error === "string" ? json.error : json.error?.message;
      return {
        provider: "gemini",
        status: "error",
        imageSrc: null,
        message: `Gemini image API returned no image (model ${model})${status}${err ? `: ${err}` : ""}.`,
        prompt: request.prompt,
      };
    }
    const ext = extensionForMime(image.mime);
    const name = `gen-${Date.now()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(image.data, "base64"));
    return {
      provider: "gemini",
      status: "ready",
      imageSrc: `/uploads/${name}`,
      message: `Stored the image returned by Gemini (${model}, ${GEMINI_IMAGE_SIZE}, ${GEMINI_ASPECT_RATIO}).`,
      prompt: request.prompt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini image request failed";
    return { provider: "gemini", status: "error", imageSrc: null, message: `Gemini image request failed (model ${model}): ${message}`, prompt: request.prompt };
  }
}

function lastModelImage(json: InteractionResponse): { data: string; mime: string } | null {
  const found: { data: string; mime: string }[] = [];
  for (const step of json.steps ?? []) {
    if (step.type && step.type !== "model_output") continue;
    for (const block of step.content ?? []) {
      if (block.type === "image" && block.data) found.push({ data: block.data, mime: block.mime_type || "image/png" });
    }
  }
  const last = found.at(-1);
  if (last) return last;
  if (json.output_image?.data) return { data: json.output_image.data, mime: json.output_image.mime_type || "image/png" };
  return null;
}

async function readSourcePhoto(src: string): Promise<{ data: string; mime: string } | { error: string }> {
  const located = locatePublicImage(src);
  if ("error" in located) return located;
  try {
    const bytes = await readFile(located.abs);
    return { data: bytes.toString("base64"), mime: located.mime };
  } catch (error) {
    const missing = isEnoent(error);
    if (missing) {
      return { error: `Source photo not found at ${src}. Gemini needs that reference image and was not called.` };
    }
    const message = error instanceof Error ? error.message : "could not read the source photo";
    return { error: `Could not read the source photo at ${src}: ${message}. Gemini was not called.` };
  }
}

function locatePublicImage(src: string): { abs: string; mime: string } | { error: string } {
  if (!src.startsWith("/") || src.startsWith("//") || src.includes("\0") || src.includes("..")) {
    return { error: `Source photo “${src}” is not a file under public/. Gemini was not called.` };
  }
  const root = path.resolve(process.cwd(), "public");
  const abs = path.resolve(root, src.slice(1));
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return { error: `Source photo “${src}” is outside public/. Gemini was not called.` };
  }
  const mime = MIME_BY_EXT[path.extname(abs).toLowerCase()];
  if (!mime) {
    return { error: `Source photo “${src}” must be JPEG, PNG, or WebP. Gemini was not called.` };
  }
  return { abs, mime };
}

function isEnoent(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

function extensionForMime(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}
