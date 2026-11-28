export type Locale = "zh" | "en";

export type Fact = { label: string; value: string };

export type RenderWhen = {
  splash?: string;
  entry?: string;
  preset?: string;
  comboIndex?: number;
};

export type RenderDTO = {
  role: "structure" | "decor";
  src: string;
  frames: number;
  frame: number;
  when: RenderWhen;
  note?: string | null;
};

export type OptionDTO = {
  key: string;
  label: string;
  labelEn?: string | null;
  detail?: string | null;
  isDefault: boolean;
  costBand?: string | null;
  timelineBand?: string | null;
  significant: boolean;
  sortOrder: number;
};

export type OptionGroupDTO = {
  key: string;
  label: string;
  labelEn?: string | null;
  phase: "structure" | "decor";
  sortOrder: number;
  unavailableReason?: string | null;
  options: OptionDTO[];
};

export type HotspotDTO = {
  key: string;
  x: number;
  y: number;
  category: string;
  title?: string;
  titles?: Record<string, string>;
  idea: string;
  previewIdea?: string;
  structure: string;
  permit: string;
  costBand?: string | null;
  timelineBand?: string | null;
  significant?: boolean;
  swatches?: "presets" | "fixture" | null;
};

export type CompareVariant = {
  when?: Record<string, string>;
  text: string;
};

export type CompareRow = {
  label: string;
  variants: CompareVariant[];
};

export type PlanShape =
  | {
      type: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: "room" | "wet" | "fixture" | "accent" | "base" | "none";
      dashed?: boolean;
      rx?: number;
    }
  | {
      type: "text";
      x: number;
      y: number;
      text: string;
      size?: number;
      anchor?: "start" | "middle" | "end";
      fill?: "ink" | "muted" | "onAccent";
      rotate?: number;
    }
  | {
      type: "line";
      x: number;
      y: number;
      x2: number;
      y2: number;
    };

export type PlanCamera = { x: number; y: number; angle: number };

export type PlanDTO = {
  viewBox: string;
  note?: string;
  camera?: PlanCamera;
  interactive?: boolean;
  shapes: PlanShape[];
};

export type ColorBit = { axis: string; value: string; weight: number };

export type DecorGrid = {
  bits: ColorBit[];
  framesPerSprite: number;
};

export type SchemeDTO = {
  key: string;
  name: string;
  nameEn?: string | null;
  sortOrder: number;
  summary?: string | null;
  summaryLines?: string[];
  imageAlt: string;
  decorMode: "preset" | "colorGrid";
  decorCaveat?: string | null;
  decorGrid?: DecorGrid | null;
  plan?: PlanDTO | null;
  hotspots: HotspotDTO[];
  compareRows: CompareRow[];
  optionGroups: OptionGroupDTO[];
  renders: RenderDTO[];
  /** Appended to the image prompt only when this scheme is selected. */
  generationConstraints: string[];
};

export type DecorChoice = { key: string; label: string; color: string };

export type DecorAxis = {
  key: string;
  label: string;
  summaryLabel: string;
  choices: DecorChoice[];
};

export type DecorPreset = {
  key: string;
  name: string;
  nameEn?: string | null;
  swatch: { label: string; color: string };
  colors: Record<string, string>;
  /** Shown on the fixture hotspot before the client touches a swatch. Ink stays empty: the pictured finish is brass, which is not one of the two swatches. */
  fixtureSwatchDefault?: string | null;
  costBand?: string | null;
  timelineBand?: string | null;
  significant?: boolean;
};

export type DecorCompareRow = {
  label: string;
  byPreset: Record<string, string>;
};

export type DecorDTO = {
  presets: DecorPreset[];
  axes: DecorAxis[];
  compareRows: DecorCompareRow[];
  limitedNote?: string | null;
};

export type DimensionField = {
  id: string;
  label: string;
  example: string;
  initialText: string;
  initialSource: "" | "plan" | "example" | "user";
};

export type RoomDTO = {
  kind: string;
  name: string;
  beforeSrc: string;
  beforeAlt: string;
  beforeCaption: string;
  plan: PlanDTO;
  dimensions: DimensionField[];
};

export type GenerationDTO = {
  id: string;
  provider: string;
  status: string;
  prompt: string;
  message: string | null;
  imageSrc: string | null;
  createdAt: string;
  stage?: string | null;
  schemeKey?: string | null;
  presetKey?: string | null;
  attempt?: number | null;
  accepted?: boolean | null;
};

/** Generated Seedream files found on disk. Keys are scheme keys; finish values are preset keys. */
export type SeedreamCatalog = {
  structure: string[];
  finish: Record<string, string[]>;
};

export type ProjectDTO = {
  id: string;
  slug: string;
  shareToken: string;
  locale: Locale;
  title: string;
  summary: string;
  property: Fact[];
  household: Fact[];
  requirements: string[];
  principles: Fact[];
  openItems: string[];
  generationConstraints: string[];
  room: RoomDTO;
  schemes: SchemeDTO[];
  decor: DecorDTO;
  generations: GenerationDTO[];
  seedream?: SeedreamCatalog | null;
};

export type DimensionValue = {
  text: string;
  source: "" | "plan" | "example" | "user";
};

export type SelectionState = {
  dimensionMode: "upload" | "manual";
  dimensions: Record<string, DimensionValue>;
  structureKey: string | null;
  schemeOptions: Record<string, Record<string, string>>;
  decorPreset: string | null;
  pendingPreset: string | null;
  colors: Record<string, string>;
  committedColors: Record<string, string> | null;
  decisions: Record<string, "selected">;
  preview: Record<string, string>;
  fixtureSwatch: string | null;
  committedFixture: string | null;
  committedTile: string | null;
};
