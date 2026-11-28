import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GenerateRequest, GenerateResult, ImageProvider } from "./types";

/** OpenAI Images API. gpt-image-1 is fixed; the key comes from the environment only. */
export const OPENAI_IMAGES_ENDPOINT = "https://api.openai.com/v1/images/generations";
export const OPENAI_IMAGE_MODEL = "gpt-image-1";

export type OpenAIProviderOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  saveBytes?: (bytes: Buffer) => Promise<string>;
  endpoint?: string;
  model?: string;
};

/**
 * Active only when OPENAI_API_KEY is set. A missing or blank key returns null
 * so the caller can fall back to the stub (or the generic HTTP adapter).
 */
export function openaiProviderFromEnv(env: NodeJS.ProcessEnv = process.env): ImageProvider | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return createOpenAIProvider({ apiKey });
}

export function createOpenAIProvider(options: OpenAIProviderOptions): ImageProvider {
  const apiKey = options.apiKey.trim();
  const fetchImpl = options.fetchImpl ?? fetch;
  const saveBytes = options.saveBytes ?? ((bytes) => writeGeneratedPng(bytes));
  const endpoint = options.endpoint ?? OPENAI_IMAGES_ENDPOINT;
  const model = options.model ?? OPENAI_IMAGE_MODEL;
  return {
    id: "openai",
    generate: (request) =>
      generateWithOpenAI({ apiKey, fetchImpl, saveBytes, endpoint, model }, request),
  };
}

type OpenAICall = {
  apiKey: string;
  fetchImpl: typeof fetch;
  saveBytes: (bytes: Buffer) => Promise<string>;
  endpoint: string;
  model: string;
};

async function generateWithOpenAI(call: OpenAICall, request: GenerateRequest): Promise<GenerateResult> {
  try {
    const response = await call.fetchImpl(call.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${call.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: call.model,
        prompt: request.prompt,
        size: "1536x1024",
        n: 1,
        output_format: "png",
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      return errorResult(request, `OpenAI Images API ${response.status}: ${detail}`);
    }
    const json: unknown = await response.json();
    const image = readImagePayload(json);
    if (image?.kind === "b64") {
      const bytes = Buffer.from(image.data, "base64");
      if (bytes.length === 0) return errorResult(request, "OpenAI Images API returned empty image data.");
      const imageSrc = await call.saveBytes(bytes);
      return {
        provider: "openai",
        status: "ready",
        imageSrc,
        message: "Stored the gpt-image-1 image.",
        prompt: request.prompt,
      };
    }
    if (image?.kind === "url") {
      return {
        provider: "openai",
        status: "ready",
        imageSrc: image.url,
        message: "gpt-image-1 returned a remote image URL.",
        prompt: request.prompt,
      };
    }
    return errorResult(request, "The OpenAI Images API response did not include an image.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image request failed";
    return errorResult(request, message);
  }
}

function errorResult(request: GenerateRequest, message: string): GenerateResult {
  return { provider: "openai", status: "error", imageSrc: null, message, prompt: request.prompt };
}

export function readImagePayload(json: unknown): { kind: "b64"; data: string } | { kind: "url"; url: string } | null {
  if (!json || typeof json !== "object") return null;
  const data = (json as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  if (!first || typeof first !== "object") return null;
  const row = first as { b64_json?: unknown; url?: unknown };
  if (typeof row.b64_json === "string" && row.b64_json.trim()) {
    return { kind: "b64", data: row.b64_json.trim() };
  }
  if (typeof row.url === "string" && isHttpUrl(row.url)) {
    return { kind: "url", url: row.url };
  }
  return null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Decode target for gpt-image-1 `b64_json`. Files land in public/uploads and
 * are served as `/uploads/<name>`. They are never written under public/seed.
 */
export async function writeGeneratedPng(bytes: Buffer, directory?: string): Promise<string> {
  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const dir = directory ?? uploadsRoot;
  await mkdir(dir, { recursive: true });
  const name = `gen-${Date.now()}-${randomBytes(4).toString("hex")}.png`;
  await writeFile(path.join(dir, name), bytes);
  if (path.resolve(dir) === path.resolve(uploadsRoot)) return `/uploads/${name}`;
  return path.join(dir, name);
}
