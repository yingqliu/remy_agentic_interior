"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectDTO, SchemeDTO, SelectionState } from "@/lib/types";
import { resolveCompareText, schemeOptions, structureStill } from "@/lib/visuals";
import { Button, Pill } from "@/components/ui";
import { FrameImage } from "./frame-image";
import { HoverNote } from "./hover-note";
import { useT } from "./locale";
import { PlanView } from "./plan-view";
import { StepHeading } from "./existing-step";
import { missingDimensions } from "@/lib/selection";
import type { Still } from "@/lib/visuals";

export function StructureStep({
  project,
  selection,
  onOption,
  onStructure,
  onOpen,
}: {
  project: ProjectDTO;
  selection: SelectionState;
  onOption: (schemeKey: string, groupKey: string, optionKey: string) => void;
  onStructure: (key: string | "maybe") => void;
  onOpen: (still: Still) => void;
}) {
  const { t, locale } = useT();
  const pending = missingDimensions(project, selection).length > 0;
  const [activeFactor, setActiveFactor] = useState<string | null>(null);
  const compareRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeFactor) return;
    compareRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeFactor]);
  const schemeName = (scheme: SchemeDTO) => (locale === "en" && scheme.nameEn ? scheme.nameEn : scheme.name);
  const factorText = (scheme: SchemeDTO, label: string) => {
    const row = scheme.compareRows.find((item) => item.label === label);
    if (!row) return "";
    return resolveCompareText(row.variants, schemeOptions(scheme, selection));
  };
  const toggleFactor = (label: string) => {
    setActiveFactor((current) => (current === label ? null : label));
  };
  if (project.schemes.length === 0) {
    return (
      <section id="step-1" className="scroll-mt-24">
        <StepHeading index="1" title={t("step1")} lead={t("step1Lead")} />
        <div className="mt-4 rounded-lg border border-dashed border-line bg-paper p-4">
          <p className="font-medium">{t("emptySchemes")}</p>
          <p className="mt-1 text-sm text-muted">{t("emptySchemesBody")}</p>
        </div>
      </section>
    );
  }
  return (
    <section id="step-1" className="scroll-mt-24">
      <StepHeading index="1" title={t("step1")} lead={t("step1Lead")} pending={pending} pendingLabel={t("dimPendingTag")} />
      <div className="mt-3">
        <HoverNote label={t("howToLook")}>{t("howToLookBody")}</HoverNote>
      </div>
      <div className="mt-4 overflow-x-auto pb-2">
        <div className="grid min-w-[960px] grid-cols-4 gap-4">
          {project.schemes.map((scheme) => {
            const still = structureStill(scheme, selection);
            const options = schemeOptions(scheme, selection);
            const name = schemeName(scheme);
            return (
              <article key={scheme.key} className="min-w-0">
                <h3 className="text-base font-medium">{name}</h3>
                {scheme.summary ? <p className="mt-1 text-xs text-copper">{scheme.summary}</p> : null}
                {still ? (
                  <div className="mt-2">
                    <FrameImage
                      src={still.src}
                      alt={still.alt}
                      frames={still.frames}
                      frame={still.frame}
                      onClick={() => onOpen(still)}
                    />
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {t("noNewDecor")}
                      {still.note ? `。${still.note}` : ""}
                    </p>
                  </div>
                ) : null}
                <div className="mt-3 space-y-3">
                  {scheme.optionGroups.map((group) => {
                    if (group.unavailableReason) return null;
                    const current = options[group.key];
                    const label = locale === "en" && group.labelEn ? group.labelEn : group.label;
                    const active = group.options.find((option) => option.key === current);
                    return (
                      <div key={group.key}>
                        <p className="text-xs text-muted">{label}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {group.options.map((option) => (
                            <Pill
                              key={option.key}
                              label={locale === "en" && option.labelEn ? option.labelEn : option.label}
                              active={current === option.key}
                              onClick={() => onOption(scheme.key, group.key, option.key)}
                            />
                          ))}
                        </div>
                        {active?.detail ? <p className="mt-1 text-xs text-muted">{active.detail}</p> : null}
                      </div>
                    );
                  })}
                </div>
                {scheme.plan ? (
                  <div className="mt-3">
                    <PlanView plan={scheme.plan} />
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                  {scheme.compareRows.map((row) => {
                    const pressed = activeFactor === row.label;
                    return (
                      <button
                        key={row.label}
                        type="button"
                        aria-pressed={pressed}
                        aria-controls={pressed ? "scheme-compare" : undefined}
                        onClick={() => toggleFactor(row.label)}
                        className={`border-b pb-0.5 text-left text-xs ${
                          pressed ? "border-solid border-copper font-medium text-copper" : "border-dashed border-line text-muted hover:text-ink"
                        }`}
                      >
                        {row.label}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      {activeFactor ? (
        <div ref={compareRef} id="scheme-compare" role="region" aria-label={t("compareFactors")} className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{activeFactor}</p>
            <button type="button" className="text-xs text-muted underline decoration-line underline-offset-2 hover:text-ink" onClick={() => setActiveFactor(null)}>
              {t("compareClose")}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 min-[992px]:grid-cols-4 min-[992px]:gap-4">
            {project.schemes.map((scheme) => (
              <div key={scheme.key} className="rounded-md border border-line bg-paper p-3">
                <p className="text-xs font-medium">{schemeName(scheme)}</p>
                <p className="mt-1 text-xs leading-relaxed">{factorText(scheme, activeFactor)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {project.schemes.map((scheme) => (
          <Button key={scheme.key} variant={selection.structureKey === scheme.key ? "primary" : "quiet"} onClick={() => onStructure(scheme.key)}>
            {locale === "en" && scheme.nameEn ? scheme.nameEn : scheme.name}
          </Button>
        ))}
        <Button variant={selection.structureKey === "maybe" ? "primary" : "quiet"} onClick={() => onStructure("maybe")}>
          {t("thinkAgain")}
        </Button>
      </div>
    </section>
  );
}
