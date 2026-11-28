export const STRUCTURE_ATTEMPT_CAP = 2;
export const FINISH_PRESET_KEYS = ["mist", "wood", "ink"] as const;

export type GenerationAttempt = {
  stage?: string | null;
  schemeKey?: string | null;
  presetKey?: string | null;
  status?: string | null;
};

export function structureAttemptCount(rows: GenerationAttempt[], schemeKey: string): number {
  return rows.filter((row) => row.stage === "structure" && row.schemeKey === schemeKey).length;
}

export function finishesAlreadyReady(rows: GenerationAttempt[], schemeKey: string): boolean {
  return FINISH_PRESET_KEYS.every((presetKey) =>
    rows.some((row) => row.stage === "finish" && row.schemeKey === schemeKey && row.presetKey === presetKey && row.status === "ready"),
  );
}
