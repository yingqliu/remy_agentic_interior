import type { DecorPreset } from "@/lib/types";

const FIXTURE: Record<string, string> = {
  nickel: "brushed nickel shower fixtures",
  black: "matte black shower fixtures",
};

const WALL: Record<string, string> = {
  ivory: "ivory stone-look wall tile",
  ink: "ink-gray stone wall tile",
};

const VANITY: Record<string, string> = {
  white: "a white painted vanity",
  wood: "a dark wood vanity",
};

const FLOOR: Record<string, string> = {
  oak: "warm oak floor planks",
  stone: "dark gray stone floor tile",
};

function phrase(table: Record<string, string>, key: string | undefined): string {
  if (!key) return "the existing finish";
  return table[key] ?? key;
}

/** Concrete finish line for one of the three seeded presets. */
export function presetFinishLine(preset: DecorPreset): string {
  const colors = preset.colors;
  const finishes = [
    phrase(FIXTURE, colors.fixture),
    phrase(WALL, colors.wall),
    phrase(VANITY, colors.vanity),
    phrase(FLOOR, colors.floor),
  ].join(", ");
  return `Finish variant ${preset.name} (${preset.key}) only. Change the finishes to ${finishes}. Do not change the structure, layout, windows, openings, ceiling, or camera viewpoint. Do not add or move windows.`;
}
