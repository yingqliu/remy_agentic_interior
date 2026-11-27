import type { GenerationDTO } from "./types";

/** Newest ready image for one scheme. Generations are ordered newest first. */
export function readyImageForScheme(generations: GenerationDTO[], schemeKey: string): string | null {
  const match = generations.find((item) => item.schemeKey === schemeKey && item.status === "ready" && item.imageSrc);
  return match?.imageSrc ?? null;
}

/** Newest ready image that is not tied to a scheme (room-level or older rows). */
export function readyImageWithoutScheme(generations: GenerationDTO[]): string | null {
  const match = generations.find((item) => !item.schemeKey && item.status === "ready" && item.imageSrc);
  return match?.imageSrc ?? null;
}
