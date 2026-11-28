import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildFanProject } from "../prisma/fan-data";
import { buildGenerationRequest } from "../src/server/image-gen/prompt";
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_REFERENCE_PHOTO,
  generateWithGemini,
  referencePhotoPublicSrc,
} from "../src/server/image-gen/gemini-adapter";

const MISSING_KEY =
  "GEMINI_API_KEY is empty. Copy .env.ready to .env, set GEMINI_API_KEY, then run npm run gen:fan. Gemini was not called.";

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
  const hasEnv = loadEnvFile(".env");
  const key = process.env.GEMINI_API_KEY?.trim() ?? "";
  if (!key) {
    console.error(hasEnv ? MISSING_KEY : `No .env file. ${MISSING_KEY}`);
    process.exit(1);
  }

  process.env.IMAGE_PROVIDER = "gemini";
  const model = process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
  const sourcePhoto = referencePhotoPublicSrc();
  const photoAbs = path.join(process.cwd(), "public", sourcePhoto.replace(/^\/+/, ""));
  if (!existsSync(photoAbs)) {
    console.error(`Reference photo not found at ${process.env.GEMINI_REFERENCE_PHOTO?.trim() || DEFAULT_GEMINI_REFERENCE_PHOTO}. Gemini was not called.`);
    process.exit(1);
  }

  const project = buildFanProject();
  const fanPhoto = path.join(process.cwd(), "public", project.room.beforeSrc.replace(/^\/+/, ""));
  if (path.resolve(photoAbs) !== path.resolve(fanPhoto)) {
    console.error(
      `GEMINI_REFERENCE_PHOTO (${sourcePhoto}) is not the 樊家 before photo (${project.room.beforeSrc}). Gemini was not called.`,
    );
    process.exit(1);
  }

  for (const scheme of project.schemes) {
    const request = buildGenerationRequest(project, scheme);
    request.sourcePhoto = sourcePhoto;
    console.log(`Generating ${scheme.name} (${scheme.key}) from ${sourcePhoto}`);
    const result = await generateWithGemini(key, model, request, { outputBase: scheme.key });
    if (result.status !== "ready" || !result.imageSrc) {
      console.error(`${scheme.name} (${scheme.key}) failed: ${result.message}`);
      process.exit(1);
    }
    console.log(`${scheme.name} (${scheme.key}) -> public${result.imageSrc}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Fan generation failed";
  console.error(message);
  process.exit(1);
});
