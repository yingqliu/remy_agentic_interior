import { existsSync } from "node:fs";
import path from "node:path";
import { FINISH_PRESET_KEYS } from "@/lib/generation-budget";
import type { SeedreamCatalog } from "@/lib/types";

const SAFE_KEY = /^[a-z0-9-]+$/;

/** Which Seedream files are on disk. Missing files are omitted so the UI keeps the seed still. */
export function readSeedreamCatalog(schemeKeys: string[], publicRoot = path.join(process.cwd(), "public")): SeedreamCatalog {
  const structure: string[] = [];
  const finish: Record<string, string[]> = {};
  for (const schemeKey of schemeKeys) {
    if (!SAFE_KEY.test(schemeKey)) continue;
    const dir = path.join(publicRoot, "uploads", "fan", "seedream", schemeKey);
    if (existsSync(path.join(dir, "structure.jpg"))) structure.push(schemeKey);
    finish[schemeKey] = FINISH_PRESET_KEYS.filter((presetKey) => existsSync(path.join(dir, `${presetKey}.jpg`)));
  }
  return { structure, finish };
}
