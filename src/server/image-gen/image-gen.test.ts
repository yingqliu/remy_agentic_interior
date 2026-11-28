import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFanProject } from "../../../prisma/fan-data";
import { readyImageForScheme, readyImageWithoutScheme } from "@/lib/generated-image";
import type { GenerationDTO } from "@/lib/types";
import { getImageProvider } from "./index";
import { createOpenAIProvider, OPENAI_IMAGE_MODEL, OPENAI_IMAGES_ENDPOINT, readImagePayload, writeGeneratedPng } from "./openai";
import { UNIVERSAL_CONSTRAINTS, buildGenerationRequest, buildGenerationRequests } from "./prompt";
import type { GenerateRequest } from "./types";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);

function sampleRequest(prompt = "paint the scheme"): GenerateRequest {
  return {
    projectTitle: "Fan",
    roomKind: "bathroom",
    roomName: "主卧卫生间",
    sourcePhoto: "/seed/fan/fan-before.jpg",
    requirements: ["keep the existing window"],
    constraints: [...UNIVERSAL_CONSTRAINTS],
    schemeKey: "open",
    schemeName: "方案一",
    prompt,
  };
}

test("prompts include the scheme description, room context, and hard constraints", () => {
  const project = buildFanProject();
  const requests = buildGenerationRequests(project);
  assert.equal(requests.length, project.schemes.length);
  const open = requests.find((item) => item.schemeKey === "open");
  const variant = requests.find((item) => item.schemeKey === "wetroom");
  assert.ok(open);
  assert.ok(variant);
  assert.equal(open.schemeName, "方案一");
  assert.match(open.prompt, /主卧卫生间/);
  assert.match(open.prompt, /bathroom/);
  assert.match(open.prompt, /fan-before\.jpg/);
  assert.match(open.prompt, /Scheme description: 方案一：贴砖淋浴/);
  assert.doesNotMatch(open.prompt, /嵌入式大电视/);
  assert.match(variant.prompt, /Scheme: 方案一变体/);
  assert.match(variant.prompt, /嵌入式大电视/);
  for (const request of requests) {
    for (const constraint of UNIVERSAL_CONSTRAINTS) {
      assert.ok(request.prompt.includes(constraint), constraint);
    }
    assert.match(request.prompt, /Never invent windows, doors, skylights/);
    assert.equal(request.sourcePhoto, project.room.beforeSrc);
  }

  const bare = buildGenerationRequest({ ...project, schemes: [] }, null);
  assert.equal(bare.schemeKey, null);
  assert.match(bare.prompt, /Scheme: none written yet/);
  assert.match(bare.prompt, /Never invent windows, doors, skylights/);
  assert.equal(buildGenerationRequests({ ...project, schemes: [] }).length, 1);
});

test("gpt-image-1 decodes b64_json and returns a display path", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  let saved: Buffer | null = null;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init: init ?? {} });
    return new Response(JSON.stringify({ data: [{ b64_json: PNG.toString("base64") }] }), { status: 200 });
  };
  const provider = createOpenAIProvider({
    apiKey: "test-key",
    fetchImpl,
    saveBytes: async (bytes) => {
      saved = Buffer.from(bytes);
      return "/uploads/gen-test.png";
    },
  });
  const request = sampleRequest("scheme prompt");
  const result = await provider.generate(request);
  assert.equal(provider.id, "openai");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, OPENAI_IMAGES_ENDPOINT);
  const headers = new Headers(calls[0].init.headers);
  assert.equal(headers.get("Authorization"), "Bearer test-key");
  assert.equal(headers.get("Content-Type"), "application/json");
  const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
  assert.equal(body.model, OPENAI_IMAGE_MODEL);
  assert.equal(body.model, "gpt-image-1");
  assert.equal(body.prompt, request.prompt);
  assert.equal(body.n, 1);
  assert.equal(body.size, "1536x1024");
  assert.equal(body.output_format, "png");
  assert.equal("response_format" in body, false);
  assert.equal(JSON.stringify(body).includes("test-key"), false);
  assert.deepEqual(saved, PNG);
  assert.equal(result.status, "ready");
  assert.equal(result.imageSrc, "/uploads/gen-test.png");
  assert.equal(result.provider, "openai");
  assert.doesNotMatch(result.imageSrc ?? "", /\/seed\//);
  assert.equal(result.message.includes("test-key"), false);
});

test("gpt-image-1 uses a returned url without saving bytes", async () => {
  let saved = false;
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ data: [{ url: "https://cdn.example/render.png" }] }), { status: 200 });
  const provider = createOpenAIProvider({
    apiKey: "test-key",
    fetchImpl,
    saveBytes: async () => {
      saved = true;
      return "/uploads/should-not-run.png";
    },
  });
  const result = await provider.generate(sampleRequest());
  assert.equal(saved, false);
  assert.equal(result.status, "ready");
  assert.equal(result.imageSrc, "https://cdn.example/render.png");
});

test("gpt-image-1 prefers b64_json when both fields are present", () => {
  const payload = readImagePayload({
    data: [{ b64_json: PNG.toString("base64"), url: "https://cdn.example/render.png" }],
  });
  assert.deepEqual(payload, { kind: "b64", data: PNG.toString("base64") });
  assert.equal(readImagePayload({ data: [{ url: "javascript:alert(1)" }] }), null);
  assert.equal(readImagePayload({ data: [] }), null);
});

test("gpt-image-1 reports API and network failures without throwing", async () => {
  const failed: typeof fetch = async () => new Response("bad key", { status: 401 });
  const provider = createOpenAIProvider({ apiKey: "secret-key", fetchImpl: failed, saveBytes: async () => "/uploads/x.png" });
  const error = await provider.generate(sampleRequest());
  assert.equal(error.status, "error");
  assert.equal(error.imageSrc, null);
  assert.match(error.message, /401/);
  assert.equal(error.message.includes("secret-key"), false);

  const offline: typeof fetch = async () => {
    throw new Error("network down");
  };
  const down = createOpenAIProvider({ apiKey: "secret-key", fetchImpl: offline, saveBytes: async () => "/uploads/x.png" });
  const thrown = await down.generate(sampleRequest());
  assert.equal(thrown.status, "error");
  assert.match(thrown.message, /network down/);

  const empty: typeof fetch = async () => new Response(JSON.stringify({ data: [{}] }), { status: 200 });
  const blank = createOpenAIProvider({ apiKey: "secret-key", fetchImpl: empty, saveBytes: async () => "/uploads/x.png" });
  const missing = await blank.generate(sampleRequest());
  assert.equal(missing.status, "error");
  assert.match(missing.message, /did not include an image/);
});

test("decoded png bytes are written as a file outside the seed catalog", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "remy-gen-"));
  try {
    const stored = await writeGeneratedPng(PNG, dir);
    const bytes = await readFile(stored);
    assert.deepEqual(bytes, PNG);
    assert.equal(stored.includes(`${path.sep}seed${path.sep}`), false);
    assert.match(path.basename(stored), /^gen-\d+-[a-f0-9]+\.png$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const uploads = path.join(process.cwd(), "public", "uploads");
  const publicPath = await writeGeneratedPng(PNG, uploads);
  try {
    assert.match(publicPath, /^\/uploads\/gen-\d+-[a-f0-9]+\.png$/);
    assert.equal(publicPath.includes("/seed/"), false);
    const bytes = await readFile(path.join(process.cwd(), "public", publicPath));
    assert.deepEqual(bytes, PNG);
  } finally {
    await rm(path.join(process.cwd(), "public", publicPath), { force: true });
  }
});

test("missing OPENAI_API_KEY keeps the stub and does not call the image API", async () => {
  const keys = ["OPENAI_API_KEY", "IMAGE_API_BASE", "IMAGE_API_KEY", "IMAGE_API_MODEL"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const restore = () => {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  try {
    for (const key of keys) delete process.env[key];
    const stub = getImageProvider();
    assert.equal(stub.id, "stub");
    const recorded = await stub.generate(sampleRequest("keep this prompt"));
    assert.equal(recorded.status, "stubbed");
    assert.equal(recorded.imageSrc, null);
    assert.equal(recorded.provider, "stub");
    assert.match(recorded.prompt, /keep this prompt/);
    assert.match(recorded.message, /did not synthesize an image/);

    process.env.OPENAI_API_KEY = "   ";
    assert.equal(getImageProvider().id, "stub");

    process.env.IMAGE_API_BASE = "https://example.test/v1";
    process.env.IMAGE_API_KEY = "other";
    assert.equal(getImageProvider().id, "http");

    process.env.OPENAI_API_KEY = "sk-test";
    assert.equal(getImageProvider().id, "openai");
  } finally {
    restore();
  }
});

test("scheme comparison picks the newest ready image and leaves other schemes alone", () => {
  const generations: GenerationDTO[] = [
    row("new", "open", "ready", "/uploads/new.png"),
    row("old", "open", "ready", "/uploads/old.png"),
    row("err", "wetroom", "error", null),
    row("room", null, "ready", "/uploads/room.png"),
  ];
  assert.equal(readyImageForScheme(generations, "open"), "/uploads/new.png");
  assert.equal(readyImageForScheme(generations, "wetroom"), null);
  assert.equal(readyImageForScheme(generations, "alcove"), null);
  assert.equal(readyImageWithoutScheme(generations), "/uploads/room.png");
});

function row(id: string, schemeKey: string | null, status: string, imageSrc: string | null): GenerationDTO {
  return {
    id,
    provider: "openai",
    status,
    prompt: "",
    message: null,
    imageSrc,
    schemeKey,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}
