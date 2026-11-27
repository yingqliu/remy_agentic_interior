import { z } from "zod";

const dimensionValue = z.object({
  text: z.string().max(400),
  source: z.enum(["plan", "example", "user", ""]),
});

export const selectionSchema = z.object({
  dimensionMode: z.enum(["upload", "manual"]),
  dimensions: z.record(z.string(), dimensionValue),
  structureKey: z.string().max(80).nullable(),
  schemeOptions: z.record(z.string(), z.record(z.string(), z.string())),
  decorPreset: z.string().max(80).nullable(),
  pendingPreset: z.string().max(80).nullable(),
  colors: z.record(z.string(), z.string()),
  committedColors: z.record(z.string(), z.string()).nullable(),
  decisions: z.record(z.string(), z.literal("selected")),
  preview: z.record(z.string(), z.string()),
  fixtureSwatch: z.string().max(80).nullable(),
  committedFixture: z.string().max(80).nullable(),
  committedTile: z.string().max(80).nullable(),
});
