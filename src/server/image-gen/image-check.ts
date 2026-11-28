/** Short side below this fails the cheap size check. 2K at 3:2 is 2496×1664. */
export const MIN_SHORT_SIDE = 1000;
/** Landscape 3:2. Seedream’s 2K tier maps this ratio to 2496×1664. */
export const ASPECT_TARGET = 3 / 2;
export const ASPECT_TOLERANCE = 0.12;

export type ImageAssessment = {
  ok: boolean;
  reason?: string;
  width?: number;
  height?: number;
};

/**
 * Later quality judge. Cheap checks (empty output, dimensions, aspect, size) run first.
 * The default accepts anything that already passed those checks.
 */
export type QualityJudge = (input: {
  stage: "structure" | "finish";
  schemeKey: string;
  presetKey?: string;
  bytes: Buffer;
  width: number;
  height: number;
}) => ImageAssessment | Promise<ImageAssessment>;

export const passthroughQualityJudge: QualityJudge = () => ({ ok: true });

export function assessImageBytes(bytes: Buffer): ImageAssessment {
  if (!bytes || bytes.length < 24) return { ok: false, reason: "empty or invalid output" };
  const size = jpegSize(bytes) ?? pngSize(bytes);
  if (!size) return { ok: false, reason: "invalid output" };
  const { width, height } = size;
  const shortSide = Math.min(width, height);
  if (shortSide < MIN_SHORT_SIDE) return { ok: false, reason: `too small (${width}x${height})`, width, height };
  const aspect = width / height;
  if (Math.abs(aspect - ASPECT_TARGET) / ASPECT_TARGET > ASPECT_TOLERANCE) {
    return { ok: false, reason: `wrong aspect ratio ${aspect.toFixed(3)}`, width, height };
  }
  return { ok: true, width, height };
}

function pngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3 && offset + 9 <= bytes.length) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}
