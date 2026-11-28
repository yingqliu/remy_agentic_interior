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

Set `OPENAI_API_KEY` to generate with OpenAI `gpt-image-1` (`POST /v1/images/generations`); leave it unset and the stub records the prompt without returning an image.

Other scripts: `npm run typecheck`, `npm run lint`, `npm run check` (render-matching checks against the seed catalog), `npm run test` (gpt-image-1 provider and missing-key fallback), `npm run db:seed` (re-seeds 樊家 and replaces that project only).

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

- **Stub** (`stub.ts`), the default when `OPENAI_API_KEY` is unset. Records the prompt and stores a `Generation` row. It does not return pixels and does not pretend the before photo is a remodel.
- **OpenAI** (`openai.ts`), used when `OPENAI_API_KEY` is set. Calls `gpt-image-1` at `POST https://api.openai.com/v1/images/generations`. `b64_json` is decoded into `public/uploads`; a returned `url` is used as-is. The image is shown on the scheme comparison and on the generation row. It is not written onto a scheme, so a live key cannot replace the 樊家 stills.
- **HTTP adapter** (`http-adapter.ts`), used only when `OPENAI_API_KEY` is blank and both `IMAGE_API_BASE` and `IMAGE_API_KEY` are set. OpenAI-compatible `POST /images/generations`. No key is committed. A returned image is saved under `public/uploads` and on the generation row. It is not written onto a scheme.

Every prompt, including the stub's, includes hard constraints: do not invent windows, doors, skylights, or other openings that are not in the source photo or the written requirements; do not add structure the scheme does not call for; do not move fixtures to improve the picture. Project-level constraints are stored on the project and added as well.

`记录一次生成请求` on the studio page exercises this path.

## Decisions worth passing on

- The prototype's summary image treated 方案一变体 as the 缸沿平台 stills. That looked like a stale key. Remy shows the variant's own renders.
- Hotspot anchors follow the fixture in that scheme's stills. The prototype left the variant's shower dot on the left wall after the shower moved to the right; the seed puts it on the shower.
- The three-column decor board in the prototype source is disabled (`false &&`). Remy ships the live path: structure columns, then the decor composer.
- Step 0 is the existing room. The prototype called dimensions step 1. The content is the same; the index matches "existing, then schemes."
- One selection row is shared by the studio and the client link. Two people editing at once: last write wins.
- Login does not protect routes.
