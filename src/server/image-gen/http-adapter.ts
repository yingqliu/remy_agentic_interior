import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GenerateRequest, GenerateResult, ImageProvider } from "./types";

/**
 * REAL IMAGE API ADAPTER
 * -----------------------
 * This is the only module that calls a hosted image model.
 * It stays inactive until both IMAGE_API_BASE and IMAGE_API_KEY are set.
 * Do not commit keys. See .env.example.
 *
 * The seeded 樊家 demo does not call this adapter. A successful response is
 * stored under public/uploads and on the Generation row. It is not written
 * back onto a scheme, so a live key cannot overwrite the demo stills.
 *
 * Expected shape: OpenAI-compatible POST {IMAGE_API_BASE}/images/generations
 * with Authorization: Bearer IMAGE_API_KEY. The source photo path is included
 * in the prompt. Reference-image editing (multipart /images/edits) is the
 * next step for this adapter; this version sends the prompt only.
 */
export function httpProviderFromEnv(): ImageProvider | null {
  const base = process.env.IMAGE_API_BASE?.trim();
  const key = process.env.IMAGE_API_KEY?.trim();
  if (!base || !key) return null;
  const model = process.env.IMAGE_API_MODEL?.trim() || "gpt-image-1";
  return {
    id: "http",
    generate: (request) => generateWithHttp(base, key, model, request),
  };
}

async function generateWithHttp(base: string, key: string, model: string, request: GenerateRequest): Promise<GenerateResult> {
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
