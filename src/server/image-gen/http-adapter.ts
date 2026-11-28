import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GenerateRequest, GenerateResult, ImageProvider } from "./types";

/**
 * OPENAI-COMPATIBLE IMAGE ADAPTER
 * --------------------------------
 * Used when the Gemini provider is not selected and both IMAGE_API_BASE and
 * IMAGE_API_KEY are set. Do not commit keys. See .env.example.
 *
 * A successful response is stored under public/uploads and on the Generation
 * row. It is not written back onto a scheme.
 *
 * Expected shape: POST {IMAGE_API_BASE}/images/generations with
 * Authorization: Bearer IMAGE_API_KEY. The default model is gpt-image-2.6-flare
 * (gpt-image-1 was shut down). `quality` is the OpenAI images field
 * (low, medium, high, or auto), from IMAGE_API_QUALITY, default medium.
 * This adapter sends the prompt only. It does not upload the source photo.
 */
export const DEFAULT_HTTP_IMAGE_MODEL = "gpt-image-2.6-flare";
export const DEFAULT_HTTP_IMAGE_QUALITY = "medium";

export function httpProviderFromEnv(): ImageProvider | null {
  const base = process.env.IMAGE_API_BASE?.trim();
  const key = process.env.IMAGE_API_KEY?.trim();
  if (!base || !key) return null;
  const model = process.env.IMAGE_API_MODEL?.trim() || DEFAULT_HTTP_IMAGE_MODEL;
  const quality = process.env.IMAGE_API_QUALITY?.trim() || DEFAULT_HTTP_IMAGE_QUALITY;
  return {
    id: "http",
    generate: (request) => generateWithHttp(base, key, model, quality, request),
  };
}

async function generateWithHttp(base: string, key: string, model: string, quality: string, request: GenerateRequest): Promise<GenerateResult> {
  const endpoint = `${base.replace(/\/$/, "")}/images/generations`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: request.prompt,
        size: "1536x1024",
        quality,
        n: 1,
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      return {
        provider: "http",
        status: "error",
        imageSrc: null,
        message: `Image API ${response.status}: ${detail}`,
        prompt: request.prompt,
      };
    }
    const json = (await response.json()) as {
      data?: { b64_json?: string; url?: string }[];
    };
    const first = json.data?.[0];
    if (first?.b64_json) {
      const name = `gen-${Date.now()}.png`;
      const dir = path.join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), Buffer.from(first.b64_json, "base64"));
      return {
        provider: "http",
        status: "ready",
        imageSrc: `/uploads/${name}`,
        message: "Stored the image returned by the HTTP adapter.",
        prompt: request.prompt,
      };
    }
    if (first?.url) {
      return {
        provider: "http",
        status: "ready",
        imageSrc: first.url,
        message: "The HTTP adapter returned a remote image URL.",
        prompt: request.prompt,
      };
    }
    return {
      provider: "http",
      status: "error",
      imageSrc: null,
      message: "The image API response did not include an image.",
      prompt: request.prompt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image request failed";
    return { provider: "http", status: "error", imageSrc: null, message, prompt: request.prompt };
  }
}
