"use client";

import type { ProjectDTO, SelectionState } from "@/lib/types";
import { buildSummary, hasCommit, hasPreview, missingDimensions } from "@/lib/selection";
import { Button } from "@/components/ui";
import { FrameImage, HotspotThumb } from "./frame-image";
import { HoverNote } from "./hover-note";
import { useT } from "./locale";
import { StepHeading } from "./existing-step";

export function SummaryStep({
  project,
  selection,
  onReset,
}: {
  project: ProjectDTO;
  selection: SelectionState;
  onReset: () => void;
}) {
  const { t, locale } = useT();
  const summary = buildSummary(project, selection);
  const committed = hasCommit(project, selection);
  const pending = missingDimensions(project, selection).length > 0;
  const previewing = hasPreview(project, selection);
  const scheme = project.schemes.find((item) => item.key === selection.structureKey);
  const direction = project.decor.presets.find((item) => item.key === selection.decorPreset);
  return (
    <section id="summary" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <StepHeading index="" title={t("summary")} lead={t("summaryHelp")} pending={pending} pendingLabel={t("dimPendingTag")} />
        <Button onClick={onReset} disabled={!committed && !previewing}>
          {t("reset")}
        </Button>
      </div>
      {!committed ? (
        <p className="mt-4 text-sm">{t("summaryEmpty")}</p>
      ) : (
        <div className="mt-4 space-y-4">
          <h3 className="text-sm font-medium">{t("decidedImage")}</h3>
          {summary.still ? (
            <figure>
              <FrameImage src={summary.still.src} alt={t("conceptAlt")} frames={summary.still.frames} frame={summary.still.frame} />
              <figcaption className="mt-1 text-xs text-muted">
                {summary.structureUnsetImage && scheme == null
                  ? t("structurePreviewCaption", {
                      name:
                        locale === "en" && project.schemes[0]?.nameEn
                          ? project.schemes[0].nameEn
                          : (project.schemes[0]?.name ?? ""),
                    })
                  : summary.exact
                    ? t("conceptExact")
                    : t("conceptNearest")}
              </figcaption>
            </figure>
          ) : (
            <p className="text-sm text-muted">{t("needDirection")}</p>
          )}
          <div>
            <h3 className="text-sm font-medium">{t("listTitle")}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {summary.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-muted">{summary.exact && !summary.structureUnsetImage ? t("exactFoot") : t("inexactFoot")}</p>
        </div>
      )}
      {direction ? (
        <p className="mt-3 text-sm">
          {t("step2")}：{locale === "en" && direction.nameEn ? direction.nameEn : direction.name}
        </p>
      ) : null}
      {scheme ? <p className="text-sm">{t("step1")}：{locale === "en" && scheme.nameEn ? scheme.nameEn : scheme.name}</p> : null}
      {selection.structureKey === "maybe" ? <p className="text-sm">{t("structureMaybe")}</p> : null}
      {summary.selected.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium">{t("selectedHeading")}</h3>
          <ul className="mt-2 space-y-2">
            {summary.selected.map((item) => (
              <li key={`${item.presetKey}:${item.key}`} className="flex items-center gap-3">
                {item.still ? (
                  <HotspotThumb src={item.still.src} alt={item.title} x={item.x} y={item.y} frames={item.still.frames} frame={item.still.frame} />
                ) : null}
                <span>
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="block text-xs text-muted">{item.presetName}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="sr-only">{previewing ? "preview" : "no preview"}</p>
    </section>
  );
}

export function OpenItems({ items }: { items: string[] }) {
  const { t } = useT();
  if (items.length === 0) return null;
  return (
    <section className="scroll-mt-24">
      <h2 className="font-display text-2xl">{t("openItems")}</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function Principles({ project }: { project: ProjectDTO }) {
  const { t } = useT();
  if (project.principles.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      <span className="text-xs text-muted">{t("principles")}</span>
      {project.principles.map((item) => (
        <HoverNote key={item.label} label={item.label}>
          {item.value}
        </HoverNote>
      ))}
    </div>
  );
}
