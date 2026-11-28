import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildFanProject } from "../prisma/fan-data";
import { defaultSelection } from "../src/lib/selection";
import { readSeedreamCatalog } from "../src/server/seedream-catalog";
import { overlaySeedream, presetStill, schemeOptions, structureStill } from "../src/lib/visuals";

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

/** Files present after the Mac Seedream run: panel empty, alcove structure only. */
const PRESENT: Record<string, string[]> = {
  open: ["structure", "mist", "wood", "ink"],
  wetroom: ["structure", "mist", "wood", "ink"],
  alcove: ["structure"],
  panel: [],
};

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), "seedream-stills-"));
  try {
    for (const [schemeKey, files] of Object.entries(PRESENT)) {
      const dir = path.join(root, "uploads", "fan", "seedream", schemeKey);
      await mkdir(dir, { recursive: true });
      for (const file of files) await writeFile(path.join(dir, `${file}.jpg`), "x");
    }
    const project = buildFanProject();
    const catalog = readSeedreamCatalog(project.schemes.map((scheme) => scheme.key), root);
    const selection = defaultSelection(project);
    expect(catalog.structure.join(",") === "open,wetroom,alcove", "structure files detected");
    expect(catalog.finish.open?.join(",") === "mist,wood,ink", "open finishes");
    expect(catalog.finish.wetroom?.join(",") === "mist,wood,ink", "wetroom finishes");
    expect(catalog.finish.alcove?.length === 0, "alcove has no finish files");
    expect(catalog.finish.panel?.length === 0, "panel has no files");

    for (const scheme of project.schemes) {
      const structure = overlaySeedream(structureStill(scheme, selection), scheme.key, { kind: "structure" }, catalog);
      const structureGenerated = PRESENT[scheme.key].includes("structure");
      expect(structure?.origin === (structureGenerated ? "seedream" : "sample"), `${scheme.key} structure origin`);
      if (structureGenerated) {
        expect(structure?.src === `/uploads/fan/seedream/${scheme.key}/structure.jpg`, `${scheme.key} structure path`);
        expect(structure?.frames === 1, `${scheme.key} structure is a single frame`);
      } else {
        expect(structure?.src.startsWith("/seed/"), `${scheme.key} structure falls back to the seed still`);
      }
      const splash = schemeOptions(scheme, selection).splash;
      for (const preset of project.decor.presets) {
        const finish = overlaySeedream(
          presetStill(scheme, preset, {}, splash),
          scheme.key,
          { kind: "finish", presetKey: preset.key },
          catalog,
        );
        const generated = PRESENT[scheme.key].includes(preset.key);
        expect(finish?.origin === (generated ? "seedream" : "sample"), `${scheme.key} ${preset.key} origin`);
        if (generated) expect(finish?.src === `/uploads/fan/seedream/${scheme.key}/${preset.key}.jpg`, `${scheme.key} ${preset.key} path`);
        else expect(finish?.src.startsWith("/seed/"), `${scheme.key} ${preset.key} falls back to the seed still`);
      }
    }

    const untouched = structureStill(project.schemes[0], selection);
    expect(untouched?.origin == null && untouched?.src.startsWith("/seed/"), "no catalog leaves the seed still unchanged");
    console.log("seedream still checks ok");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
