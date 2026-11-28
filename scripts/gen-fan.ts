import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildFanProject } from "../prisma/fan-data";
import { referencePhotoPublicSrc } from "../src/server/image-gen/gemini-adapter";
import { runSeedreamFanFlow } from "../src/server/image-gen/fan-seedream-flow";
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

async function main() {
  const providerFlag = process.argv.indexOf("--provider");
  const provider = providerFlag >= 0 ? process.argv[providerFlag + 1] : "seedream";
  if (provider !== "seedream") {
    console.error("This generation flow uses Seedream only. Gemini was not called.");
    process.exit(1);
  }
  const hasEnv = loadEnvFile(".env");
  if (!hasEnv) console.error("No .env file. Copy .env.ready to .env and set ARK_API_KEY.");
  const sourcePhoto = referencePhotoPublicSrc(process.env.SEEDREAM_REFERENCE_PHOTO || DEFAULT_SEEDREAM_REFERENCE_PHOTO);
  const project = buildFanProject();
  const abs = path.join(process.cwd(), "public", sourcePhoto.replace(/^\/+/, ""));
  const fan = path.join(process.cwd(), "public", project.room.beforeSrc.replace(/^\/+/, ""));
  if (!existsSync(abs) || path.resolve(abs) !== path.resolve(fan)) {
    console.error(`Reference photo ${sourcePhoto} is not the 樊家 before photo. Seedream was not called.`);
    process.exit(1);
  }
  const { exitCode } = await runSeedreamFanFlow({
    arkKey: process.env.ARK_API_KEY ?? "",
    project,
    sourcePhoto,
  });
  process.exit(exitCode);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Fan generation failed";
  console.error(message);
  process.exit(1);
});
