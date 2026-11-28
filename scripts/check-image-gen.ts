import { spawnSync } from "node:child_process";
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
import { buildFanProject } from "../prisma/fan-data";
import { presetFinishLine } from "../src/server/image-gen/preset-wording";
import { assessImageBytes } from "../src/server/image-gen/image-check";
import { MAX_SEEDREAM_CALLS_PER_FULL_RUN, runSeedreamFanFlow } from "../src/server/image-gen/fan-seedream-flow";
import {
  DEFAULT_SEEDREAM_MODEL,
  SEEDREAM_EDIT_INSTRUCTION,
  generateWithSeedream,
  seedreamProviderFromEnv,
} from "../src/server/image-gen/seedream-adapter";
import type { GenerateRequest } from "../src/server/image-gen/types";

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const ENV_KEYS = [
  "IMAGE_PROVIDER",
  "GEMINI_API_KEY",
  "GEMINI_IMAGE_MODEL",
  "GEMINI_ASPECT_RATIO",
  "GEMINI_IMAGE_SIZE",
  "GEMINI_REFERENCE_PHOTO",
  "ARK_API_KEY",
  "SEEDREAM_API_BASE",
  "SEEDREAM_MODEL",
  "SEEDREAM_SIZE",
  "SEEDREAM_RESPONSE_FORMAT",
  "SEEDREAM_OUTPUT_FORMAT",
  "SEEDREAM_WATERMARK",
  "SEEDREAM_REFERENCE_PHOTO",
  "IMAGE_API_BASE",
  "IMAGE_API_KEY",
  "IMAGE_API_MODEL",
  "IMAGE_API_QUALITY",
] as const;
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

function pngImage(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  bytes[0] = 0x89;
  bytes.write("PNG", 1, "ascii");
  bytes[4] = 0x0d;
  bytes[5] = 0x0a;
  bytes[6] = 0x1a;
  bytes[7] = 0x0a;
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

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
    process.env.GEMINI_IMAGE_SIZE = "1K";
    process.env.GEMINI_ASPECT_RATIO = "16:9";
    const overrideCalls = installFetch(() => new Response("nope", { status: 400 }));
    const override = await geminiProviderFromEnv()!.generate(request);
    const overrideBody = JSON.parse(String(overrideCalls[0].init?.body)) as {
      model: string;
      response_format: { image_size: string; aspect_ratio: string };
    };
    expect(overrideBody.model === "gemini-nano-banana-2.1-custom", "GEMINI_IMAGE_MODEL overrides the default");
    expect(overrideBody.response_format.image_size === "1K" && overrideBody.response_format.aspect_ratio === "16:9", "size and aspect come from env");
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

    clearImageEnv();
    process.env.IMAGE_PROVIDER = "seedream";
    process.env.GEMINI_API_KEY = "gemini-key-must-not-be-selected";
    expect(seedreamProviderFromEnv() === null, "seedream without a key stays inactive");
    expect(getImageProvider().id === "stub", "a missing Seedream key does not fall back to Gemini");
    process.env.ARK_API_KEY = "test-ark-key";
    expect(getImageProvider().id === "seedream", "IMAGE_PROVIDER=seedream selects Seedream");

    const seedreamCalls = installFetch(
      () =>
        new Response(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const seedream = await generateWithSeedream("test-ark-key", request, { outputBase: "open", folder: "fan/seedream" });
    expect(seedreamCalls.length === 1, "one Seedream request");
    expect(seedreamCalls[0].url === "https://ark.cn-beijing.volces.com/api/v3/images/generations", "Ark endpoint");
    expect(new Headers(seedreamCalls[0].init?.headers).get("authorization") === "Bearer test-ark-key", "Ark key from ARK_API_KEY");
    const seedreamBody = JSON.parse(String(seedreamCalls[0].init?.body)) as {
      model: string;
      prompt: string;
      image: string;
      size: string;
      response_format: string;
      output_format: string;
      watermark: boolean;
    };
    expect(seedreamBody.model === DEFAULT_SEEDREAM_MODEL, "Seedream model id");
    expect(seedreamBody.size === "2K", "Seedream size 2K");
    expect(seedreamBody.response_format === "b64_json", "Seedream returns b64_json");
    expect(seedreamBody.output_format === "jpeg", "Seedream jpeg output");
    expect(seedreamBody.watermark === false, "Seedream watermark off");
    expect(seedreamBody.image === `data:image/jpeg;base64,${photoB64}`, "reference photo is a data URI");
    expect(seedreamBody.prompt.includes(SEEDREAM_EDIT_INSTRUCTION), "Seedream edit instruction");
    expect(seedreamBody.prompt.includes("3:2"), "Seedream prompt states 3:2");
    expect(seedreamBody.prompt.includes(request.prompt), "scheme prompt is included");
    expect(seedream.status === "ready" && seedream.imageSrc === "/uploads/fan/seedream/open.jpg", "Seedream image path");
    await unlink(path.join(process.cwd(), "public", seedream.imageSrc!));

    const project = buildFanProject();
    const goodPng = pngImage(2496, 1664);
    const tinyPng = pngImage(100, 80);
    expect(assessImageBytes(goodPng).ok, "3:2 2K image passes");
    expect(assessImageBytes(tinyPng).reason?.includes("too small"), "tiny image is poor");
    expect(assessImageBytes(pngImage(1000, 1000)).reason?.includes("aspect"), "square image is the wrong aspect");
    expect(MAX_SEEDREAM_CALLS_PER_FULL_RUN === 20, "full run cap is 4x2 structure plus 4x3 finishes");

    for (const preset of project.decor.presets) {
      const line = presetFinishLine(preset);
      expect(line.includes(preset.name) && line.includes("Do not add or move windows"), `${preset.key} wording locks windows`);
    }
    expect(presetFinishLine(project.decor.presets[0]).includes("brushed nickel shower fixtures"), "mist fixture wording");
    expect(presetFinishLine(project.decor.presets[1]).includes("a dark wood vanity"), "wood vanity wording");
    expect(presetFinishLine(project.decor.presets[2]).includes("ink-gray stone wall tile"), "ink wall wording");

    const prompts: string[] = [];
    const folders: string[] = [];
    let structureReads = 0;
    const poorThenGood = await runSeedreamFanFlow({
      arkKey: "test-ark-key",
      project,
      sourcePhoto: "/seed/fan/fan-before.jpg",
      readBytes: async (src) => {
        if (!src.endsWith("/structure.jpg")) return goodPng;
        structureReads += 1;
        return structureReads % 2 === 1 ? tinyPng : goodPng;
      },
      generate: async (_key, request, options) => {
        prompts.push(request.prompt);
        folders.push(`${options?.folder ?? ""}/${options?.outputBase ?? ""}`);
        return {
          provider: "seedream",
          status: "ready",
          imageSrc: `/uploads/${options?.folder}/${options?.outputBase}.jpg`,
          message: "ok",
          prompt: request.prompt,
        };
      },
    });
    expect(poorThenGood.exitCode === 0, "retry then finishes succeed");
    const structureCalls = folders.filter((item) => item.endsWith("/structure"));
    const finishCalls = folders.filter((item) => /\/(mist|wood|ink)$/.test(item));
    expect(structureCalls.length === 8, "each scheme gets two structure attempts when the first is poor");
    expect(finishCalls.length === 12, "three finish presets for each scheme");
    expect(prompts.filter((prompt) => prompt.includes("Finish variant")).length === 12, "finish prompts name the preset");
    expect(prompts.every((prompt) => prompt.includes("Never move, add, or resize windows")), "structural window lock stays in every prompt");
    expect(folders.every((item) => item.startsWith("fan/seedream/")), "files stay under the Seedream scheme folder");

    let judgeCalls = 0;
    const judged = await runSeedreamFanFlow({
      arkKey: "test-ark-key",
      project,
      sourcePhoto: "/seed/fan/fan-before.jpg",
      schemes: [project.schemes[0]],
      readBytes: async () => goodPng,
      judge: () => {
        judgeCalls += 1;
        return judgeCalls === 1 ? { ok: false, reason: "quality judge rejected the image" } : { ok: true };
      },
      generate: async (_key, request, options) => ({
        provider: "seedream",
        status: "ready",
        imageSrc: `/uploads/${options?.folder}/${options?.outputBase}.jpg`,
        message: "ok",
        prompt: request.prompt,
      }),
    });
    expect(judgeCalls === 5, "judge runs on the retried structure and the three finishes");
    expect(judged.exitCode === 0, "judge hook can accept the second structure attempt");

    const blocked: string[] = [];
    const emptyFlow = await runSeedreamFanFlow({
      arkKey: "",
      project,
      sourcePhoto: "/seed/fan/fan-before.jpg",
      error: (line) => blocked.push(line),
      generate: async () => {
        throw new Error("Seedream should not be called");
      },
    });
    expect(emptyFlow.exitCode === 1 && blocked[0]?.includes("ARK_API_KEY is empty"), "empty Seedream key exits before a call");

    const missingKey = spawnSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "scripts/gen-fan.ts"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, ARK_API_KEY: "", GEMINI_API_KEY: "present-but-must-not-be-used" },
    });
    expect(missingKey.status === 1, "gen:fan exits when the Seedream key is empty");
    expect(missingKey.stderr.includes("ARK_API_KEY is empty"), "gen:fan names the Seedream key");
    expect(missingKey.stderr.includes("Seedream was not called"), "gen:fan does not call Seedream without a key");
    expect(!missingKey.stdout.includes("Gemini"), "gen:fan does not start Gemini");
    const geminiFlag = spawnSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "scripts/gen-fan.ts", "--provider", "gemini"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, ARK_API_KEY: "should-not-be-used", GEMINI_API_KEY: "should-not-be-used" },
    });
    expect(geminiFlag.status === 1, "gemini flag exits");
    expect(geminiFlag.stderr.includes("Gemini was not called"), "gemini flag does not call Gemini");

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
