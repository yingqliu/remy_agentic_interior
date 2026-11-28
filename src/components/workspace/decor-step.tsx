"use client";

import type { ProjectDTO, SelectionState } from "@/lib/types";
import { missingDimensions } from "@/lib/selection";
import { activeScheme, colorsEqual, overlaySeedream, presetByColors, presetStill, schemeOptions, workingPreset, type Still } from "@/lib/visuals";
import { Button, ImpactTag, Swatches } from "@/components/ui";
import { FrameImage } from "./frame-image";
import { HotspotStage } from "./hotspot-stage";
import { HoverNote } from "./hover-note";
import { useT } from "./locale";
import { StepHeading } from "./existing-step";

export function DecorStep({
  project,
  selection,
  onColors,
  onPickPreset,
  onCommitPreset,
  onRestorePreset,
  onCommitColors,
  onDecide,
  onUnselect,
  onPreview,
  onRestore,
  onTileSwatch,
  onFixtureSwatch,
  onOpen,
}: {
  project: ProjectDTO;
  selection: SelectionState;
  onColors: (colors: Record<string, string>) => void;
  onPickPreset: (key: string) => void;
  onCommitPreset: () => void;
  onRestorePreset: () => void;
  onCommitColors: () => void;
  onDecide: (presetKey: string, hotspotKey: string) => void;
  onUnselect: (presetKey: string, hotspotKey: string) => void;
  onPreview: (presetKey: string, hotspotKey: string) => void;
  onRestore: (category: string) => void;
  onTileSwatch: (presetKey: string) => void;
  onFixtureSwatch: (choiceKey: string) => void;
  onOpen: (still: Still) => void;
}) {
  const { t, locale } = useT();
  const scheme = activeScheme(project, selection);
  const presets = project.decor.presets;
  if (!scheme || presets.length === 0) return null;
  const working = workingPreset(project, selection) ?? presets[0];
  const splash = schemeOptions(scheme, selection).splash;
  const mainPresetKey =
    scheme.decorMode === "colorGrid"
      ? presetByColors(presets, selection.colors)?.key ?? null
      : selection.preview.tile && selection.preview.tile !== working.key
        ? selection.preview.tile
        : working.key;
  const main = overlaySeedream(
    scheme.decorMode === "colorGrid"
      ? presetStill(scheme, { ...working, colors: selection.colors }, {}, splash)
      : presetStill(scheme, working, selection.preview, splash),
    scheme.key,
    { kind: "finish", presetKey: mainPresetKey },
    project.seedream,
  );
  const pendingDims = missingDimensions(project, selection).length > 0;
  const chosen = selection.structureKey && selection.structureKey !== "maybe";
  const schemeName = locale === "en" && scheme.nameEn ? scheme.nameEn : scheme.name;
  const colorPending = selection.committedColors == null || !colorsEqual(selection.colors, selection.committedColors);
  const setPending = selection.pendingPreset != null && selection.pendingPreset !== selection.decorPreset;
  const fixtureAxis = project.decor.axes.find((axis) => axis.key === "fixture");
  const categoryLabel = (category: string) =>
    category === "tile" ? t("catTile") : category === "tub" ? t("catTub") : category === "vanity" ? t("catVanity") : category === "shower" ? t("catShower") : category;

  return (
    <section id="step-2" className="scroll-mt-24">
      <StepHeading index="2" title={t("step2")} lead={t("step2Lead")} pending={pendingDims} pendingLabel={t("dimPendingTag")} />
      <p className="mt-3 text-sm text-ink">
        {chosen ? t("structureChosen", { name: schemeName }) : t("structureUndecided", { name: schemeName })}
      </p>
      <div className="mt-2">
        <HoverNote label={t("howToDecor")}>{t("howToDecorBody")}</HoverNote>
      </div>
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_11.5rem]">
        <div>
          {main ? (
            <HotspotStage
              still={main}
              badge={main.origin === "seedream" ? t("stillSeedream") : main.origin === "sample" ? t("stillSample") : undefined}
              spots={scheme.hotspots}
              preset={working}
              presets={presets}
              fixtureChoices={(fixtureAxis?.choices ?? []).map((choice) => ({ id: choice.key, label: choice.label, color: choice.color }))}
              decisions={selection.decisions}
              preview={selection.preview}
              fixtureSwatch={selection.fixtureSwatch}
              onDecide={onDecide}
              onUnselect={onUnselect}
              onPreview={onPreview}
              onRestore={onRestore}
              onTileSwatch={onTileSwatch}
              onFixtureSwatch={onFixtureSwatch}
              onOpen={() => onOpen(main)}
            />
          ) : null}
          <div className="mt-3 flex flex-wrap gap-4">
            {project.decor.axes.map((axis) => (
              <div key={axis.key}>
                <p className="text-xs text-muted">{axis.label}</p>
                <div className="mt-1">
                  <Swatches
                    items={axis.choices.map((choice) => ({ id: choice.key, label: choice.label, color: choice.color }))}
                    value={selection.colors[axis.key] ?? null}
                    onChange={(id) => onColors({ ...selection.colors, [axis.key]: id })}
                  />
                </div>
              </div>
            ))}
          </div>
          {scheme.decorMode !== "colorGrid" && project.decor.limitedNote ? (
            <p className="mt-2 text-xs text-muted">{project.decor.limitedNote}</p>
          ) : null}
          <div className="mt-3">
            {colorPending ? (
              <Button variant="primary" onClick={onCommitColors}>
                {t("commitColors")}
              </Button>
            ) : (
              <p className="text-xs text-copper">{t("colorsSaved")}</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {setPending ? (
              <>
                <span className="text-xs text-muted">{t("previewSet", { name: working.name })}</span>
                <Button variant="primary" onClick={onCommitPreset}>
                  {t("commitSet")}
                </Button>
                <Button onClick={onRestorePreset}>{t("restore")}</Button>
              </>
            ) : selection.decorPreset === working.key ? (
              <span className="text-xs text-copper">{t("committedSet", { name: working.name })}</span>
            ) : (
              <span className="text-xs text-muted">{t("decorHint")}</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {project.decor.compareRows.map((row) => (
              <HoverNote key={row.label} label={row.label}>
                {row.byPreset[working.key] ?? ""}
              </HoverNote>
            ))}
          </div>
          {Object.entries(selection.preview).length > 0 ? (
            <div className="mt-3 space-y-2">
              {Object.entries(selection.preview).map(([category, presetKey]) => {
                const from = presets.find((item) => item.key === presetKey);
                return (
                  <div key={category} className="flex flex-wrap items-center gap-2">
                    <p className="text-sm">{t("previewChip", { category: categoryLabel(category), preset: from?.name ?? presetKey })}</p>
                    <Button onClick={() => onRestore(category)}>{t("restore")}</Button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className="flex gap-3 overflow-x-auto lg:flex-col">
          {presets.map((preset) => {
            const thumb = overlaySeedream(
              presetStill(scheme, preset, scheme.decorMode === "colorGrid" ? {} : selection.preview, splash),
              scheme.key,
              { kind: "finish", presetKey: preset.key },
              project.seedream,
            );
            const isOn = scheme.decorMode === "colorGrid" ? colorsEqual(selection.colors, preset.colors) : preset.key === working.key;
            const committed = selection.decorPreset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => onPickPreset(preset.key)}
                className={`w-40 shrink-0 overflow-hidden rounded-lg border text-left lg:w-full ${
                  isOn ? "border-copper" : "border-line"
                } ${committed ? "bg-copperSoft" : "bg-paper"}`}
              >
                {thumb ? (
                  <FrameImage
                    src={thumb.src}
                    alt={thumb.alt}
                    frames={thumb.frames}
                    frame={thumb.frame}
                    badge={thumb.origin === "seedream" ? t("stillSeedream") : thumb.origin === "sample" ? t("stillSample") : undefined}
                  />
                ) : null}
                <span className="block px-2 py-1.5">
                  <span className="block text-xs font-medium">{locale === "en" && preset.nameEn ? preset.nameEn : preset.name}</span>
                  <ImpactTag cost={preset.costBand} timeline={preset.timelineBand} significant={preset.significant} timeLabel={t("impactTime")} />
                  <span className="mt-0.5 block text-xs text-muted">
                    {committed ? t("thumbCommitted") : setPending && isOn ? t("thumbPreview") : t("thumbApply")}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
