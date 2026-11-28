import { Prisma } from "@prisma/client";
import { defaultSelection } from "../src/lib/selection";
import type { SchemeDTO } from "../src/lib/types";
import { prisma } from "../src/server/db";
import { buildFanProject, FAN_SLUG } from "./fan-data";

function schemeCreate(scheme: SchemeDTO): Prisma.SchemeCreateWithoutProjectInput {
  return {
    key: scheme.key,
    name: scheme.name,
    nameEn: scheme.nameEn ?? null,
    sortOrder: scheme.sortOrder,
    summary: scheme.summary ?? null,
    summaryLines: scheme.summaryLines ?? [],
    imageAlt: scheme.imageAlt,
    decorMode: scheme.decorMode,
    decorCaveat: scheme.decorCaveat ?? null,
    decorGrid: scheme.decorGrid ?? Prisma.JsonNull,
    plan: scheme.plan ?? Prisma.JsonNull,
    hotspots: scheme.hotspots,
    compareRows: scheme.compareRows,
    generationConstraints: scheme.generationConstraints,
    optionGroups: {
      create: scheme.optionGroups.map((group) => ({
        key: group.key,
        label: group.label,
        labelEn: group.labelEn ?? null,
        phase: group.phase,
        sortOrder: group.sortOrder,
        unavailableReason: group.unavailableReason ?? null,
        options: {
          create: group.options.map((option) => ({
            key: option.key,
            label: option.label,
            labelEn: option.labelEn ?? null,
            detail: option.detail ?? null,
            isDefault: option.isDefault,
            costBand: option.costBand ?? null,
            timelineBand: option.timelineBand ?? null,
            significant: option.significant,
            sortOrder: option.sortOrder,
          })),
        },
      })),
    },
    renders: {
      create: scheme.renders.map((render, index) => ({
        role: render.role,
        src: render.src,
        frames: render.frames,
        frame: render.frame,
        when: render.when,
        note: render.note ?? null,
        sortOrder: index,
      })),
    },
  };
}

async function main() {
  const project = buildFanProject();
  await prisma.project.deleteMany({ where: { slug: FAN_SLUG } });
  await prisma.project.create({
    data: {
      slug: project.slug,
      shareToken: project.shareToken,
      locale: project.locale,
      title: project.title,
      summary: project.summary,
      property: project.property,
      household: project.household,
      requirements: project.requirements,
      principles: project.principles,
      openItems: project.openItems,
      generationConstraints: project.generationConstraints,
      rooms: {
        create: {
          kind: project.room.kind,
          name: project.room.name,
          beforeSrc: project.room.beforeSrc,
          beforeAlt: project.room.beforeAlt,
          beforeCaption: project.room.beforeCaption,
          plan: project.room.plan,
          dimensions: project.room.dimensions,
          sortOrder: 0,
        },
      },
      schemes: { create: project.schemes.map(schemeCreate) },
      decorSet: {
        create: {
          presets: project.decor.presets,
          axes: project.decor.axes,
          compareRows: project.decor.compareRows,
          limitedNote: project.decor.limitedNote ?? null,
        },
      },
      selection: { create: { state: defaultSelection(project) } },
    },
  });
  console.log(`Seeded /projects/${project.slug}`);
  console.log(`Client link /c/${project.shareToken}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
