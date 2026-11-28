# Remy · agentic remodel

Remy is a web app for a designer or contractor and their client. Start from a photo of a room as it is, compare remodel schemes, and let the client commit options. Structure (where the fixtures go) comes before decor (finishes and colors). It is not tied to bathrooms: a project has a room type, and the 樊家卫生间 project is seed data.

## Architecture

Next.js App Router, TypeScript, Prisma, SQLite. The comparison UI reads a project document from the database. It does not hardcode the 樊家 schemes in React.

| Piece | Role |
| --- | --- |
| `Project`, `Room` | Engagement, household, requirements, before photo, plan, dimensions |
| `Scheme` | One structural layout, with its own plan, hotspots, comparison copy, and renders |
| `OptionGroup` / `Option` | Per-scheme choices such as 挡水 and 入口. Phase is `structure` or `decor` |
| `Render` | A still, or one frame of a sprite, chosen when `when` matches splash, entry, preset, or color-grid index |
| `DecorSet` | Presets, color axes, and decor comparison copy. Shared across schemes so a finish choice survives a layout change |
| `Selection` | The client's committed choices and in-progress preview, one row per project |
| `Generation` | A recorded image request. The stub does not attach a fake render to a scheme |

Hotspots store a position per scheme, not per finish and not per splash option. Changing 云石 to 墨岩, or 固定玻璃 to 浴帘, does not move the dots. Changing the scheme does, because the fixtures moved.

Preview (`全部套用`, color edits, preset thumbnails) is stored so a refresh does not lose it. The summary lists only commits (`选定`, `选定此套`, `选定配色`, the structure button).

Chrome strings live in `src/lib/i18n.ts` (Chinese default, English alongside). Scheme names, hotspot copy, and comparison text are project data. Optional `nameEn` fields are there for a later translation. The seeded copy is Chinese.

Share link: `/c/[token]`. The client can select. The designer studio is `/projects/[slug]`. Both write the same selection row.

Auth is a placeholder at `/login`. It sets a cookie and does not check identity. The studio is not locked.

## Run

```bash
cp .env.example .env
npm install
npm run setup
npm run dev
```

`npm run setup` applies migrations and seeds the 樊家 project. SQLite lives at `prisma/dev.db`. `DATABASE_URL="file:./dev.db"` is what Prisma CLI expects (relative to `prisma/`). The app resolves that same file so Next and Prisma do not open two different databases.

- Studio: http://localhost:3000/projects/fan-bathroom
- Client: http://localhost:3000/c/fan-jie-bath
- New project: http://localhost:3000/projects/new

Other scripts: `npm run typecheck`, `npm run lint`, `npm run check` (render-matching checks against the seed catalog), `npm run db:seed` (re-seeds 樊家 and replaces that project only).

To use Postgres, change the datasource provider, point `DATABASE_URL` at the server, and run `npm run setup`. The `file:` path shim only applies to SQLite URLs.

## Seeded demo

`prisma/fan-data.ts` rebuilds the 樊家卫生间 comparison: existing photo, four layouts (方案一, 方案一变体, 短墙嵌缸, 缸沿平台), three decor presets, and the 16-color grid on 短墙嵌缸. The 20 JPEGs are in `public/seed/fan/`. Some filenames are leftovers from earlier rounds; the seed map, not the filename, decides which still is which.

Flow in the app:

0. Existing condition: before photo, simple plan, dimensions.
1. Structure. Each scheme has its own 挡水 and, where it applies, 入口. 短墙嵌缸 and 缸沿平台 have no floor entry, because you stand in the tub.
2. Decor. Large image, three presets, color pickers. The full 16-way grid is only on 短墙嵌缸. Other layouts keep the preset still and say so.
3. Summary of commits, plus a concept still when one exists.

Cost (`$`–`$$$$$`) and timeline show on the preset and on a hotspot only when that impact is flagged significant. Layout comparison still has 成本 and 工期 notes, because those differences are the point of the step.

## Stub versus real

Image generation is behind `ImageProvider` in `src/server/image-gen/`.

Provider choice: `IMAGE_PROVIDER=seedream` uses Seedream when `ARK_API_KEY` is set. `IMAGE_PROVIDER=gemini` uses Gemini when `GEMINI_API_KEY` is set. A missing key does not switch to the other image model. Otherwise the HTTP adapter is used when both `IMAGE_API_BASE` and `IMAGE_API_KEY` are set, then the stub. No key is committed.

- **Stub** (`stub.ts`), the default. Records the prompt and stores a `Generation` row. It does not return pixels and does not pretend the before photo is a remodel.
- **Seedream** (`seedream-adapter.ts`). Seedream 5.0 Pro, model id `doubao-seedream-5-0-pro-260628` ([Ark image generation](https://ark.volcengine.com/region:cn-beijing/docs/image-generation-api)). `POST https://ark.cn-beijing.volces.com/api/v3/images/generations` with `Authorization: Bearer`. The source photo is a `data:image/jpeg;base64,...` value in `image`. `size` is `2K`. The prompt asks for a 3:2 landscape frame because this model has no aspect field; the docs map 2K at 3:2 to 2496×1664. `watermark` is `false`. A returned image is saved under `public/uploads` and on the generation row, not onto a scheme.
- **Gemini** (`gemini-adapter.ts`). Nano Banana 2.1, model id `gemini-nano-banana-2.1` ([pricing](https://ai.google.dev/gemini-api/docs/pricing), [image generation](https://ai.google.dev/gemini-api/docs/image-generation)). `POST https://generativelanguage.googleapis.com/v1beta/interactions` with the source photo read from `public/` (for the seed, `public/seed/fan/fan-before.jpg`) as inline base64, plus a prompt that says to edit that exact room (same camera, same window position, same walls). Output is `image_size` `2K` at aspect ratio `3:2` (2528×1696). The header is `x-goog-api-key`. A returned image is saved under `public/uploads` and on the generation row. It is not written onto a scheme.
- **HTTP adapter** (`http-adapter.ts`). OpenAI-compatible `POST /images/generations`. Default model is `gpt-image-2.6-flare` (`IMAGE_API_MODEL` overrides it). `IMAGE_API_QUALITY` is sent as `quality` and defaults to `medium`. This adapter sends the prompt only and does not upload the source photo. A returned image is saved under `public/uploads` and on the generation row, not onto a scheme.

樊家 generation: `.env` is gitignored. Copy the filled file and set the two keys.

```
cp .env.ready .env
```

`ARK_API_KEY` and `GEMINI_API_KEY` are the only empty values. `npm run gen:fan` runs Seedream only. For each of 方案一, 方案一变体, 短墙嵌缸, and 缸沿平台 it draws a structure image, retries once when that image is poor, then draws mist, wood, and ink from the approved structure. Files are `public/uploads/fan/seedream/<scheme>/structure.jpg` and `<scheme>/mist.jpg`, `wood.jpg`, and `ink.jpg`. A full run makes at most 20 Seedream calls. An empty `ARK_API_KEY` exits before any request. Passing `--provider gemini` exits without calling Gemini. The studio shows an upgrade placeholder for further customization.

Every prompt, including the stub's, includes hard constraints: do not invent openings that are not in the source photo or the written requirements; do not move, add, or resize windows; do not add structure the selected scheme does not call for; do not move fixtures to improve the picture. Structural locks (sliding doors, sliding windows, hallway door openings, kitchen door openings, ceiling height, and camera viewpoint) apply only when that element is already in the source photo, and the prompt must not tell the model to add one that is absent. A television is not preset: it may be added only on a dry wall with an unobstructed sightline, never on or instead of a window. Anything the requirements and the selected scheme do not explicitly ask to change stays as built. Project-level constraints are stored on the project. Scheme-level constraints are stored on the scheme and included when the request names that scheme (`POST /api/projects/{slug}/generate?scheme={key}`).

`生成结构与三套饰面` on the studio page runs the same Seedream flow. Each structure can be regenerated once more, and the total stays at two attempts.

## Decisions worth passing on

- The prototype's summary image treated 方案一变体 as the 缸沿平台 stills. That looked like a stale key. Remy shows the variant's own renders.
- Hotspot anchors follow the fixture in that scheme's stills. The prototype left the variant's shower dot on the left wall after the shower moved to the right; the seed puts it on the shower.
- The three-column decor board in the prototype source is disabled (`false &&`). Remy ships the live path: structure columns, then the decor composer.
- Step 0 is the existing room. The prototype called dimensions step 1. The content is the same; the index matches "existing, then schemes."
- One selection row is shared by the studio and the client link. Two people editing at once: last write wins.
- Login does not protect routes.
