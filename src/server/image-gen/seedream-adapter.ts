import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GenerateRequest, GenerateResult, ImageProvider } from "./types";

/**
 * ByteDance Seedream 5.0 Pro via Volcano Engine Ark.
 *
 * Verified against the Ark image generation API:
 * https://ark.volcengine.com/region:cn-beijing/docs/image-generation-api
 * https://ai.volcengine.com/docs/ark-aihub/2647422
 *
 * POST https://ark.cn-beijing.volces.com/api/v3/images/generations
 * Authorization: Bearer ARK_API_KEY
 * Model: doubao-seedream-5-0-pro-260628
 * Reference image: `image` as a data URI (`data:image/jpeg;base64,...`) or a URL.
 * Size `2K` is a resolution tier. This model has no aspect_ratio field; the
 * prompt states 3:2, which the docs map to 2496×1664 at 2K.
 * watermark defaults to true in the API; this adapter sends false unless
 * SEEDREAM_WATERMARK=true.
 *
 * A returned image is stored under public/uploads and on the Generation row.
 * It is not written onto a scheme.
 */
export const DEFAULT_SEEDREAM_MODEL = "doubao-seedream-5-0-pro-260628";
export const DEFAULT_SEEDREAM_API_BASE = "https://ark.cn-beijing.volces.com/api/v3";
export const DEFAULT_SEEDREAM_SIZE = "2K";
export const DEFAULT_SEEDREAM_REFERENCE_PHOTO = "public/seed/fan/fan-before.jpg";

export const SEEDREAM_EDIT_INSTRUCTION =
  "Edit the attached source photograph of this exact room. Keep the same camera viewpoint, the same window position, and the same walls. Change only what the prompt explicitly asks to change.\nOutput one 3:2 landscape image.";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type SeedreamImage = { b64_json?: string; url?: string };
type SeedreamResponse = { data?: SeedreamImage[]; error?: { message?: string } | string };

export function seedreamSettingsFromEnv(): {
  model: string;
  endpoint: string;
  size: string;
  responseFormat: string;
  outputFormat: string;
  watermark: boolean;
} {
  const base = (process.env.SEEDREAM_API_BASE?.trim() || DEFAULT_SEEDREAM_API_BASE).replace(/\/$/, "");
  return {
    model: process.env.SEEDREAM_MODEL?.trim() || DEFAULT_SEEDREAM_MODEL,
    endpoint: `${base}/images/generations`,
    size: process.env.SEEDREAM_SIZE?.trim() || DEFAULT_SEEDREAM_SIZE,
    responseFormat: process.env.SEEDREAM_RESPONSE_FORMAT?.trim() || "b64_json",
    outputFormat: process.env.SEEDREAM_OUTPUT_FORMAT?.trim() || "jpeg",
    watermark: process.env.SEEDREAM_WATERMARK?.trim().toLowerCase() === "true",
  };
}

export function seedreamProviderFromEnv(): ImageProvider | null {
  if (process.env.IMAGE_PROVIDER?.trim().toLowerCase() !== "seedream") return null;
  const key = process.env.ARK_API_KEY?.trim();
  if (!key) return null;
  return {
    id: "seedream",
    generate: (request) => generateWithSeedream(key, request),
  };
}

export async function generateWithSeedream(
  key: string,
  request: GenerateRequest,
  options?: { outputBase?: string; folder?: string },
): Promise<GenerateResult> {
  const settings = seedreamSettingsFromEnv();
  if (options?.outputBase !== undefined && !/^[a-z0-9-]+$/.test(options.outputBase)) {
    return {
      provider: "seedream",
      status: "error",
      imageSrc: null,
      message: `Output name “${options.outputBase}” is not a scheme key. Seedream was not called.`,
      prompt: request.prompt,
    };
  }
  const photo = await readSourcePhoto(request.sourcePhoto);
  if ("error" in photo) {
    return { provider: "seedream", status: "error", imageSrc: null, message: photo.error, prompt: request.prompt };
  }
  const payload = {
    model: settings.model,
    prompt: `${SEEDREAM_EDIT_INSTRUCTION}\n\n${request.prompt}`,
    image: `data:${photo.mime};base64,${photo.data}`,
    size: settings.size,
    response_format: settings.responseFormat,
    output_format: settings.outputFormat,
    watermark: settings.watermark,
  };
  try {
    const response = await fetch(settings.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      return {
        provider: "seedream",
        status: "error",
        imageSrc: null,
        message: `Seedream image API ${response.status} (model ${settings.model}): ${detail}`,
        prompt: request.prompt,
      };
    }
    let json: SeedreamResponse;
    try {
      json = (await response.json()) as SeedreamResponse;
    } catch {
      return {
        provider: "seedream",
        status: "error",
        imageSrc: null,
        message: `Seedream image API returned a response that was not JSON (model ${settings.model}).`,
        prompt: request.prompt,
      };
    }
    const first = json.data?.[0];
    const bytes = await imageBytes(first);
    if (!bytes) {
      const err = typeof json.error === "string" ? json.error : json.error?.message;
      return {
        provider: "seedream",
        status: "error",
        imageSrc: null,
        message: `Seedream image API returned no image (model ${settings.model})${err ? `: ${err}` : ""}.`,
        prompt: request.prompt,
      };
    }
    const ext = settings.outputFormat === "png" ? "png" : "jpg";
    const name = outputFileName(options?.outputBase, ext, options?.folder ?? "fan/seedream");
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), bytes);
    return {
      provider: "seedream",
      status: "ready",
      imageSrc: `/uploads/${name}`,
      message: `Stored the image returned by Seedream (${settings.model}, ${settings.size}, watermark ${settings.watermark}).`,
      prompt: request.prompt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seedream image request failed";
    return {
      provider: "seedream",
      status: "error",
      imageSrc: null,
      message: `Seedream image request failed (model ${settings.model}): ${message}`,
      prompt: request.prompt,
    };
  }
}

async function imageBytes(image: SeedreamImage | undefined): Promise<Buffer | null> {
  if (!image) return null;
  if (image.b64_json) return Buffer.from(image.b64_json, "base64");
  if (!image.url) return null;
  const response = await fetch(image.url);
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function readSourcePhoto(src: string): Promise<{ data: string; mime: string } | { error: string }> {
  if (!src.startsWith("/") || src.startsWith("//") || src.includes("\0") || src.includes("..")) {
    return { error: `Source photo “${src}” is not a file under public/. Seedream was not called.` };
  }
  const root = path.resolve(process.cwd(), "public");
  const abs = path.resolve(root, src.slice(1));
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return { error: `Source photo “${src}” is outside public/. Seedream was not called.` };
  }
  const mime = MIME_BY_EXT[path.extname(abs).toLowerCase()];
  if (!mime) return { error: `Source photo “${src}” must be JPEG, PNG, or WebP. Seedream was not called.` };
  try {
    const bytes = await readFile(abs);
    return { data: bytes.toString("base64"), mime };
  } catch (error) {
    const missing = typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
    if (missing) return { error: `Source photo not found at ${src}. Seedream needs that reference image and was not called.` };
    const message = error instanceof Error ? error.message : "could not read the source photo";
    return { error: `Could not read the source photo at ${src}: ${message}. Seedream was not called.` };
  }
}

function outputFileName(outputBase: string | undefined, ext: string, folder: string): string {
  const dir = /^fan(?:\/[a-z0-9-]+)?$/.test(folder) ? folder : "fan/seedream";
  if (outputBase && /^[a-z0-9-]+$/.test(outputBase)) return `${dir}/${outputBase}.${ext}`;
  return `gen-${Date.now()}.${ext}`;
}
