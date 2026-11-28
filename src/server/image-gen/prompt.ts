import type { ProjectDTO, SchemeDTO } from "@/lib/types";
import type { GenerateRequest } from "./types";

/**
 * Elements that stay locked to the source photograph when that photograph
 * already shows them. The sentence built from this list must not tell the
 * model to add an element the photo does not contain.
 */
export const STRUCTURAL_LOCKS = [
  "sliding doors",
  "sliding windows",
  "hallway door openings",
  "kitchen door openings",
  "ceiling height",
  "camera viewpoint",
] as const;

export function structuralLockConstraint(locks: readonly string[] = STRUCTURAL_LOCKS): string {
  const list = locks.join("; ");
  return `Structural locks: if the source photograph shows any of the following, keep that element exactly as photographed — same position and size — and do not move, resize, or replace it: ${list}. These locks apply only when the element is already present. Do not add a sliding door, a sliding window, a hallway door opening, or a kitchen door opening that the photograph does not show.`;
}

/** Always attached. A project-level note does not replace these. */
export const UNIVERSAL_CONSTRAINTS = [
  "Never invent windows, doors, skylights, or other openings that are not visible in the source photograph or listed in the written requirements.",
  "Never move, add, or resize windows. Keep every existing window exactly where it is in the source photograph.",
  "Never add walls, beams, level changes, or rooms that the selected scheme does not call for.",
  "Keep plumbing fixtures in the positions the scheme describes. Do not move them to improve the composition.",
  structuralLockConstraint(),
  "Do not preset whether a scheme includes a television. Add a television only where there is a suitable wall spot with an unobstructed sightline (for example from the tub), never on a window or in a wet spot, and never let it block or replace any window.",
  "Anything the requirements and the selected scheme do not explicitly ask to change keeps the house's structure as it is.",
];

export function constraintsFor(project: ProjectDTO, scheme?: SchemeDTO | null): string[] {
  return [...UNIVERSAL_CONSTRAINTS, ...project.generationConstraints, ...(scheme?.generationConstraints ?? [])];
}

export function buildGenerationRequest(project: ProjectDTO, scheme?: SchemeDTO | null): GenerateRequest {
  const constraints = constraintsFor(project, scheme);
  const lines = [
    `Remodel visualization for “${project.title}”.`,
    `Room: ${project.room.name} (${project.room.kind}).`,
    ...(scheme ? [`Selected scheme: ${scheme.name} (${scheme.key}).`] : []),
    `Source photo (existing condition, do not treat it as the remodel): ${project.room.beforeSrc}`,
    "Requirements:",
    ...(project.requirements.length ? project.requirements.map((item) => `- ${item}`) : ["- (none written yet)"]),
    "Hard constraints:",
    ...constraints.map((item) => `- ${item}`),
    "If a requested feature is not supported by the photo or the requirements, leave it out. This does not forbid a television that satisfies the television rule above.",
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
