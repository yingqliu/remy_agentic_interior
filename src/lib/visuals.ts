import type {
  DecorPreset,
  ProjectDTO,
  RenderDTO,
  RenderWhen,
  SchemeDTO,
  SeedreamCatalog,
  SelectionState,
} from "./types";

export function seedreamStructureSrc(schemeKey: string): string {
  return `/uploads/fan/seedream/${schemeKey}/structure.jpg`;
}

export function seedreamFinishSrc(schemeKey: string, presetKey: string): string {
  return `/uploads/fan/seedream/${schemeKey}/${presetKey}.jpg`;
}

export function overlaySeedream(
  still: Still | null,
  schemeKey: string,
  slot: { kind: "structure" } | { kind: "finish"; presetKey: string | null },
  catalog?: SeedreamCatalog | null,
): Still | null {
  if (!still || !catalog) return still;
  const generated =
    slot.kind === "structure"
      ? catalog.structure.includes(schemeKey)
        ? seedreamStructureSrc(schemeKey)
        : null
      : slot.presetKey && catalog.finish[schemeKey]?.includes(slot.presetKey)
        ? seedreamFinishSrc(schemeKey, slot.presetKey)
        : null;
  if (generated) {
    return { ...still, src: generated, frames: 1, frame: 0, origin: "seedream" };
  }
  if (still.src.startsWith("/seed/")) return { ...still, origin: "sample" };
  return still;
}

export function matchRender(rules: RenderDTO[], ctx: RenderWhen): RenderDTO | null {
  let best: { score: number; rule: RenderDTO } | null = null;
  for (const rule of rules) {
    const entries = Object.entries(rule.when).filter(([, value]) => value !== undefined && value !== null);
    const ok = entries.every(([key, value]) => ctx[key as keyof RenderWhen] === value);
    if (!ok) continue;
    if (!best || entries.length > best.score) best = { score: entries.length, rule };
  }
  return best?.rule ?? null;
}

export function resolveCompareText(
  variants: { when?: Record<string, string>; text: string }[],
  options: Record<string, string>,
): string {
  let best: { score: number; text: string } | null = null;
  for (const variant of variants) {
    const entries = Object.entries(variant.when ?? {});
    const ok = entries.every(([key, value]) => options[key] === value);
    if (!ok) continue;
    if (!best || entries.length > best.score) best = { score: entries.length, text: variant.text };
  }
  return best?.text ?? "";
}

export function schemeOptions(scheme: SchemeDTO, selection: SelectionState): Record<string, string> {
  const saved = selection.schemeOptions[scheme.key] ?? {};
  const out: Record<string, string> = {};
  for (const group of scheme.optionGroups) {
    if (group.unavailableReason) continue;
    const fallback = group.options.find((option) => option.isDefault) ?? group.options[0];
    if (!fallback) continue;
    out[group.key] = saved[group.key] ?? fallback.key;
  }
  return out;
}

export function comboIndex(colors: Record<string, string>, scheme: SchemeDTO): number {
  const bits = scheme.decorGrid?.bits ?? [];
  return bits.reduce((sum, bit) => sum + (colors[bit.axis] === bit.value ? bit.weight : 0), 0);
}

export type Still = {
  src: string;
  frames: number;
  frame: number;
  note: string | null;
  exact: boolean;
  alt: string;
  /** Set when a Seedream catalog was consulted. Missing files stay on the seed still. */
  origin?: "seedream" | "sample";
};

function decorRules(scheme: SchemeDTO): RenderDTO[] {
  return scheme.renders.filter((render) => render.role === "decor");
}

function structureRules(scheme: SchemeDTO): RenderDTO[] {
  return scheme.renders.filter((render) => render.role === "structure");
}

export function structureStill(scheme: SchemeDTO, selection: SelectionState): Still | null {
  const options = schemeOptions(scheme, selection);
  const render = matchRender(structureRules(scheme), {
    splash: options.splash,
    entry: options.entry,
  });
  if (!render) return null;
  return {
    src: render.src,
    frames: render.frames,
    frame: render.frame,
    note: render.note ?? null,
    exact: true,
    alt: scheme.imageAlt,
  };
}

export function colorGridStill(scheme: SchemeDTO, colors: Record<string, string>, splash: string | undefined): Still | null {
  const render = matchRender(decorRules(scheme), { comboIndex: comboIndex(colors, scheme) });
  if (!render) return null;
  const caveat = scheme.decorCaveat && splash === "curtain" ? scheme.decorCaveat : null;
  return {
    src: render.src,
    frames: render.frames,
    frame: render.frame,
    note: caveat ?? render.note ?? null,
    exact: true,
    alt: scheme.imageAlt,
  };
}

export function presetStill(
  scheme: SchemeDTO,
  preset: DecorPreset,
  preview: Record<string, string>,
  splash: string | undefined,
): Still | null {
  if (scheme.decorMode === "colorGrid") {
    return colorGridStill(scheme, preset.colors, splash);
  }
  const base = matchRender(decorRules(scheme), { preset: preset.key });
  if (!base) return null;
  const overrides = Object.entries(preview).filter(([, from]) => from && from !== preset.key);
  const tile = overrides.find(([category]) => category === "tile");
  if (tile) {
    const swapped = matchRender(decorRules(scheme), { preset: tile[1] });
    if (swapped) {
      return {
        src: swapped.src,
        frames: swapped.frames,
        frame: swapped.frame,
        note: swapped.note ?? null,
        exact: overrides.length === 1,
        alt: `${preset.name} · ${scheme.name}`,
      };
    }
  }
  return {
    src: base.src,
    frames: base.frames,
    frame: base.frame,
    note: base.note ?? null,
    exact: overrides.length === 0,
    alt: `${preset.name} · ${scheme.name}`,
  };
}

export function activeScheme(project: ProjectDTO, selection: SelectionState): SchemeDTO | null {
  if (selection.structureKey && selection.structureKey !== "maybe") {
    return project.schemes.find((scheme) => scheme.key === selection.structureKey) ?? project.schemes[0] ?? null;
  }
  return project.schemes[0] ?? null;
}

export function chosenScheme(project: ProjectDTO, selection: SelectionState): SchemeDTO | null {
  if (!selection.structureKey || selection.structureKey === "maybe") return null;
  return project.schemes.find((scheme) => scheme.key === selection.structureKey) ?? null;
}

export function colorsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function presetByColors(presets: DecorPreset[], colors: Record<string, string>): DecorPreset | null {
  return presets.find((preset) => colorsEqual(preset.colors, colors)) ?? null;
}

export function workingPreset(project: ProjectDTO, selection: SelectionState): DecorPreset | null {
  const presets = project.decor.presets;
  if (presets.length === 0) return null;
  return (
    presetByColors(presets, selection.colors) ??
    presets.find((preset) => preset.key === selection.pendingPreset) ??
    presets.find((preset) => preset.key === selection.decorPreset) ??
    presets[0]
  );
}

export function optionLabel(scheme: SchemeDTO, groupKey: string, optionKey: string | undefined): string | null {
  const group = scheme.optionGroups.find((item) => item.key === groupKey);
  return group?.options.find((option) => option.key === optionKey)?.label ?? null;
}
