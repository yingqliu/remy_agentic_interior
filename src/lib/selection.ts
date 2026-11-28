import type { HotspotDTO, ProjectDTO, SelectionState } from "./types";
import {
  activeScheme,
  chosenScheme,
  colorGridStill,
  colorsEqual,
  overlaySeedream,
  optionLabel,
  presetByColors,
  presetStill,
  schemeOptions,
  type Still,
} from "./visuals";

export function decisionKey(presetKey: string, hotspotKey: string): string {
  return `${presetKey}:${hotspotKey}`;
}

export function defaultSelection(project: ProjectDTO): SelectionState {
  const schemeOptionsMap: Record<string, Record<string, string>> = {};
  for (const scheme of project.schemes) {
    schemeOptionsMap[scheme.key] = {};
    for (const group of scheme.optionGroups) {
      if (group.unavailableReason) continue;
      const fallback = group.options.find((option) => option.isDefault) ?? group.options[0];
      if (fallback) schemeOptionsMap[scheme.key][group.key] = fallback.key;
    }
  }
  const dimensions: SelectionState["dimensions"] = {};
  for (const field of project.room.dimensions) {
    dimensions[field.id] = { text: field.initialText, source: field.initialSource };
  }
  const first = project.decor.presets[0];
  return {
    dimensionMode: "upload",
    dimensions,
    structureKey: null,
    schemeOptions: schemeOptionsMap,
    decorPreset: null,
    pendingPreset: null,
    colors: { ...(first?.colors ?? {}) },
    committedColors: null,
    decisions: {},
    preview: {},
    fixtureSwatch: null,
    committedFixture: null,
    committedTile: null,
  };
}

export function missingDimensions(project: ProjectDTO, selection: SelectionState): string[] {
  return project.room.dimensions
    .filter((field) => !selection.dimensions[field.id]?.text.trim())
    .map((field) => field.label);
}

export function optionsDifferFromDefault(project: ProjectDTO, selection: SelectionState): boolean {
  return project.schemes.some((scheme) =>
    scheme.optionGroups.some((group) => {
      if (group.unavailableReason) return false;
      const fallback = group.options.find((option) => option.isDefault) ?? group.options[0];
      if (!fallback) return false;
      const current = selection.schemeOptions[scheme.key]?.[group.key];
      return current != null && current !== fallback.key;
    }),
  );
}

export function hasCommit(project: ProjectDTO, selection: SelectionState): boolean {
  return (
    selection.decorPreset != null ||
    selection.structureKey != null ||
    selection.committedColors != null ||
    Object.keys(selection.decisions).length > 0 ||
    optionsDifferFromDefault(project, selection)
  );
}

export function hasPreview(project: ProjectDTO, selection: SelectionState): boolean {
  const first = project.decor.presets[0];
  const colorsDirty =
    selection.committedColors == null
      ? first != null && !colorsEqual(selection.colors, first.colors)
      : !colorsEqual(selection.colors, selection.committedColors);
  return (
    Object.keys(selection.preview).length > 0 ||
    selection.fixtureSwatch != null ||
    selection.pendingPreset != null ||
    colorsDirty
  );
}

export type SelectedHotspot = {
  key: string;
  presetKey: string;
  presetName: string;
  title: string;
  category: string;
  x: number;
  y: number;
  still: Still | null;
};

function hotspotTitle(spot: HotspotDTO, presetKey: string): string {
  return spot.titles?.[presetKey] ?? spot.title ?? spot.key;
}

export type SummaryModel = {
  lines: string[];
  still: Still | null;
  exact: boolean;
  selected: SelectedHotspot[];
  structureUnsetImage: boolean;
};

export function buildSummary(project: ProjectDTO, selection: SelectionState): SummaryModel {
  const lines: string[] = [];
  const committed = project.decor.presets.find((preset) => preset.key === selection.decorPreset) ?? null;
  lines.push(committed ? `整体方向：${committed.name}` : "整体方向：还没定");

  const chosen = chosenScheme(project, selection);
  if (!selection.structureKey) lines.push("结构：布置还没定");
  else if (selection.structureKey === "maybe") lines.push("结构：几种布置还在想（再想想）");
  else if (chosen) lines.push(`结构：${chosen.name}`);

  if (chosen) {
    const options = schemeOptions(chosen, selection);
    const splash = optionLabel(chosen, "splash", options.splash);
    const entryGroup = chosen.optionGroups.find((group) => group.key === "entry");
    const entry = optionLabel(chosen, "entry", options.entry);
    if (splash) lines.push(`挡水：${splash}（仅「${chosen.name}」）`);
    if (entry && !entryGroup?.unavailableReason) lines.push(`入口：${entry}（仅「${chosen.name}」）`);
    for (const extra of chosen.summaryLines ?? []) lines.push(extra);
  }

  if (selection.committedColors) {
    for (const axis of project.decor.axes) {
      const choice = axis.choices.find((item) => item.key === selection.committedColors?.[axis.key]);
      if (choice) lines.push(`${axis.summaryLabel}：${choice.label}`);
    }
  }

  const selected: SelectedHotspot[] = [];
  const schemeForThumbs = chosen ?? activeScheme(project, selection);
  const splash = schemeForThumbs ? schemeOptions(schemeForThumbs, selection).splash : undefined;
  for (const preset of project.decor.presets) {
    const spots = schemeForThumbs?.hotspots ?? [];
    for (const spot of spots) {
      if (selection.decisions[decisionKey(preset.key, spot.key)] !== "selected") continue;
      selected.push({
        key: spot.key,
        presetKey: preset.key,
        presetName: preset.name,
        title: hotspotTitle(spot, preset.key),
        category: spot.category,
        x: spot.x,
        y: spot.y,
        still: schemeForThumbs
          ? overlaySeedream(presetStill(schemeForThumbs, preset, {}, splash), schemeForThumbs.key, { kind: "finish", presetKey: preset.key }, project.seedream)
          : null,
      });
    }
  }

  const tilePick = selected.find((item) => item.category === "tile");
  if (tilePick) lines.push(`墙砖：${tilePick.title}（来自${tilePick.presetName}）`);
  for (const item of selected) {
    if (item.category === "tile") continue;
    const label =
      item.category === "tub" ? "浴缸" : item.category === "vanity" ? "洗手台" : item.category === "shower" ? "花洒" : item.title;
    lines.push(`${label}：套用自${item.presetName}`);
  }

  if (selection.committedTile) {
    const preset = project.decor.presets.find((item) => item.key === selection.committedTile);
    if (preset) lines.push(`墙砖颜色：${preset.swatch.label}`);
  }
  if (selection.committedFixture) {
    const axis = project.decor.axes.find((item) => item.key === "fixture");
    const choice = axis?.choices.find((item) => item.key === selection.committedFixture);
    if (choice) lines.push(`花洒表面：${choice.label}`);
  }

  const missing = missingDimensions(project, selection);
  if (missing.length > 0) lines.push(`尺寸待确认：${missing.join("、")}`);

  const imageScheme = chosen ?? activeScheme(project, selection);
  let still: Still | null = null;
  let exact = false;
  if (imageScheme?.decorMode === "colorGrid" && chosen) {
    const colors =
      selection.committedColors ??
      (committed ? committed.colors : selection.colors);
    still = overlaySeedream(
      colorGridStill(imageScheme, colors, schemeOptions(imageScheme, selection).splash),
      imageScheme.key,
      { kind: "finish", presetKey: presetByColors(project.decor.presets, colors)?.key ?? null },
      project.seedream,
    );
    exact = true;
  } else if (committed && imageScheme) {
    still = overlaySeedream(
      presetStill(imageScheme, committed, {}, schemeOptions(imageScheme, selection).splash),
      imageScheme.key,
      { kind: "finish", presetKey: committed.key },
      project.seedream,
    );
    const colorsMatch =
      selection.committedColors == null || colorsEqual(selection.committedColors, committed.colors);
    exact = colorsMatch && chosen != null;
  }

  return {
    lines,
    still,
    exact,
    selected,
    structureUnsetImage: still != null && chosen == null,
  };
}

export { presetByColors };
