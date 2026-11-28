import type {
  CompareRow,
  DecorPreset,
  DimensionField,
  HotspotDTO,
  OptionDTO,
  OptionGroupDTO,
  PlanDTO,
  ProjectDTO,
  RenderDTO,
  SchemeDTO,
} from "../src/lib/types";

const file = (name: string) => `/seed/fan/${name}`;
const CURB_NOTE = "示意图门槛可能偏厚，施工按矮坝做";

function option(
  key: string,
  label: string,
  sortOrder: number,
  extra: Partial<OptionDTO> = {},
): OptionDTO {
  return { key, label, sortOrder, isDefault: false, significant: false, ...extra };
}

function splashGroup(): OptionGroupDTO {
  return {
    key: "splash",
    label: "挡水",
    phase: "structure",
    sortOrder: 0,
    options: [
      option("glass", "固定玻璃", 0, { isDefault: true }),
      option("curtain", "浴帘", 1),
    ],
  };
}

function entryGroup(unavailableReason?: string): OptionGroupDTO {
  return {
    key: "entry",
    label: "入口",
    phase: "structure",
    sortOrder: 1,
    unavailableReason: unavailableReason ?? null,
    options: [
      option("curbless", "平地+线性地漏", 0, {
        isDefault: true,
        detail: "平地：湿区与干区齐平略低，坡向线性地漏",
      }),
      option("curb", "矮门槛", 1, {
        detail: "矮门槛：入口矮坝挡水，内侧地面低于门槛顶",
      }),
    ],
  };
}

const ENTRY_NA = "这案是站在浴缸里淋浴，缸沿本身就是挡水，不另做平地入口或矮门槛";

function text(label: string, body: string): CompareRow {
  return { label, variants: [{ text: body }] };
}

function alts(label: string, variants: CompareRow["variants"]): CompareRow {
  return { label, variants };
}

const tile = (x: number, y: number): HotspotDTO => ({
  key: "tile",
  x,
  y,
  category: "tile",
  swatches: "presets",
  titles: { mist: "象牙石纹砖", wood: "暖米色墙砖", ink: "墨岩墙砖" },
  idea: "湿区墙面是进门最大的材质印象，要耐湿、好清。",
  previewIdea: "先把这款墙砖定下来，看它在本方案里是否合适。",
  structure: "湿区贴砖要配套防水；若改砖通常要先拆旧。",
  permit: "大面积改砖、重做防水可能要报，需与市府确认。",
  costBand: "$$",
  timelineBand: "较慢",
  significant: true,
});

const PRESETS: DecorPreset[] = [
  {
    key: "mist",
    name: "云石·柔光",
    nameEn: "Mist stone",
    swatch: { label: "象牙", color: "#e8e2d6" },
    colors: { fixture: "nickel", wall: "ivory", vanity: "white", floor: "oak" },
    fixtureSwatchDefault: "nickel",
    costBand: "$$",
    timelineBand: "较短",
    significant: true,
  },
  {
    key: "wood",
    name: "暖木·汤屋",
    nameEn: "Warm wood",
    swatch: { label: "暖米", color: "#d4c3a8" },
    colors: { fixture: "black", wall: "ivory", vanity: "wood", floor: "oak" },
    fixtureSwatchDefault: "black",
    costBand: "$$$",
    timelineBand: "中等",
    significant: true,
  },
  {
    key: "ink",
    name: "墨岩·黄铜",
    nameEn: "Ink and brass",
    swatch: { label: "墨灰", color: "#3a3d42" },
    colors: { fixture: "black", wall: "ink", vanity: "wood", floor: "stone" },
    fixtureSwatchDefault: null,
    costBand: "$$$$",
    timelineBand: "较长",
    significant: true,
  },
];

function decorPresets(files: Record<string, string>): RenderDTO[] {
  return PRESETS.map((preset) => ({
    role: "decor" as const,
    src: file(files[preset.key]),
    frames: 1,
    frame: 0,
    when: { preset: preset.key },
  }));
}

function splashEntryStills(srcFor: (splash: "glass" | "curtain") => { src: string; frames: number; frame: number }, curbNote: boolean): RenderDTO[] {
  const rows: RenderDTO[] = [];
  for (const splash of ["glass", "curtain"] as const) {
    for (const entry of ["curbless", "curb"] as const) {
      const visual = srcFor(splash);
      rows.push({
        role: "structure",
        ...visual,
        when: { splash, entry },
        note: curbNote && entry === "curb" ? CURB_NOTE : null,
      });
    }
  }
  return rows;
}

function splashOnlyStills(srcFor: (splash: "glass" | "curtain") => { src: string; frames: number; frame: number }): RenderDTO[] {
  return (["glass", "curtain"] as const).map((splash) => ({
    role: "structure" as const,
    ...srcFor(splash),
    when: { splash },
  }));
}

const GRID_FILES = [
  "fan-decor-combo-mist.jpg",
  "fan-decor-combo-wood.jpg",
  "fan-decor-combo-ink.jpg",
  "fan-decor-wetroom-mist.jpg",
];

function colorGridRenders(): RenderDTO[] {
  const rows: RenderDTO[] = [];
  for (let index = 0; index < 16; index += 1) {
    rows.push({
      role: "decor",
      src: file(GRID_FILES[Math.floor(index / 4)]),
      frames: 4,
      frame: index % 4,
      when: { comboIndex: index },
    });
  }
  return rows;
}

const existingPlan: PlanDTO = {
  viewBox: "0 0 200 300",
  interactive: true,
  camera: { x: 39, y: 76, angle: -90 },
  note: "机位由现状照片推算：门口向后窗/淋浴看。马桶在照片外，位置为示意。仅后墙一扇窗。当面墙按约 5 英尺 6 英寸（略宽于 60 英寸缸，以实测为准）、台盆进深按约 20 英寸估算；房间长 8 英尺为从图面推的示例，不根据尺寸重绘图。",
  shapes: [
    { type: "text", x: 100, y: 14, text: "当面墙约 5'6\"（以实测为准）", size: 8, anchor: "middle", fill: "muted" },
    { type: "rect", x: 40, y: 32, w: 132, h: 192, fill: "room" },
    { type: "rect", x: 40, y: 32, w: 96, h: 72, fill: "wet" },
    { type: "text", x: 88, y: 68, text: "淋浴 4' × 3'", size: 8, anchor: "middle" },
    { type: "rect", x: 136, y: 32, w: 24, h: 36, fill: "fixture" },
    { type: "text", x: 148, y: 52, text: "凳", size: 6, anchor: "middle", fill: "muted" },
    { type: "rect", x: 76, y: 29, w: 60, h: 5, fill: "fixture" },
    { type: "text", x: 106, y: 26, text: "窗 2'6\"（仅此一扇）", size: 6, anchor: "middle", fill: "muted" },
    { type: "rect", x: 132, y: 104, w: 40, h: 108, fill: "fixture" },
    { type: "text", x: 152, y: 150, text: "台盆", size: 7, anchor: "middle" },
    { type: "text", x: 152, y: 162, text: "进深 20\"", size: 6, anchor: "middle", fill: "muted" },
    { type: "text", x: 152, y: 174, text: "长约 4'6\"", size: 6, anchor: "middle", fill: "muted" },
    { type: "rect", x: 44, y: 168, w: 36, h: 48, fill: "fixture", dashed: true },
    { type: "text", x: 62, y: 188, text: "马桶", size: 6, anchor: "middle" },
    { type: "text", x: 62, y: 198, text: "照片未收入", size: 5, anchor: "middle", fill: "muted" },
    { type: "text", x: 62, y: 207, text: "·示意", size: 5, anchor: "middle", fill: "muted" },
    { type: "rect", x: 48, y: 222, w: 60, h: 5, fill: "base" },
    { type: "text", x: 78, y: 240, text: "门 2'6\"", size: 7, anchor: "middle", fill: "muted" },
    { type: "text", x: 32, y: 128, text: "8'0\"", size: 7, anchor: "end", fill: "muted", rotate: -90 },
  ],
};

const dimensions: DimensionField[] = [
  ["roomL", "房间长（门口到后墙）", "8'0\""],
  ["roomW", "房间宽（照片正对的后墙）", "5'6\"（略宽于 60 英寸缸，以实测为准）"],
  ["ceiling", "层高", "8'0\""],
  ["door", "门位置与宽度", "近处前门，宽 2'6\"（照片左侧可见门扇）"],
  ["window", "窗位置、宽度、窗台高", "仅后墙一扇，宽约 2'6\"，窗台高约 4'6\""],
  ["shower", "现有淋浴位置与尺寸", "后部约 4'0\" × 3'0\"，右侧有坐凳"],
  ["tub", "现有浴缸位置与尺寸", "无"],
  ["toilet", "现有马桶位置与尺寸", "近门口左侧，约 1'8\" × 2'6\"（照片未收入，位置为示意）"],
  ["vanity", "现有洗手台位置与尺寸", "右墙，进深约 20\"，沿墙长约 4'6\"（现状长台/双位）"],
  ["drain", "下水与地漏位置", "淋浴盘内地漏"],
  ["walls", "可否动的墙（承重/管线）", "后墙与隔墙情况待确认；管线预计在左墙花洒与右墙台盆"],
].map(([id, label, example]) => ({
  id,
  label,
  example,
  initialText: example,
  initialSource: "plan" as const,
}));

function openRows(): CompareRow[] {
  return [
    text("结构注意事项", "后墙与隔墙情况待确认；管线预计在左墙花洒与右墙台盆"),
    text("Permit 要点", "拆除预制淋浴盘、满铺防水、找坡和地漏、台盆缩短为较窄双台并移位、新浴缸落水做到现在的干区地板，通常要 plumbing / building permit。花洒阀位一般可沿用。不新开窗，只用现状后窗；现状后窗做湿区收口，要确认是否钢化。需与市府确认"),
    alts("成本", [
      { when: { entry: "curbless", splash: "glass" }, text: "$$$$（拆改台盆、拆除预制盘、满墙防水贴砖、零门槛找坡、线性地漏、新浴缸排水做到原干区，较窄双台要重新接给排水；三案中最贵；含玻璃放样）" },
      { when: { entry: "curbless", splash: "curtain" }, text: "$$$$（拆改台盆、拆除预制盘、满墙防水贴砖、零门槛找坡、线性地漏、新浴缸排水做到原干区，较窄双台要重新接给排水；三案中最贵；若用浴帘可略减玻璃费）" },
      { when: { entry: "curb" }, text: "$$$$（拆改台盆、拆除预制盘、满墙防水贴砖、矮门槛和地漏、新浴缸排水做到原干区；仍为三案中最贵，但比全平地少一些找坡和下沉子楼板）" },
    ]),
    alts("工期", [
      { when: { entry: "curbless", splash: "glass" }, text: "三案中相对更长（拆盘、防水、找坡、线性地漏、玻璃放样）" },
      { when: { entry: "curbless", splash: "curtain" }, text: "三案中相对更长（拆盘、防水、找坡、线性地漏）" },
      { when: { entry: "curb", splash: "glass" }, text: "三案中相对更长（拆盘、防水、矮门槛和地漏、玻璃放样，比全平地略短）" },
      { when: { entry: "curb", splash: "curtain" }, text: "三案中相对更长（拆盘、防水、矮门槛和地漏，比全平地略短）" },
    ]),
  ];
}

function wetRows(): CompareRow[] {
  return [
    text("结构注意事项", "后墙与隔墙情况待确认；管线预计在左墙花洒与右墙台盆"),
    text("Permit 要点", "同方案一，另加浴缸移位和墙面嵌入式电视的防水、接线，通常要 plumbing / building / electrical permit，需与市府确认。不新开窗，只用现状后窗。"),
    text("成本", "$$$–$$$$（在方案一基础上调整布局，并做墙面嵌入式大电视；大电视为主要加项）"),
    text("工期", "中等偏长（同方案一，另加嵌入式电视的防水与接线）"),
  ];
}

function alcoveRows(): CompareRow[] {
  return [
    text("结构注意事项", "后墙与隔墙情况待确认；管线预计在左墙花洒与右墙台盆"),
    text("Permit 要点", "在原湿区改成浴缸淋浴，落水和防水仍可能要 plumbing / building permit；花洒多半还在原左墙，或只需调整高度。不新开窗，只用现状后窗，位置和尺寸保持原样；窗在湿区上方，要确认是否钢化。需与市府确认"),
    alts("成本", [
      { when: { splash: "glass" }, text: "$$–$$$（工作主要在原淋浴湿区内改成常规缸淋浴，台盆不动；改固定玻璃会略增放样费用，三案中往往仍相对更省）" },
      { when: { splash: "curtain" }, text: "$$–$$$（工作主要在原淋浴湿区内改成常规缸淋浴，台盆不动；浴帘更省；三案中往往相对更省）" },
    ]),
    text("工期", "三案中相对较短"),
  ];
}

function panelRows(): CompareRow[] {
  return [
    text("结构注意事项", "后墙与隔墙情况待确认；管线预计在左墙花洒与右墙台盆"),
    text("Permit 要点", "拆除预制盘和玻璃门、满铺防水、湿区找坡和地漏、新浴缸落水通常要 plumbing / building permit；或要核楼板承重。左墙阀位基本不动。不新开窗，只用现状后窗，位置和尺寸保持原样；窗在湿区里，要确认是否钢化。需与市府确认"),
    alts("成本", [
      { when: { splash: "glass" }, text: "$$–$$$（拆除预制盘、嵌 60 英寸缸、做缸沿齐平小平台、满墙防水贴砖、固定玻璃放样）" },
      { when: { splash: "curtain" }, text: "$$–$$$（拆除预制盘、嵌 60 英寸缸、做缸沿齐平小平台、满墙防水贴砖；浴帘更省）" },
    ]),
    text("工期", "中等（拆除预制盘、嵌缸、做平台并重做防水贴砖）"),
  ];
}

/** Facts that apply to every 樊家 scheme. Dimensions are inches. */
const FAN_STRUCTURE_FACTS = [
  "All dimensions in this project are inches.",
  "The back wall, the wall the source photograph faces, is 70 inches wide.",
  "There is exactly one existing window. It is high on the right side of the back wall, in the same position as in the source photograph and as in 方案一. Never move, add, or resize it.",
  "Where a scheme includes a tub, the tub is a standard 60-inch tub.",
  "The source photograph of this bathroom shows no sliding door, no hallway door opening, and no kitchen door opening. Do not add them.",
];

/**
 * Layout facts for one scheme. These are hard constraints only when that
 * scheme is selected. None of them preset a television.
 */
const SCHEME_GENERATION_CONSTRAINTS: Record<string, string[]> = {
  open: [
    "方案一: tiled shower on the left of the back wall, a fixed glass panel separating the vanity zone, and a freestanding tub on the right. The vanity is a double sink about 48 inches wide by 20 inches deep. Do not add a stub wall or a tub-rim ledge.",
    "Keep the existing window high on the right side of the back wall. This scheme is the reference position for that window: do not move, add, or resize it.",
  ],
  wetroom: [
    "方案一变体: freestanding tub against the left wall, shower on the right portion of the back wall, and a double vanity about 48 inches wide by 20 inches deep on the right. Do not add a stub wall or a tub-rim ledge.",
    "Keep the existing window high on the right side of the back wall, in the same position as 方案一. Do not cover, block, or replace it.",
  ],
  alcove: [
    "短墙嵌缸: the stub wall is on the LEFT. It is about 10 inches thick/wide, taken out of the 70-inch back wall, leaving exactly the 60-inch tub alcove. Place a standard 60-inch tub in that alcove.",
    "The shower head is on the left end wall of the tub, and the person stands in the tub to shower. Keep the 54-inch double vanity on the right wall. Do not move the window.",
  ],
  panel: [
    "缸沿平台: do not add a stub wall. Place a standard 60-inch tub against the back wall, and fill the rest of the 70-inch back wall with a ledge whose top is level with the tub rim.",
    "The person stands in the tub to shower. Keep the 54-inch double vanity on the right wall. Keep the existing window high on the right side of the back wall.",
  ],
};

const schemes: SchemeDTO[] = [
  {
    key: "open",
    name: "方案一",
    nameEn: "Scheme 1",
    sortOrder: 0,
    imageAlt: "方案一：贴砖淋浴在后墙左侧，固定玻璃隔开洗手台区，独立浴缸在右侧，约 48 英寸×20 英寸双台。只用现状后窗。",
    decorMode: "preset",
    hotspots: [
      tile(40, 30),
      {
        key: "shower",
        x: 27,
        y: 20,
        category: "shower",
        swatches: "fixture",
        titles: {
          mist: "镍色花洒（淋浴区左墙）",
          wood: "黑色花洒（淋浴区左墙）",
          ink: "黄铜花洒（淋浴区左墙）",
        },
        idea: "固定花洒在贴砖淋浴区左墙、阀的上方，基本沿用现状阀位，一般不必改管。",
        structure: "管位沿用现有左墙出水；不必为花洒移位。",
        permit: "改花洒组若不移位，工程量较小；仍需与市府确认。",
        costBand: "$",
        timelineBand: "较快",
        significant: false,
      },
      {
        key: "tub",
        x: 58,
        y: 68,
        category: "tub",
        title: "独立浴缸",
        idea: "独立浴缸给 3 岁孩子洗澡更从容，也不必进淋浴区；旁边是走道，零门槛更容易进出但也更容易滑，要铺防滑垫、始终看护。",
        structure: "缸体落在现在的干区地板上（原双台盆位置），要新做防水和下水。",
        permit: "新增浴缸排水、动楼板通常要 plumbing / building permit，需与市府确认。",
        costBand: "$$",
        timelineBand: "较慢",
        significant: true,
      },
      {
        key: "vanity",
        x: 88,
        y: 64,
        category: "vanity",
        titles: { mist: "浅色较窄双台", wood: "暖木较窄双台", ink: "深色木较窄双台" },
        idea: "原双台缩短为约 48 英寸×20 英寸双台，给右侧独立浴缸留出空隙；两个人早上仍可同时用。",
        structure: "台盆在右侧近处，进深仍约 20 英寸；给排水口要重新接，位置需现场看。",
        permit: "移位或缩短台盆若改管线，需与市府确认。",
        costBand: "$$$",
        timelineBand: "较慢",
        significant: true,
      },
    ],
    compareRows: openRows(),
    generationConstraints: SCHEME_GENERATION_CONSTRAINTS.open,
    optionGroups: [splashGroup(), entryGroup()],
    renders: [
      ...splashEntryStills(
        (splash) =>
          splash === "glass"
            ? { src: file("fan-struct-vanity.jpg"), frames: 1, frame: 0 }
            : { src: file("fan-wood-inktile.jpg"), frames: 1, frame: 0 },
        true,
      ),
      ...decorPresets({
        mist: "fan-decor-vanity-mist.jpg",
        wood: "fan-decor-vanity-wood.jpg",
        ink: "fan-decor-vanity-ink.jpg",
      }),
    ],
  },
  {
    key: "wetroom",
    name: "方案一变体",
    nameEn: "Scheme 1 variant",
    sortOrder: 1,
    summary: "$$$ 嵌入式大电视为主要加项",
    summaryLines: ["浴缸旁：墙面嵌入式大电视（主要加项，坐在浴缸里可见）"],
    imageAlt: "方案一变体：独立浴缸在左侧贴墙，墙面嵌入式大电视在浴缸上方，约 48 英寸×20 英寸双台在右侧，淋浴在后墙右侧。只用现状后窗。",
    decorMode: "preset",
    hotspots: [
      tile(42, 30),
      {
        key: "shower",
        x: 74,
        y: 14,
        category: "shower",
        swatches: "fixture",
        titles: { mist: "镍色花洒与手持", wood: "黑色花洒与手持", ink: "黄铜花洒与手持" },
        idea: "固定花洒在后墙右侧淋浴区。浴缸在左侧，旁可另接手持，方便给 3 岁孩子洗澡。",
        structure: "花洒跟着这套布局到右侧湿区，不留在方案一的左墙。加手持要在湿区内加管和 diverter。",
        permit: "右侧新阀位以及加手持若改管，需与市府确认。",
        costBand: "$$",
        timelineBand: "中等",
        significant: true,
      },
      {
        key: "tub",
        x: 32,
        y: 70,
        category: "tub",
        title: "独立浴缸",
        idea: "独立浴缸在开放贴砖湿区内，缸旁有手持花洒，给 3 岁孩子洗澡更方便；出湿区要防滑。",
        structure: "缸体落在开放贴砖湿区内，要核楼板承重与排水、防水。",
        permit: "新增浴缸排水、动楼板通常要 plumbing / building permit，需与市府确认。",
        costBand: "$$",
        timelineBand: "较慢",
        significant: true,
      },
      {
        key: "vanity",
        x: 86,
        y: 64,
        category: "vanity",
        titles: { mist: "浅色较窄双台", wood: "暖木较窄双台", ink: "深色木较窄双台" },
        idea: "约 48 英寸×20 英寸双台在右侧，给后墙淋浴留出入口；两个人早上仍可同时用。",
        structure: "台盆在右侧近处，进深仍约 20 英寸；给排水口要重新接，位置需现场看。",
        permit: "移位或缩短台盆若改管线，需与市府确认。",
        costBand: "$$$",
        timelineBand: "较慢",
        significant: true,
      },
    ],
    compareRows: wetRows(),
    generationConstraints: SCHEME_GENERATION_CONSTRAINTS.wetroom,
    optionGroups: [splashGroup(), entryGroup()],
    renders: [
      ...splashEntryStills(
        (splash) => ({
          src: file("fan-struct-wetroom.jpg"),
          frames: 2,
          frame: splash === "curtain" ? 1 : 0,
        }),
        true,
      ),
      ...decorPresets({
        mist: "fan-ink-woodtile.jpg",
        wood: "fan-decor-wetroom-wood.jpg",
        ink: "fan-decor-wetroom-ink.jpg",
      }),
    ],
  },
  {
    key: "alcove",
    name: "短墙嵌缸",
    nameEn: "Short-wall alcove",
    sortOrder: 2,
    imageAlt: "短墙嵌缸：加一段短墙做成正好 60 英寸嵌缸，花洒在浴缸左侧端墙，淋浴时站在浴缸里。右墙 54 英寸双台。只用现状后窗。",
    decorMode: "colorGrid",
    decorCaveat: "配色示意图按固定玻璃；浴帘组合未另出图",
    decorGrid: {
      framesPerSprite: 4,
      bits: [
        { axis: "fixture", value: "black", weight: 1 },
        { axis: "wall", value: "ink", weight: 2 },
        { axis: "vanity", value: "wood", weight: 4 },
        { axis: "floor", value: "stone", weight: 8 },
      ],
    },
    hotspots: [
      tile(50, 28),
      {
        key: "shower",
        x: 26,
        y: 14,
        category: "shower",
        swatches: "fixture",
        titles: { mist: "镍色花洒（浴缸端墙）", wood: "黑色花洒（浴缸端墙）", ink: "黄铜花洒（浴缸端墙）" },
        idea: "花洒和阀在浴缸左侧端墙，淋浴时站在浴缸里。阀位大致沿用原淋浴左墙，高度可能要重装。",
        structure: "阀位仍在原淋浴左墙附近，通常不必大改管线，但高度或要按浴缸淋浴调整。",
        permit: "若只在原墙调整花洒高度，工程量较小；仍需与市府确认。",
        costBand: "$",
        timelineBand: "较快",
        significant: false,
      },
      {
        key: "tub",
        x: 48,
        y: 68,
        category: "tub",
        title: "贴墙嵌入式浴缸",
        idea: "常规贴墙浴缸，给 3 岁的儿子洗澡最稳妥；淋浴时要站在浴缸里，注意防滑和看护。",
        structure: "缸体嵌在原淋浴房位置，贴后墙；落水仍在原湿区内。",
        permit: "在原湿区改浴缸，落水和防水通常要 plumbing / building permit，需与市府确认。",
        costBand: "$$",
        timelineBand: "较慢",
        significant: true,
      },
      {
        key: "vanity",
        x: 84,
        y: 64,
        category: "vanity",
        titles: { mist: "浅色双盆洗手台", wood: "暖木双盆洗手台", ink: "深色木双盆洗手台" },
        idea: "保留双盆，早上可以两个人同时用。",
        structure: "台盆长度与位置按现状，主要换门板和台面。",
        permit: "只换柜体通常不涉结构 permit；若改管线，需与市府确认。",
        costBand: "$$",
        timelineBand: "中等",
        significant: false,
      },
    ],
    compareRows: alcoveRows(),
    generationConstraints: SCHEME_GENERATION_CONSTRAINTS.alcove,
    optionGroups: [splashGroup(), entryGroup(ENTRY_NA)],
    renders: [
      ...splashOnlyStills((splash) =>
        splash === "glass"
          ? { src: file("fan-ink-misttile.jpg"), frames: 1, frame: 0 }
          : { src: file("fan-struct-combo.jpg"), frames: 1, frame: 0 },
      ),
      ...colorGridRenders(),
    ],
  },
  {
    key: "panel",
    name: "缸沿平台",
    nameEn: "Rim platform",
    sortOrder: 3,
    imageAlt: "缸沿平台：不加短墙，60 英寸缸贴后墙，右侧用与缸沿齐平的小平台填余长；站在浴缸里淋浴。右墙 54 英寸双台。只用现状后窗。",
    decorMode: "preset",
    hotspots: [
      tile(44, 28),
      {
        key: "shower",
        x: 20,
        y: 14,
        category: "shower",
        swatches: "fixture",
        titles: { mist: "镍色花洒与手持", wood: "黑色花洒与手持", ink: "黄铜花洒与手持" },
        idea: "固定花洒在湿区左墙，沿用现状阀位；浴缸旁可选手持，方便给 3 岁孩子洗澡。",
        structure: "左墙阀位基本不动；若加手持，需在湿区内加一路水管和 diverter。",
        permit: "左墙花洒若不移位，工程量较小；加手持若改管，需与市府确认。",
        costBand: "$$",
        timelineBand: "中等",
        significant: true,
      },
      {
        key: "tub",
        x: 42,
        y: 66,
        category: "tub",
        title: "独立浴缸（湿区内）",
        idea: "独立浴缸和淋浴同在一块通高固定玻璃后的湿区内，给 3 岁孩子洗澡更从容；出湿区要防滑并始终看护。",
        structure: "缸体落在贴砖湿区内，要核楼板承重与排水、防水。",
        permit: "新增浴缸排水、动楼板通常要 plumbing / building permit，需与市府确认。",
        costBand: "$$",
        timelineBand: "较慢",
        significant: true,
      },
      {
        key: "vanity",
        x: 84,
        y: 64,
        category: "vanity",
        titles: { mist: "浅色双盆洗手台", wood: "暖木双盆洗手台", ink: "深色木双盆洗手台" },
        idea: "保留双盆，早上可以两个人同时用。",
        structure: "台盆长度与位置按现状，主要换门板和台面。",
        permit: "只换柜体通常不涉结构 permit；若改管线，需与市府确认。",
        costBand: "$$",
        timelineBand: "中等",
        significant: false,
      },
    ],
    compareRows: panelRows(),
    generationConstraints: SCHEME_GENERATION_CONSTRAINTS.panel,
    optionGroups: [splashGroup(), entryGroup(ENTRY_NA)],
    renders: [
      ...splashOnlyStills((splash) => ({
        src: file("fan-struct-panel.jpg"),
        frames: 2,
        frame: splash === "curtain" ? 1 : 0,
      })),
      ...decorPresets({
        mist: "fan-mist-woodtile.jpg",
        wood: "fan-mist-inktile.jpg",
        ink: "fan-wood-misttile.jpg",
      }),
    ],
  },
];

export const FAN_SLUG = "fan-bathroom";
export const FAN_SHARE = "fan-jie-bath";

export function buildFanProject(): ProjectDTO {
  return {
    id: "seed-fan",
    slug: FAN_SLUG,
    shareToken: FAN_SHARE,
    locale: "zh",
    title: "樊家卫生间·方案对比",
    summary: "给设计师和屋主看的对比：先看现状，再定淋浴加浴缸怎么摆，最后看装饰。示例项目，供一起看稿。",
    property: [
      { label: "城市", value: "暂按 City of Alameda（阿拉米达市）举例，实际城市待确认" },
      { label: "县/郡", value: "Alameda County" },
      { label: "类型", value: "独立住宅 / 主卧卫生间" },
      { label: "说明", value: "虚构示例。同一县内各市的 building / plumbing permit 规则不同，以项目所在城市为准" },
    ],
    household: [
      { label: "主人", value: "樊女士，35 岁" },
      { label: "丈夫", value: "周先生，35 岁" },
      { label: "儿子", value: "3 岁" },
    ],
    requirements: [
      "现在只有淋浴，希望保留淋浴，并加一个浴缸（给 3 岁的儿子洗澡，偶尔也想泡一泡）",
      "主卧卫生间，希望清爽、好打扫，不要过分轻奢",
      "不新开窗，只用现状后窗，位置和尺寸保持原样。现状后窗做湿区收口，要确认是否钢化。洗手台在方案一和方案一变体为约 48 英寸×20 英寸双台（窄于方案三、四的 54 英寸双台）",
    ],
    principles: [
      { label: "怎么比", value: "先看现状和尺寸，再单独定淋浴加浴缸怎么摆（结构图不含新装饰，机位与现状照相同），最后看装饰。换结构时装饰选择会保留。" },
      { label: "几种结构", value: "方案一：贴砖淋浴在后墙左侧，固定玻璃把洗手台区隔开，独立浴缸在右侧，台盆为约 48 英寸×20 英寸双台。方案一变体：浴缸改到左侧贴墙，右侧仍是约 48 英寸双台，并加墙面嵌入式大电视（主要加项）。短墙嵌缸：加一段短墙做成正好 60 英寸嵌缸淋浴，右墙 54 英寸双台保留。缸沿平台：不加短墙，用与缸沿齐平的小平台填余长，右墙 54 英寸双台保留。" },
      { label: "共同约束", value: "都不新开窗，只用现状后窗，位置和尺寸保持原样。都保留主要墙体和天花。方案一和方案一变体会拆现有玻璃门和预制盘，并把双台缩短为约 48 英寸×20 英寸双台；「短墙嵌缸」和「缸沿平台」都保留右墙长双台，人站在 60 英寸缸里淋浴。" },
    ],
    openItems: [
      "确认项目所在城市：Alameda County 各市的 building / plumbing permit 规则不同，以该市规定为准，需与市府确认",
      "浴缸位的楼板承重、子楼板和下水坡度，需承包商或结构工程师先看；去掉浴台若做零门槛，还要确认能否下沉子楼板做找坡",
      "现有淋浴盘和台盆的给排水管位、管径，新浴缸落水能否接入；较窄双台的新管位",
      "拆除预制盘后的满铺防水、找坡和地漏，需承包商评估并与市府确认",
      "花洒阀位：左墙能否沿用；若选手持花洒，湿区内加管和 diverter 是否要改管，需与市府确认",
      "不新开窗，只用现状后窗，位置和尺寸保持原样。现状后窗是否钢化、是否涉及采光或逃生要求，需与市府确认",
      "若房屋属 HOA 小区，还要问协会对改管、改湿区和施工时段的规定",
    ],
    generationConstraints: [
      "不新开窗，不新开门，不加天窗。不得添加现状照片或需求里没有的洞口。",
      "不得为了构图移动花洒、浴缸、台盆或窗。位置以选定的结构方案为准。",
      "不得添加方案文字里没有的墙、梁、夹层或室外景色。",
      ...FAN_STRUCTURE_FACTS,
    ],
    room: {
      kind: "bathroom",
      name: "主卧卫生间",
      beforeSrc: file("fan-before.jpg"),
      beforeAlt: "改造前的主卧卫生间：大走入玻璃淋浴房、右侧双台盆、左侧毛巾架，木纹地板。后墙仅一扇窗。",
      beforeCaption: "现状（改造前）",
      plan: existingPlan,
      dimensions,
    },
    schemes,
    decor: {
      presets: PRESETS,
      axes: [
        {
          key: "fixture",
          label: "花洒",
          summaryLabel: "花洒颜色",
          choices: [
            { key: "nickel", label: "拉丝镍", color: "#c5c7ca" },
            { key: "black", label: "哑光黑", color: "#1a1a1a" },
          ],
        },
        {
          key: "wall",
          label: "墙",
          summaryLabel: "墙面",
          choices: [
            { key: "ivory", label: "象牙石纹", color: "#e8e2d6" },
            { key: "ink", label: "墨灰砖", color: "#3a3d42" },
          ],
        },
        {
          key: "vanity",
          label: "水池",
          summaryLabel: "水池",
          choices: [
            { key: "white", label: "白柜", color: "#f4f2ee" },
            { key: "wood", label: "深木", color: "#6b4a2e" },
          ],
        },
        {
          key: "floor",
          label: "地面",
          summaryLabel: "地面",
          choices: [
            { key: "oak", label: "暖木地板", color: "#b0895a" },
            { key: "stone", label: "深灰石砖", color: "#5c5f63" },
          ],
        },
      ],
      compareRows: [
        {
          label: "空间理念",
          byPreset: {
            mist: "亮、柔的盥心氛围：石纹克制，灯和五金都偏静",
            wood: "偏温泉汤屋：暖木、米色砖，手感更粗",
            ink: "电影酒店般的夜浴：深色石面配黄铜",
          },
        },
        {
          label: "风格关键词",
          byPreset: {
            mist: "云石、象牙、柔光、刷镍",
            wood: "汤屋、暖木、米色砖、亚麻",
            ink: "墨岩、黄铜、深色木、暖光",
          },
        },
        {
          label: "推荐元素",
          byPreset: {
            mist: "象牙石纹墙砖、白色浴缸、浅色台盆、镍色花洒",
            wood: "暖米色墙砖、厚实木台盆、黑色五金、亚麻毛巾",
            ink: "墨灰石纹墙砖、深色木台盆、黄铜龙头与花洒",
          },
        },
        {
          label: "Permit",
          byPreset: {
            mist: "饰面本身不代替结构审查；换砖、换角、重做防水仍可能要报。拆改与管线见结构一步，需与市府确认",
            wood: "同左；木作台盆若改管线也要一并确认",
            ink: "同左；深色石材和重台盆若动管线、动防水，需与市府确认",
          },
        },
        {
          label: "装饰成本 $",
          byPreset: { mist: "$$", wood: "$$$", ink: "$$$$" },
        },
        {
          label: "装饰工期",
          byPreset: { mist: "较短", wood: "中等", ink: "较长" },
        },
      ],
      limitedNote: "完整配色组合仅在短墙嵌缸方案演示",
    },
    generations: [],
  };
}
