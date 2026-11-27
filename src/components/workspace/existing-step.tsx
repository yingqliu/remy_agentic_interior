"use client";

import type { ProjectDTO, SelectionState } from "@/lib/types";
import { missingDimensions } from "@/lib/selection";
import { Button } from "@/components/ui";
import { FrameImage } from "./frame-image";
import { useT } from "./locale";
import { PlanView } from "./plan-view";

export function ExistingStep({
  project,
  selection,
  onMode,
  onDimension,
  onFillExample,
}: {
  project: ProjectDTO;
  selection: SelectionState;
  onMode: (mode: "upload" | "manual") => void;
  onDimension: (id: string, text: string) => void;
  onFillExample: () => void;
}) {
  const { t } = useT();
  const missing = missingDimensions(project, selection);
  return (
    <section id="step-0" className="scroll-mt-24">
      <StepHeading index="0" title={t("step0")} lead={t("step0Lead")} pending={missing.length > 0} pendingLabel={t("dimPendingTag")} />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <figure>
          <FrameImage src={project.room.beforeSrc} alt={project.room.beforeAlt} />
          <figcaption className="mt-2 text-xs text-muted">{project.room.beforeCaption}</figcaption>
        </figure>
        <PlanView plan={project.room.plan} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-line bg-paper p-0.5">
          {(["upload", "manual"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onMode(mode)}
              className={`rounded-full px-3 py-1 text-sm ${selection.dimensionMode === mode ? "bg-ink text-paper" : "text-ink"}`}
            >
              {mode === "upload" ? t("uploadPlan") : t("manualDims")}
            </button>
          ))}
        </div>
        {selection.dimensionMode === "manual" ? (
          <Button type="button" onClick={onFillExample}>
            {t("fillExample")}
          </Button>
        ) : null}
        {missing.length > 0 ? <span className="rounded-full border border-line px-2 py-0.5 text-xs text-copper">{t("dimPendingTag")}</span> : null}
      </div>
      <div className={`mt-4 grid gap-3 ${selection.dimensionMode === "manual" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
        {project.room.dimensions.map((field) => {
          const value = selection.dimensions[field.id] ?? { text: "", source: "" as const };
          const filled = Boolean(value.text.trim());
          const tag = !filled ? t("dimPendingTag") : value.source === "plan" ? t("dimFromPlan") : value.source === "example" ? t("dimExample") : "";
          return (
            <label key={field.id} className="block">
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {field.label}
                {tag ? <span>{tag}</span> : null}
              </span>
              <input
                value={value.text}
                placeholder={t("dimPlaceholder")}
                onChange={(event) => onDimension(field.id, event.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1.5 text-sm"
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}

export function StepHeading({
  index,
  title,
  lead,
  pending,
  pendingLabel,
}: {
  index: string;
  title: string;
  lead: string;
  pending?: boolean;
  pendingLabel?: string;
}) {
  return (
    <div>
      <h2 className="flex items-baseline gap-3 font-display text-2xl">
        {index ? <span className="text-copper">{index}</span> : null}
        {title}
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{lead}</p>
      {pending && pendingLabel ? <p className="mt-2 text-xs text-copper">{pendingLabel}</p> : null}
    </div>
  );
}
