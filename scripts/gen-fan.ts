import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildFanProject } from "../prisma/fan-data";
import { DEFAULT_GEMINI_REFERENCE_PHOTO, referencePhotoPublicSrc } from "../src/server/image-gen/gemini-adapter";
import { providersFromArgv, runFanSchemes, type FanProviderName } from "../src/server/image-gen/fan-run";
import { DEFAULT_SEEDREAM_REFERENCE_PHOTO } from "../src/server/image-gen/seedream-adapter";

function loadEnvFile(file: string): boolean {
  const abs = path.resolve(process.cwd(), file);
  if (!existsSync(abs)) return false;
  for (const line of readFileSync(abs, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

function photoFor(provider: FanProviderName): string {
  if (provider === "seedream") {
    return referencePhotoPublicSrc(process.env.SEEDREAM_REFERENCE_PHOTO || DEFAULT_SEEDREAM_REFERENCE_PHOTO);
  }
  return referencePhotoPublicSrc(process.env.GEMINI_REFERENCE_PHOTO || DEFAULT_GEMINI_REFERENCE_PHOTO);
}

function assertPhoto(provider: FanProviderName, projectBefore: string): boolean {
  const src = photoFor(provider);
  const abs = path.join(process.cwd(), "public", src.replace(/^\/+/, ""));
  const fan = path.join(process.cwd(), "public", projectBefore.replace(/^\/+/, ""));
  if (!existsSync(abs)) {
    console.error(`Reference photo not found at ${abs}. ${provider} was not called.`);
    return false;
  }
  if (path.resolve(abs) !== path.resolve(fan)) {
    console.error(`The ${provider} reference photo (${src}) is not the 樊家 before photo (${projectBefore}). ${provider} was not called.`);
    return false;
  }
  return true;
}

async function main() {
  const hasEnv = loadEnvFile(".env");
  const providers = providersFromArgv(process.argv.slice(2));
  if (!providers) {
    console.error("Unknown --provider. Use seedream, gemini, or both.");
    process.exit(1);
  }
  if (!hasEnv) console.error("No .env file. Copy .env.ready to .env and set the provider key.");
  const project = buildFanProject();
  for (const provider of providers) {
    if (!assertPhoto(provider, project.room.beforeSrc)) process.exit(1);
  }
  const code = await runFanSchemes({
    providers,
    arkKey: process.env.ARK_API_KEY ?? "",
    geminiKey: process.env.GEMINI_API_KEY ?? "",
    project,
    sourcePhotoFor: photoFor,
  });
  process.exit(code);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Fan generation failed";
  console.error(message);
  process.exit(1);
});
