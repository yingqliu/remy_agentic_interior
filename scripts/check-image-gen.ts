import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  GEMINI_ASPECT_RATIO,
  GEMINI_EDIT_INSTRUCTION,
  GEMINI_IMAGE_SIZE,
  GEMINI_INTERACTIONS_URL,
  geminiProviderFromEnv,
} from "../src/server/image-gen/gemini-adapter";
import { DEFAULT_HTTP_IMAGE_MODEL, DEFAULT_HTTP_IMAGE_QUALITY, httpProviderFromEnv } from "../src/server/image-gen/http-adapter";
import { getImageProvider } from "../src/server/image-gen";
import type { GenerateRequest } from "../src/server/image-gen/types";

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const ENV_KEYS = ["IMAGE_PROVIDER", "GEMINI_API_KEY", "GEMINI_IMAGE_MODEL", "IMAGE_API_BASE", "IMAGE_API_KEY", "IMAGE_API_MODEL", "IMAGE_API_QUALITY"] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearImageEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

const request: GenerateRequest = {
  projectTitle: "樊家卫生间·方案对比",
  roomKind: "bathroom",
  roomName: "主卧卫生间",
  sourcePhoto: "/seed/fan/fan-before.jpg",
  requirements: ["keep the existing window"],
  constraints: ["Never move windows."],
  prompt: "Hard constraints:\n- Never move windows.",
};

type Captured = { url: string; init: RequestInit | undefined };

function installFetch(handler: (captured: Captured) => Promise<Response> | Response) {
  const calls: Captured[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const captured = { url: String(url), init };
    calls.push(captured);
    return handler(captured);
  }) as typeof fetch;
  return calls;
}

async function main() {
  try {
    expect(DEFAULT_GEMINI_IMAGE_MODEL === "gemini-nano-banana-2.1", "default Gemini model id");
    expect(DEFAULT_HTTP_IMAGE_MODEL === "gpt-image-2.6-flare", "default HTTP model id");
    expect(DEFAULT_HTTP_IMAGE_QUALITY === "medium", "default HTTP quality");

    clearImageEnv();
    expect(getImageProvider().id === "stub", "no env uses the stub");
    process.env.IMAGE_PROVIDER = "gemini";
    expect(geminiProviderFromEnv() === null, "gemini without a key stays inactive");
    expect(getImageProvider().id === "stub", "gemini without a key falls through to the stub");
    process.env.IMAGE_API_BASE = "https://example.test/v1";
    process.env.IMAGE_API_KEY = "http-key";
    expect(getImageProvider().id === "http", "gemini without a key falls through to the HTTP adapter");

    clearImageEnv();
    const fakeKey = "test-gemini-key";
    process.env.IMAGE_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = fakeKey;
    const provider = geminiProviderFromEnv();
    expect(provider?.id === "gemini", "gemini provider when flag and key are set");
    expect(getImageProvider().id === "gemini", "getImageProvider prefers gemini");

    const photo = await readFile(path.join(process.cwd(), "public/seed/fan/fan-before.jpg"));
    const photoB64 = photo.toString("base64");
    const png = Buffer.from("fake-image");
    const calls = installFetch(
      () =>
        new Response(
          JSON.stringify({
            status: "completed",
            steps: [{ type: "model_output", content: [{ type: "image", data: png.toString("base64"), mime_type: "image/png" }] }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const result = await provider!.generate(request);
    expect(calls.length === 1, "one Gemini request");
    const call = calls[0];
    expect(call.url === GEMINI_INTERACTIONS_URL, "interactions endpoint");
    expect(!call.url.includes(fakeKey), "key is not in the URL");
    const headers = new Headers(call.init?.headers);
    expect(headers.get("x-goog-api-key") === fakeKey, "key comes from GEMINI_API_KEY");
    const body = JSON.parse(String(call.init?.body)) as {
      model: string;
      input: { type: string; text?: string; data?: string; mime_type?: string }[];
      response_format: { type: string; image_size: string; aspect_ratio: string; delivery: string };
    };
    expect(body.model === "gemini-nano-banana-2.1", "request model id");
    expect(body.response_format.image_size === GEMINI_IMAGE_SIZE, "2K output");
    expect(body.response_format.aspect_ratio === GEMINI_ASPECT_RATIO, "3:2 output");
    expect(body.response_format.delivery === "inline", "inline image delivery");
    const text = body.input.find((item) => item.type === "text");
    const image = body.input.find((item) => item.type === "image");
    expect(text?.text?.includes(GEMINI_EDIT_INSTRUCTION), "edit instruction is in the prompt");
    expect(text?.text?.includes("same camera viewpoint") && text.text.includes("same window position") && text.text.includes("same walls"), "edit instruction locks camera, window, and walls");
    expect(text?.text?.includes(request.prompt), "scheme prompt is included");
    expect(image?.mime_type === "image/jpeg", "reference photo mime");
    expect(image?.data === photoB64, "reference photo bytes are the source file");
    expect(result.status === "ready" && result.imageSrc?.startsWith("/uploads/gen-"), "image stored under public/uploads");
    expect(result.provider === "gemini", "result provider is gemini");
    const stored = await readFile(path.join(process.cwd(), "public", result.imageSrc!));
    expect(stored.equals(png), "stored bytes match the API image");
    await unlink(path.join(process.cwd(), "public", result.imageSrc!));

    clearImageEnv();
    process.env.IMAGE_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = fakeKey;
    process.env.GEMINI_IMAGE_MODEL = "gemini-nano-banana-2.1-custom";
    const overrideCalls = installFetch(() => new Response("nope", { status: 400 }));
    const override = await geminiProviderFromEnv()!.generate(request);
    const overrideBody = JSON.parse(String(overrideCalls[0].init?.body)) as { model: string };
    expect(overrideBody.model === "gemini-nano-banana-2.1-custom", "GEMINI_IMAGE_MODEL overrides the default");
    expect(override.status === "error" && override.message.includes("400") && override.message.includes("gemini-nano-banana-2.1-custom"), "API errors name the status and model");
    expect(override.imageSrc === null, "errors do not invent an image");

    const missed = installFetch(() => new Response("should not be called", { status: 500 }));
    const missing = await geminiProviderFromEnv()!.generate({ ...request, sourcePhoto: "/seed/fan/missing.jpg" });
    expect(missed.length === 0, "missing source photo does not call Gemini");
    expect(missing.status === "error" && missing.message.includes("not found"), "missing photo is reported");

    clearImageEnv();
    process.env.IMAGE_API_BASE = "https://example.test/v1/";
    process.env.IMAGE_API_KEY = "http-key";
    const httpCalls = installFetch(() => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const httpProvider = httpProviderFromEnv();
    expect(httpProvider?.id === "http", "http provider");
    await httpProvider!.generate(request);
    const httpBody = JSON.parse(String(httpCalls[0].init?.body)) as { model: string; quality: string; prompt: string };
    expect(httpCalls[0].url === "https://example.test/v1/images/generations", "http generations endpoint");
    expect(new Headers(httpCalls[0].init?.headers).get("authorization") === "Bearer http-key", "http key from env");
    expect(httpBody.model === "gpt-image-2.6-flare", "http default model");
    expect(httpBody.quality === "medium", "http default quality");
    expect(!("image" in httpBody) && httpBody.prompt === request.prompt, "http adapter sends the prompt only");

    process.env.IMAGE_API_QUALITY = "high";
    process.env.IMAGE_API_MODEL = "gpt-image-2.6-flare";
    const qualityCalls = installFetch(() => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await httpProviderFromEnv()!.generate(request);
    const qualityBody = JSON.parse(String(qualityCalls[0].init?.body)) as { quality: string };
    expect(qualityBody.quality === "high", "IMAGE_API_QUALITY is sent as quality");

    console.log("image-gen checks ok");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
}

main().catch((error) => {
  globalThis.fetch = originalFetch;
  restoreEnv();
  console.error(error);
  process.exit(1);
});
