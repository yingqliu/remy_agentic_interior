import type { ProjectDTO } from "@/lib/types";
import type { GenerateRequest } from "./types";

/** Always attached. A project-level note does not replace these. */
export const UNIVERSAL_CONSTRAINTS = [
  "Never invent windows, doors, skylights, or other openings that are not visible in the source photograph or listed in the written requirements.",
  "Never add walls, beams, level changes, or rooms that the selected scheme does not call for.",
  "Keep plumbing fixtures in the positions the scheme describes. Do not move them to improve the composition.",
];

export function buildGenerationRequest(project: ProjectDTO): GenerateRequest {
  const constraints = [...UNIVERSAL_CONSTRAINTS, ...project.generationConstraints];
  const lines = [
    `Remodel visualization for “${project.title}”.`,
    `Room: ${project.room.name} (${project.room.kind}).`,
    `Source photo (existing condition, do not treat it as the remodel): ${project.room.beforeSrc}`,
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
    prompt: lines.join("\n"),
  };
}
