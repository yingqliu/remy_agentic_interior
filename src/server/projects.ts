import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import type {
  CompareRow,
  DecorAxis,
  DecorCompareRow,
  DecorGrid,
  DecorPreset,
  DimensionField,
  Fact,
  GenerationDTO,
  HotspotDTO,
  Locale,
  PlanDTO,
  ProjectDTO,
  RenderDTO,
  RoomDTO,
  SchemeDTO,
  SelectionState,
} from "@/lib/types";
import { defaultSelection } from "@/lib/selection";
import { selectionSchema } from "@/lib/selection-schema";
import { prisma } from "./db";

const projectInclude = {
  rooms: { orderBy: { sortOrder: "asc" as const } },
  schemes: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      optionGroups: {
        orderBy: { sortOrder: "asc" as const },
        include: { options: { orderBy: { sortOrder: "asc" as const } } },
      },
      renders: { orderBy: { sortOrder: "asc" as const } },
    },
  },
  decorSet: true,
  selection: true,
  generations: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ProjectInclude;

type ProjectRecord = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

function asArray<T>(value: Prisma.JsonValue, map: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(map).filter((item): item is T => item != null);
}

function asFact(item: unknown): Fact | null {
  if (!item || typeof item !== "object") return null;
  const row = item as { label?: unknown; value?: unknown };
  if (typeof row.label !== "string" || typeof row.value !== "string") return null;
  return { label: row.label, value: row.value };
}

function asString(item: unknown): string | null {
  return typeof item === "string" ? item : null;
}

function readSelection(project: ProjectDTO, raw: Prisma.JsonValue | undefined): SelectionState {
  const parsed = selectionSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultSelection(project);
}

function toProject(record: ProjectRecord): ProjectDTO | null {
  const roomRow = record.rooms[0];
  if (!roomRow) return null;
  const decor = record.decorSet;
  const room: RoomDTO = {
    kind: roomRow.kind,
    name: roomRow.name,
    beforeSrc: roomRow.beforeSrc,
    beforeAlt: roomRow.beforeAlt,
    beforeCaption: roomRow.beforeCaption,
    plan: (roomRow.plan ?? { viewBox: "0 0 200 300", shapes: [] }) as PlanDTO,
    dimensions: asArray(roomRow.dimensions, (item) => {
      if (!item || typeof item !== "object") return null;
      const field = item as DimensionField;
      if (typeof field.id !== "string" || typeof field.label !== "string") return null;
      return {
        id: field.id,
        label: field.label,
        example: field.example ?? "",
        initialText: field.initialText ?? "",
        initialSource: field.initialSource ?? "",
      };
    }),
  };
  const schemes: SchemeDTO[] = record.schemes.map((scheme) => ({
    key: scheme.key,
    name: scheme.name,
    nameEn: scheme.nameEn,
    sortOrder: scheme.sortOrder,
    summary: scheme.summary,
    summaryLines: asArray(scheme.summaryLines, asString),
    imageAlt: scheme.imageAlt,
    decorMode: scheme.decorMode === "colorGrid" ? "colorGrid" : "preset",
    decorCaveat: scheme.decorCaveat,
    decorGrid: (scheme.decorGrid as DecorGrid | null) ?? null,
    plan: (scheme.plan as PlanDTO | null) ?? null,
    hotspots: (scheme.hotspots as HotspotDTO[]) ?? [],
    compareRows: (scheme.compareRows as CompareRow[]) ?? [],
    generationConstraints: asArray(scheme.generationConstraints, asString),
    optionGroups: scheme.optionGroups.map((group) => ({
      key: group.key,
      label: group.label,
      labelEn: group.labelEn,
      phase: group.phase === "decor" ? "decor" : "structure",
      sortOrder: group.sortOrder,
      unavailableReason: group.unavailableReason,
      options: group.options.map((option) => ({
        key: option.key,
        label: option.label,
        labelEn: option.labelEn,
        detail: option.detail,
        isDefault: option.isDefault,
        costBand: option.costBand,
        timelineBand: option.timelineBand,
        significant: option.significant,
        sortOrder: option.sortOrder,
      })),
    })),
    renders: scheme.renders.map((render) => ({
      role: render.role === "decor" ? "decor" : "structure",
      src: render.src,
      frames: render.frames,
      frame: render.frame,
      when: (render.when as RenderDTO["when"]) ?? {},
      note: render.note,
    })),
  }));
  const generations: GenerationDTO[] = record.generations.map((row) => {
    const result = (row.result ?? {}) as { message?: string; imageSrc?: string | null };
    return {
      id: row.id,
      provider: row.provider,
      status: row.status,
      prompt: row.prompt,
      message: result.message ?? null,
      imageSrc: result.imageSrc ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  });
  const base: ProjectDTO = {
    id: record.id,
    slug: record.slug,
    shareToken: record.shareToken,
    locale: record.locale === "en" ? "en" : "zh",
    title: record.title,
    summary: record.summary,
    property: asArray(record.property, asFact),
    household: asArray(record.household, asFact),
    requirements: asArray(record.requirements, asString),
    principles: asArray(record.principles, asFact),
    openItems: asArray(record.openItems, asString),
    generationConstraints: asArray(record.generationConstraints, asString),
    room,
    schemes,
    decor: {
      presets: ((decor?.presets as DecorPreset[]) ?? []),
      axes: ((decor?.axes as DecorAxis[]) ?? []),
      compareRows: ((decor?.compareRows as DecorCompareRow[]) ?? []),
      limitedNote: decor?.limitedNote ?? null,
    },
    generations,
  };
  return base;
}

export type ProjectView = ProjectDTO & { selection: SelectionState };

function withSelection(record: ProjectRecord): ProjectView | null {
  const project = toProject(record);
  if (!project) return null;
  return { ...project, selection: readSelection(project, record.selection?.state) };
}

export async function listProjects(): Promise<{ slug: string; title: string; summary: string; shareToken: string; roomKind: string }[]> {
  const rows = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    include: { rooms: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    shareToken: row.shareToken,
    roomKind: row.rooms[0]?.kind ?? "room",
  }));
}

export async function getProjectBySlug(slug: string): Promise<ProjectView | null> {
  const record = await prisma.project.findUnique({ where: { slug }, include: projectInclude });
  return record ? withSelection(record) : null;
}

export async function getProjectByToken(token: string): Promise<ProjectView | null> {
  const record = await prisma.project.findUnique({ where: { shareToken: token }, include: projectInclude });
  return record ? withSelection(record) : null;
}

export async function saveSelection(token: string, state: SelectionState): Promise<{ updatedAt: string } | null> {
  const project = await prisma.project.findUnique({ where: { shareToken: token }, select: { id: true } });
  if (!project) return null;
  const row = await prisma.selection.upsert({
    where: { projectId: project.id },
    create: { projectId: project.id, state },
    update: { state },
  });
  return { updatedAt: row.updatedAt.toISOString() };
}

const KIND_LABEL: Record<string, string> = {
  bathroom: "卫生间",
  kitchen: "厨房",
  living: "客厅",
  bedroom: "卧室",
  other: "其他",
};

export type CreateProjectInput = {
  title: string;
  clientName: string;
  roomKind: string;
  roomName: string;
  requirements: string[];
  photo: { bytes: Buffer; ext: string };
};

export async function createProject(input: CreateProjectInput): Promise<{ slug: string }> {
  const id = randomBytes(8).toString("hex");
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${id}${input.photo.ext}`), input.photo.bytes);
  const slug = uniqueSlug(input.title);
  const shareToken = randomBytes(9).toString("base64url");
  const kind = KIND_LABEL[input.roomKind] ? input.roomKind : "other";
  const dimensions: DimensionField[] = [
    ["roomL", "房间长", ""],
    ["roomW", "房间宽", ""],
    ["ceiling", "层高", ""],
    ["openings", "门窗位置（只记照片里有的）", ""],
    ["fixtures", "现有洁具位置", ""],
    ["plumbing", "给排水位置", ""],
    ["walls", "可否改动的墙", ""],
  ].map(([fieldId, label]) => ({
    id: fieldId,
    label,
    example: "",
    initialText: "",
    initialSource: "" as const,
  }));
  const plan: PlanDTO = {
    viewBox: "0 0 200 300",
    interactive: true,
    camera: { x: 50, y: 78, angle: -90 },
    note: "示意平面，待实测后替换。不会根据尺寸重绘，也不会凭空添加照片里没有的窗。",
    shapes: [
      { type: "text", x: 100, y: 16, text: "待测绘", size: 8, anchor: "middle", fill: "muted" },
      { type: "rect", x: 40, y: 36, w: 120, h: 200, fill: "room" },
      { type: "rect", x: 70, y: 230, w: 50, h: 6, fill: "base" },
      { type: "text", x: 95, y: 252, text: "入口", size: 7, anchor: "middle", fill: "muted" },
    ],
  };
  await prisma.project.create({
    data: {
      slug,
      shareToken,
      locale: "zh",
      title: input.title.trim(),
      summary: "新建项目。方案还没有生成。",
      property: [{ label: "类型", value: KIND_LABEL[kind] ?? KIND_LABEL.other }],
      household: [{ label: "客户", value: input.clientName.trim() || "未填写" }],
      requirements: input.requirements,
      principles: [
        {
          label: "生成约束",
          value: "效果图不得添加原照片或需求中没有的窗、门、天窗或其他结构洞口。",
        },
      ],
      openItems: ["待补充实测尺寸", "待生成结构方案与饰面方案"],
      generationConstraints: [
        "不得添加现状照片或需求里没有的窗、门、天窗或结构洞口。",
        "不得为了构图移动已有洁具。位置以选定方案为准。",
        "不得添加方案里没有的墙体、夹层或室外景色。",
      ],
      rooms: {
        create: {
          kind,
          name: input.roomName.trim() || KIND_LABEL[kind],
          beforeSrc: `/uploads/${id}${input.photo.ext}`,
          beforeAlt: `${input.title} 的现状照片`,
          beforeCaption: "现状（改造前）",
          plan,
          dimensions,
          sortOrder: 0,
        },
      },
      decorSet: {
        create: {
          presets: [],
          axes: [],
          compareRows: [],
          limitedNote: null,
        },
      },
    },
  });
  return { slug };
}

function uniqueSlug(title: string): string {
  const ascii = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  const stem = ascii || "project";
  return `${stem}-${randomBytes(3).toString("hex")}`;
}

export async function recordGeneration(slug: string, result: { provider: string; status: string; prompt: string; message: string; imageSrc: string | null }) {
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) return null;
  return prisma.generation.create({
    data: {
      projectId: project.id,
      provider: result.provider,
      status: result.status,
      prompt: result.prompt,
      result: { message: result.message, imageSrc: result.imageSrc },
    },
  });
}

export function isDatabaseError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Error && /SQLITE|does not exist|ENOENT|database/i.test(error.message))
  );
}

export type { Locale };
