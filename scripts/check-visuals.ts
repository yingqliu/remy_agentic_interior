import { existsSync } from "node:fs";
import path from "node:path";
import { buildFanProject } from "../prisma/fan-data";
import { defaultSelection } from "../src/lib/selection";
import { comboIndex, presetStill, structureStill } from "../src/lib/visuals";

const project = buildFanProject();
const selection = defaultSelection(project);

function scheme(key: string) {
  const found = project.schemes.find((item) => item.key === key);
  if (!found) throw new Error(`missing scheme ${key}`);
  return found;
}

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const open = scheme("open");
const glass = structureStill(open, selection);
expect(glass?.src.endsWith("fan-struct-vanity.jpg"), "open glass still");
expect(!glass?.note, "open curbless has no curb note");

const curtain = structureStill(open, {
  ...selection,
  schemeOptions: { ...selection.schemeOptions, open: { splash: "curtain", entry: "curbless" } },
});
expect(curtain?.src.endsWith("fan-wood-inktile.jpg"), "open curtain still");

const curb = structureStill(open, {
  ...selection,
  schemeOptions: { ...selection.schemeOptions, open: { splash: "glass", entry: "curb" } },
});
expect(curb?.note?.includes("矮坝"), "curb note");

const wet = scheme("wetroom");
const wetCurtain = structureStill(wet, {
  ...selection,
  schemeOptions: { ...selection.schemeOptions, wetroom: { splash: "curtain", entry: "curbless" } },
});
expect(wetCurtain?.src.endsWith("fan-struct-wetroom.jpg") && wetCurtain.frame === 1, "wetroom curtain frame");

const alcove = scheme("alcove");
expect(structureStill(alcove, selection)?.src.endsWith("fan-ink-misttile.jpg"), "alcove glass");
expect(
  structureStill(alcove, {
    ...selection,
    schemeOptions: { ...selection.schemeOptions, alcove: { splash: "curtain" } },
  })?.src.endsWith("fan-struct-combo.jpg"),
  "alcove curtain",
);
expect(alcove.optionGroups.find((group) => group.key === "entry")?.unavailableReason, "alcove entry blocked");

const panel = scheme("panel");
const panelCurtain = structureStill(panel, {
  ...selection,
  schemeOptions: { ...selection.schemeOptions, panel: { splash: "curtain" } },
});
expect(panelCurtain?.frame === 1 && panelCurtain.src.endsWith("fan-struct-panel.jpg"), "panel curtain frame");

const mist = project.decor.presets[0];
const wood = project.decor.presets[1];
const ink = project.decor.presets[2];
expect(comboIndex(mist.colors, alcove) === 0, "mist index 0");
expect(comboIndex(wood.colors, alcove) === 5, "wood index 5");
expect(comboIndex(ink.colors, alcove) === 15, "ink index 15");

const mistStill = presetStill(alcove, mist, {}, "glass");
const woodStill = presetStill(alcove, wood, {}, "glass");
const inkStill = presetStill(alcove, ink, {}, "glass");
expect(mistStill?.src.endsWith("fan-decor-combo-mist.jpg") && mistStill.frame === 0, "mist grid frame");
expect(woodStill?.src.endsWith("fan-decor-combo-wood.jpg") && woodStill.frame === 1, "wood grid frame");
expect(inkStill?.src.endsWith("fan-decor-wetroom-mist.jpg") && inkStill.frame === 3, "ink grid frame");
expect(presetStill(alcove, mist, {}, "curtain")?.note?.includes("浴帘"), "curtain caveat");

const swapped = presetStill(open, mist, { tile: "ink" }, "glass");
expect(swapped?.src.endsWith("fan-decor-vanity-ink.jpg") && swapped.exact, "tile preview swaps still");
const own = presetStill(open, mist, { tile: "mist" }, "glass");
expect(own?.src.endsWith("fan-decor-vanity-mist.jpg"), "same-preset preview does not swap");

const files = new Set<string>();
files.add(project.room.beforeSrc);
for (const item of project.schemes) {
  for (const render of item.renders) files.add(render.src);
}
expect(files.size === 20, `expected 20 images, saw ${files.size}`);
for (const src of files) {
  const disk = path.join(process.cwd(), "public", src);
  expect(existsSync(disk), `missing ${src}`);
}

const shower = open.hotspots.find((spot) => spot.key === "shower");
const tub = open.hotspots.find((spot) => spot.key === "tub");
const wetShower = wet.hotspots.find((spot) => spot.key === "shower");
expect(shower?.x === 27 && tub?.x === 58, "open fixture anchors sit on the shower wall and tub");
expect(wetShower != null && wetShower.x !== shower?.x, "variant shower anchor follows that layout, not scheme 1");
expect(open.hotspots.length === wet.hotspots.length, "each layout has the same fixture hotspots");

console.log("visual checks ok");
