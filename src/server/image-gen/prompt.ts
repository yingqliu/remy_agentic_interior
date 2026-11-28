import type { ProjectDTO, SchemeDTO } from "@/lib/types";
import type { GenerateRequest } from "./types";

/** Always attached. A project-level note does not replace these. */
export const UNIVERSAL_CONSTRAINTS = [
  "Never invent windows, doors, skylights, or other openings that are not visible in the source photograph or listed in the written requirements.",
  "Never add walls, beams, level changes, or rooms that the selected scheme does not call for.",
  "Keep plumbing fixtures in the positions the scheme describes. Do not move them to improve the composition.",
];

/** One request per scheme, or a single room-level request when none exist yet. */
export function buildGenerationRequests(project: ProjectDTO): GenerateRequest[] {
  if (project.schemes.length === 0) return [buildGenerationRequest(project, null)];
  return project.schemes.map((scheme) => buildGenerationRequest(project, scheme));
}

export function buildGenerationRequest(project: ProjectDTO, scheme?: SchemeDTO | null): GenerateRequest {
  const selected = scheme ?? null;
  const constraints = [...UNIVERSAL_CONSTRAINTS, ...project.generationConstraints];
  const lines = [
    `Remodel visualization for “${project.title}”.`,
    `Room: ${project.room.name} (${project.room.kind}).`,
    `Existing condition: ${project.room.beforeCaption}. ${project.room.beforeAlt}`,
    `Source photo (existing condition, do not treat it as the remodel): ${project.room.beforeSrc}`,
    ...schemeLines(selected),
    "Requirements:",
    ...(project.requirements.length ? project.requirements.map((item) => `- ${item}`) : ["- (none written yet)"]),
    "Hard constraints:",
    ...constraints.map((item) => `- ${item}`),
    "If a requested feature is not supported by the photo or the requirements, leave it out.",
  ];
  return {
    projectTitle: project.title,
    roomKind: project.room.kind,
    roomName: project.room.name,
    sourcePhoto: project.room.beforeSrc,
    requirements: project.requirements,
    constraints,
    schemeKey: selected?.key ?? null,
    schemeName: selected?.name ?? null,
    prompt: lines.join("\n"),
  };
}

function schemeLines(scheme: SchemeDTO | null): string[] {
  if (!scheme) {
    return [
      "Scheme: none written yet.",
      "Do not invent a layout, openings, or fixtures beyond the written requirements and the source photo.",
    ];
  }
  const lines = [`Scheme: ${scheme.name}${scheme.nameEn ? ` (${scheme.nameEn})` : ""}.`];
  if (scheme.summary) lines.push(`Scheme summary: ${scheme.summary}`);
  for (const line of scheme.summaryLines ?? []) lines.push(`Scheme note: ${line}`);
  if (scheme.imageAlt) lines.push(`Scheme description: ${scheme.imageAlt}`);
  const comparisons = schemeComparisonLines(scheme);
  if (comparisons.length) {
    lines.push("Scheme comparison:");
    lines.push(...comparisons);
  }
  lines.push("Render this scheme only. Do not depict a different layout.");
  return lines;
}

function schemeComparisonLines(scheme: SchemeDTO): string[] {
  const lines: string[] = [];
  for (const row of scheme.compareRows) {
    const base = row.variants.find((variant) => !variant.when || Object.keys(variant.when).length === 0);
    const text = base?.text ?? row.variants[0]?.text;
    if (text) lines.push(`- ${row.label}: ${text}`);
  }
  return lines;
}
