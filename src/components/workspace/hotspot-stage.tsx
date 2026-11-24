"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DecorPreset, HotspotDTO } from "@/lib/types";
import { Button, Swatches } from "@/components/ui";
import { FrameImage } from "./frame-image";
import { useT } from "./locale";
import type { Still } from "@/lib/visuals";

export function HotspotStage({
  still,
  spots,
  preset,
  presets,
  fixtureChoices,
  decisions,
  preview,
  fixtureSwatch,
  onDecide,
  onUnselect,
  onPreview,
  onRestore,
  onTileSwatch,
  onFixtureSwatch,
  onOpen,
}: {
  still: Still;
  spots: HotspotDTO[];
  preset: DecorPreset;
  presets: DecorPreset[];
  fixtureChoices: { id: string; label: string; color: string }[];
  decisions: Record<string, "selected">;
  preview: Record<string, string>;
  fixtureSwatch: string | null;
  onDecide: (presetKey: string, hotspotKey: string) => void;
  onUnselect: (presetKey: string, hotspotKey: string) => void;
  onPreview: (presetKey: string, hotspotKey: string) => void;
  onRestore: (category: string) => void;
  onTileSwatch: (presetKey: string) => void;
  onFixtureSwatch: (choiceKey: string) => void;
  onOpen: () => void;
}) {
  const { t } = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [imageHot, setImageHot] = useState(false);
  const [notes, setNotes] = useState(false);
  const leaveTimer = useRef<number | null>(null);
  const active = spots.find((spot) => spot.key === openId) ?? null;
  const reveal = imageHot || openId != null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const show = (id: string) => {
    if (leaveTimer.current != null) window.clearTimeout(leaveTimer.current);
    setOpenId(id);
    setNotes(false);
  };
  const scheduleHide = () => {
    if (leaveTimer.current != null) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setOpenId(null), 160);
  };

  const statusOf = (spot: HotspotDTO): "selected" | "preview" | null => {
    if (decisions[`${preset.key}:${spot.key}`] === "selected") return "selected";
    if (preview[spot.category]) return "preview";
    return null;
  };

  const titleOf = (spot: HotspotDTO) => {
    const own = spot.titles?.[preset.key] ?? spot.title ?? spot.key;
    const fromKey = preview[spot.category];
    if (spot.category === "tile" && fromKey && fromKey !== preset.key) {
      const from = presets.find((item) => item.key === fromKey);
      const fromTitle = spot.titles?.[fromKey] ?? from?.name ?? own;
      return `${fromTitle}（套用自${from?.name ?? fromKey}）`;
    }
    return own;
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      onMouseEnter={() => setImageHot(true)}
      onMouseLeave={() => {
        setImageHot(false);
        setHoverId(null);
        scheduleHide();
      }}
      onClick={() => {
        if (openId) {
          setOpenId(null);
          return;
        }
        onOpen();
      }}
    >
      <FrameImage src={still.src} alt={still.alt} frames={still.frames} frame={still.frame} />
      {still.note ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[3] rounded bg-paper/90 px-2 py-1 text-xs text-ink">
          {still.note}
        </div>
      ) : null}
      {spots.map((spot) => {
        const status = statusOf(spot);
        const isOpen = openId === spot.key;
        const labeled = isOpen || hoverId === spot.key;
        return (
          <div
            key={spot.key}
            className="absolute"
            style={{ left: `${spot.x}%`, top: `${spot.y}%`, transform: "translate(-50%, -50%)", zIndex: isOpen ? 8 : 2 }}
            onMouseEnter={() => {
              setHoverId(spot.key);
              show(spot.key);
            }}
            onMouseLeave={() => {
              setHoverId(null);
              scheduleHide();
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label={
                status === "selected"
                  ? `${titleOf(spot)}，${t("select")}`
                  : status === "preview"
                    ? `${titleOf(spot)}，${t("applyAll")}`
                    : titleOf(spot)
              }
              aria-expanded={isOpen}
              className="flex h-8 w-8 items-center justify-center"
              onClick={() => setOpenId(isOpen ? null : spot.key)}
            >
              <span
                className="block rounded-full border-2 border-paper"
                style={{
                  width: reveal ? 12 : 10,
                  height: reveal ? 12 : 10,
                  opacity: reveal ? 1 : 0.35,
                  background: !reveal ? "transparent" : status === "selected" ? "#1f6b45" : status === "preview" ? "#9a4e32" : "#1c1916",
                  boxShadow: reveal ? "0 0 0 1px rgba(28,25,22,0.45)" : "none",
                }}
              />
            </button>
            {labeled ? (
              <span className="pointer-events-none absolute left-8 top-1 whitespace-nowrap rounded border border-line bg-paper px-1.5 py-0.5 text-xs text-ink shadow-card">
                {titleOf(spot)}
              </span>
            ) : null}
          </div>
        );
      })}
      {active ? (
        <div
          role="dialog"
          aria-label={titleOf(active)}
          className="absolute z-10 max-h-[calc(100%-16px)] w-60 overflow-auto rounded-lg border border-line bg-paper p-3 text-left shadow-card"
          style={popoverStyle(active.x, active.y)}
          onClick={(event) => event.stopPropagation()}
          onMouseEnter={() => show(active.key)}
          onMouseLeave={scheduleHide}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug">{titleOf(active)}</p>
            <button type="button" className="shrink-0 text-xs text-muted underline" onClick={() => setNotes((value) => !value)}>
              {t("explain")}
            </button>
          </div>
          {notes ? (
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {t("designIdea")}：{preview[active.category] && active.previewIdea ? active.previewIdea : active.idea} {t("structureNote")}：{active.structure} {t("permit")}：{active.permit} {t("explainIntro")}
            </p>
          ) : null}
          {active.significant && (active.costBand || active.timelineBand) ? (
            <p className="mt-2 text-xs text-copper">
              {active.costBand ? `${t("impactCost")} ${active.costBand}` : ""}
              {active.costBand && active.timelineBand ? " · " : ""}
              {active.timelineBand ? `${t("impactTime")} ${active.timelineBand}` : ""}
            </p>
          ) : null}
          {active.swatches === "presets" ? (
            <div className="mt-2">
              <Swatches
                items={presets.map((item) => ({ id: item.key, label: item.swatch.label, color: item.swatch.color }))}
                value={preview.tile ?? preset.key}
                onChange={onTileSwatch}
              />
            </div>
          ) : null}
          {active.swatches === "fixture" ? (
            <div className="mt-2">
              <Swatches
                items={fixtureChoices}
                value={fixtureSwatch ?? preset.fixtureSwatchDefault ?? null}
                onChange={onFixtureSwatch}
              />
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant={statusOf(active) === "selected" ? "primary" : "quiet"} onClick={() => onDecide(preset.key, active.key)}>
              {t("select")}
            </Button>
            <Button variant="quiet" disabled={statusOf(active) !== "selected"} onClick={() => onUnselect(preset.key, active.key)}>
              {t("unselect")}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant={statusOf(active) === "preview" ? "primary" : "quiet"} onClick={() => onPreview(preset.key, active.key)}>
              {t("applyAll")}
            </Button>
            <Button variant="quiet" disabled={!preview[active.category]} onClick={() => onRestore(active.category)}>
              {t("restore")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function popoverStyle(x: number, y: number): CSSProperties {
  return {
    left: x >= 50 ? "auto" : `clamp(8px, calc(${x}% + 18px), calc(100% - 248px))`,
    right: x >= 50 ? `clamp(8px, calc(${100 - x}% + 18px), calc(100% - 248px))` : "auto",
    top: y >= 62 ? "auto" : `clamp(8px, calc(${y}% + 18px), calc(100% - 16px))`,
    bottom: y >= 62 ? `clamp(8px, calc(${100 - y}% + 18px), calc(100% - 16px))` : "auto",
  };
}
