import { buildFanProject } from "../prisma/fan-data";
import {
  STRUCTURAL_LOCKS,
  UNIVERSAL_CONSTRAINTS,
  buildGenerationRequest,
  structuralLockConstraint,
} from "../src/server/image-gen/prompt";

const project = buildFanProject();

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function scheme(key: string) {
  const found = project.schemes.find((item) => item.key === key);
  if (!found) throw new Error(`missing scheme ${key}`);
  return found;
}

const promptFor = (key: string) => buildGenerationRequest(project, scheme(key)).prompt;

expect(STRUCTURAL_LOCKS.length === 6, "six structural locks");
for (const lock of [
  "sliding doors",
  "sliding windows",
  "hallway door openings",
  "kitchen door openings",
  "ceiling height",
  "camera viewpoint",
]) {
  expect(STRUCTURAL_LOCKS.includes(lock as (typeof STRUCTURAL_LOCKS)[number]), `lock list contains ${lock}`);
}

const lockLine = structuralLockConstraint();
expect(lockLine.includes("Do not add a sliding door"), "locks forbid adding a sliding door");
expect(lockLine.includes("hallway door opening"), "locks name hallway openings");
expect(lockLine.includes("kitchen door opening"), "locks name kitchen openings");
expect(lockLine.includes("only when the element is already present"), "locks apply only when present");
expect(!/(?:^|[.]\s*)Add a sliding door/i.test(lockLine), "lock sentence does not request a new sliding door");

for (const line of [
  "Never move, add, or resize windows.",
  "Do not preset whether a scheme includes a television.",
  "never on a window or in a wet spot",
  "never let it block or replace any window",
  "Anything the requirements and the selected scheme do not explicitly ask to change keeps the house's structure as it is.",
]) {
  expect(UNIVERSAL_CONSTRAINTS.some((item) => item.includes(line)), `universal constraint includes: ${line}`);
}

const keys = ["open", "wetroom", "alcove", "panel"] as const;
for (const key of keys) {
  const prompt = promptFor(key);
  expect(prompt.includes("Hard constraints:"), `${key} has a hard-constraint section`);
  expect(prompt.includes(`Selected scheme:`), `${key} names the selected scheme`);
  expect(prompt.includes(scheme(key).name), `${key} names ${scheme(key).name}`);
  for (const line of UNIVERSAL_CONSTRAINTS) {
    expect(prompt.includes(line), `${key} includes universal constraint`);
  }
  expect(prompt.includes("70 inches wide"), `${key} states the 70-inch back wall`);
  expect(prompt.includes("high on the right side of the back wall"), `${key} keeps the window on the right`);
  expect(prompt.includes("All dimensions in this project are inches."), `${key} states inches`);
  expect(prompt.includes("standard 60-inch tub"), `${key} states the 60-inch tub`);
  expect(prompt.includes("shows no sliding door"), `${key} does not invent a sliding door for this bathroom`);
  expect(!prompt.includes("嵌入式"), `${key} does not preset a wall television`);
  expect(!/must include a television|add a wall television|require a television/i.test(prompt), `${key} does not require a television`);
}

const alcove = promptFor("alcove");
expect(alcove.includes("stub wall is on the LEFT"), "alcove stub wall is on the left");
expect(alcove.includes("about 10 inches thick/wide"), "alcove stub is about 10 inches");
expect(alcove.includes("leaving exactly the 60-inch tub alcove"), "alcove leaves a 60-inch tub alcove");

const panel = promptFor("panel");
expect(panel.includes("do not add a stub wall"), "panel has no stub wall");
expect(panel.includes("level with the tub rim"), "panel fills the rest with a tub-rim ledge");
expect(!panel.includes("stub wall is on the LEFT"), "panel prompt does not ask for the alcove stub wall");

const open = promptFor("open");
expect(open.includes("reference position for that window"), "方案一 is the window reference");
expect(!open.includes("stub wall is on the LEFT"), "方案一 does not ask for the alcove stub wall");

const projectOnly = buildGenerationRequest(project).prompt;
expect(!projectOnly.includes("Selected scheme:"), "project-level prompt does not pretend a scheme was selected");
expect(!projectOnly.includes("stub wall is on the LEFT"), "project-level prompt does not apply the alcove stub wall");
expect(projectOnly.includes(lockLine), "project-level prompt still includes structural locks");

console.log("prompt checks ok");
