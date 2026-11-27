"use client";

import { useEffect, useRef, useState } from "react";
import type { GenerationDTO, Locale, ProjectDTO, SelectionState } from "@/lib/types";
import { activeScheme, presetByColors } from "@/lib/visuals";
import type { Still } from "@/lib/visuals";
import { decisionKey, defaultSelection } from "@/lib/selection";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui";
import { DecorStep } from "./decor-step";
import { ExistingStep } from "./existing-step";
import { FrameImage } from "./frame-image";
import { LocaleProvider, useT } from "./locale";
import { OpenItems, Principles, SummaryStep } from "./summary-step";
import { StructureStep } from "./structure-step";

export function ProjectWorkspace({
  project,
  mode,
  initialSelection,
}: {
  project: ProjectDTO;
  mode: "designer" | "client";
  initialSelection: SelectionState;
}) {
  const [locale, setLocale] = useState<Locale>(project.locale);
  const [selection, setSelection] = useState(initialSelection);
  const [lightbox, setLightbox] = useState<Still | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const [generations, setGenerations] = useState<GenerationDTO[]>(project.generations);
  const [generating, setGenerating] = useState(false);
  const latest = useRef(initialSelection);
  const dirty = useRef(false);
  const running = useRef(false);
  const timer = useRef<number | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const stored = window.localStorage.getItem("remy-locale");
    if (stored === "en" || stored === "zh") setLocale(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-Hans";
    window.localStorage.setItem("remy-locale", locale);
  }, [locale]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function flush() {
    if (running.current) return;
    running.current = true;
    try {
      while (dirty.current) {
        dirty.current = false;
        const payload = latest.current;
        const response = await fetch(`/api/share/${project.shareToken}/selection`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("save");
      }
      setStatus("saved");
    } catch {
      dirty.current = true;
      setStatus("error");
    } finally {
      running.current = false;
    }
  }

  function apply(recipe: (state: SelectionState) => SelectionState, immediate: boolean) {
    const next = recipe(latest.current);
    latest.current = next;
    setSelection(next);
    dirty.current = true;
    setStatus("saving");
    if (timer.current != null) window.clearTimeout(timer.current);
    if (immediate) void flush();
    else timer.current = window.setTimeout(() => void flush(), 350);
  }

  flushRef.current = flush;

  useEffect(() => {
    const onHide = () => {
      if (dirty.current) void flushRef.current();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const sharePath = `/c/${project.shareToken}`;

  return (
    <LocaleProvider locale={locale}>
      <WorkspaceBody
        project={project}
        mode={mode}
        selection={selection}
        locale={locale}
        setLocale={setLocale}
        status={status}
        copied={copied}
        sharePath={sharePath}
        onCopy={async () => {
          const url = `${window.location.origin}${sharePath}`;
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }}
        lightbox={lightbox}
        setLightbox={setLightbox}
        generations={generations}
        generating={generating}
        onGenerate={async () => {
          setGenerating(true);
          try {
            const response = await fetch(`/api/projects/${project.slug}/generate`, { method: "POST" });
            if (!response.ok) return;
            const body = (await response.json()) as { generation: GenerationDTO };
            setGenerations((prev) => [body.generation, ...prev]);
          } finally {
            setGenerating(false);
          }
        }}
        onMode={(dimensionMode) =>
          apply((state) => {
            const dimensions = { ...state.dimensions };
            for (const field of project.room.dimensions) {
              dimensions[field.id] =
                dimensionMode === "upload"
                  ? { text: field.example, source: "plan" }
                  : { text: "", source: "" };
            }
            return { ...state, dimensionMode, dimensions };
          }, true)
        }
        onDimension={(id, text) =>
          apply(
            (state) => ({
              ...state,
              dimensions: { ...state.dimensions, [id]: { text, source: "user" } },
            }),
            false,
          )
        }
        onFillExample={() =>
          apply((state) => {
            const dimensions = { ...state.dimensions };
            for (const field of project.room.dimensions) {
              dimensions[field.id] = { text: field.example, source: "example" };
            }
            return { ...state, dimensions };
          }, true)
        }
        onOption={(schemeKey, groupKey, optionKey) =>
          apply(
            (state) => ({
              ...state,
              schemeOptions: {
                ...state.schemeOptions,
                [schemeKey]: { ...state.schemeOptions[schemeKey], [groupKey]: optionKey },
              },
            }),
            true,
          )
        }
        onStructure={(key) => apply((state) => ({ ...state, structureKey: key }), true)}
        onColors={(colors) =>
          apply((state) => {
            const scheme = activeScheme(project, state);
            const match = presetByColors(project.decor.presets, colors);
            let pendingPreset = state.pendingPreset;
            let fixtureSwatch = state.fixtureSwatch;
            if (match) {
              pendingPreset = state.decorPreset === match.key ? null : match.key;
              fixtureSwatch = colors.fixture ?? fixtureSwatch;
            } else if (scheme?.decorMode === "colorGrid") {
              pendingPreset = null;
            }
            return { ...state, colors, pendingPreset, fixtureSwatch };
          }, true)
        }
        onPickPreset={(key) =>
          apply((state) => {
            const preset = project.decor.presets.find((item) => item.key === key);
            if (!preset) return state;
            const already = state.decorPreset === key;
            return {
              ...state,
              preview: {},
              colors: { ...preset.colors },
              pendingPreset: already ? null : key,
              fixtureSwatch: already ? state.committedFixture : (preset.colors.fixture ?? null),
            };
          }, true)
        }
        onCommitPreset={() =>
          apply((state) => {
            const id = state.pendingPreset ?? state.decorPreset ?? project.decor.presets[0]?.key ?? null;
            return { ...state, decorPreset: id, pendingPreset: null, committedColors: state.colors };
          }, true)
        }
        onRestorePreset={() =>
          apply((state) => {
            const fallback =
              state.committedColors ??
              project.decor.presets.find((item) => item.key === state.decorPreset)?.colors ??
              project.decor.presets[0]?.colors ??
              {};
            return {
              ...state,
              pendingPreset: null,
              preview: {},
              fixtureSwatch: state.committedFixture,
              colors: { ...fallback },
            };
          }, true)
        }
        onCommitColors={() =>
          apply((state) => {
            const match = presetByColors(project.decor.presets, state.colors);
            return {
              ...state,
              committedColors: state.colors,
              decorPreset: match ? match.key : state.decorPreset,
              pendingPreset: match ? null : state.pendingPreset,
            };
          }, true)
        }
        onDecide={(presetKey, hotspotKey) =>
          apply((state) => {
            const scheme = activeScheme(project, state);
            const spot = scheme?.hotspots.find((item) => item.key === hotspotKey);
            const decisions = { ...state.decisions };
            for (const preset of project.decor.presets) {
              if (preset.key !== presetKey) delete decisions[decisionKey(preset.key, hotspotKey)];
            }
            decisions[decisionKey(presetKey, hotspotKey)] = "selected";
            return {
              ...state,
              decisions,
              committedTile: spot?.category === "tile" ? (state.preview.tile ?? presetKey) : state.committedTile,
              committedFixture: spot?.category === "shower" && state.fixtureSwatch ? state.fixtureSwatch : state.committedFixture,
            };
          }, true)
        }
        onUnselect={(presetKey, hotspotKey) =>
          apply((state) => {
            const scheme = activeScheme(project, state);
            const spot = scheme?.hotspots.find((item) => item.key === hotspotKey);
            const decisions = { ...state.decisions };
            delete decisions[decisionKey(presetKey, hotspotKey)];
            return {
              ...state,
              decisions,
              committedTile: spot?.category === "tile" ? null : state.committedTile,
              committedFixture: spot?.category === "shower" ? null : state.committedFixture,
            };
          }, true)
        }
        onPreview={(presetKey, hotspotKey) =>
          apply((state) => {
            const scheme = activeScheme(project, state);
            const spot = scheme?.hotspots.find((item) => item.key === hotspotKey);
            if (!spot) return state;
            return { ...state, preview: { ...state.preview, [spot.category]: presetKey } };
          }, true)
        }
        onRestoreCategory={(category) =>
          apply((state) => {
            const preview = { ...state.preview };
            delete preview[category];
            return {
              ...state,
              preview,
              fixtureSwatch: category === "shower" ? state.committedFixture : state.fixtureSwatch,
            };
          }, true)
        }
        onTileSwatch={(presetKey) => apply((state) => ({ ...state, preview: { ...state.preview, tile: presetKey } }), true)}
        onFixtureSwatch={(choiceKey) => apply((state) => ({ ...state, fixtureSwatch: choiceKey }), true)}
        onReset={() => apply(() => defaultSelection(project), true)}
      />
    </LocaleProvider>
  );
}

function WorkspaceBody(props: {
  project: ProjectDTO;
  mode: "designer" | "client";
  selection: SelectionState;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  status: "idle" | "saving" | "saved" | "error";
  copied: boolean;
  sharePath: string;
  onCopy: () => void;
  lightbox: Still | null;
  setLightbox: (still: Still | null) => void;
  generations: GenerationDTO[];
  generating: boolean;
  onGenerate: () => void;
  onMode: (mode: "upload" | "manual") => void;
  onDimension: (id: string, text: string) => void;
  onFillExample: () => void;
  onOption: (schemeKey: string, groupKey: string, optionKey: string) => void;
  onStructure: (key: string) => void;
  onColors: (colors: Record<string, string>) => void;
  onPickPreset: (key: string) => void;
  onCommitPreset: () => void;
  onRestorePreset: () => void;
  onCommitColors: () => void;
  onDecide: (presetKey: string, hotspotKey: string) => void;
  onUnselect: (presetKey: string, hotspotKey: string) => void;
  onPreview: (presetKey: string, hotspotKey: string) => void;
  onRestoreCategory: (category: string) => void;
  onTileSwatch: (presetKey: string) => void;
  onFixtureSwatch: (choiceKey: string) => void;
  onReset: () => void;
}) {
  const { t } = useT();
  const { project, mode } = props;
  const statusLabel = props.status === "saving" ? t("saveSaving") : props.status === "saved" ? t("saveSaved") : props.status === "error" ? t("saveError") : "";
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Brand href={mode === "designer" ? "/" : undefined} />
          <h1 className="min-w-0 truncate text-sm font-medium">{project.title}</h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">{statusLabel}</span>
            <div className="inline-flex rounded-full border border-line p-0.5 text-xs">
              <button type="button" className={`rounded-full px-2 py-1 ${props.locale === "zh" ? "bg-ink text-paper" : ""}`} onClick={() => props.setLocale("zh")}>
                {t("langZh")}
              </button>
              <button type="button" className={`rounded-full px-2 py-1 ${props.locale === "en" ? "bg-ink text-paper" : ""}`} onClick={() => props.setLocale("en")}>
                {t("langEn")}
              </button>
            </div>
            {mode === "designer" ? (
              <Button type="button" onClick={props.onCopy}>
                {props.copied ? t("copied") : t("copyLink")}
              </Button>
            ) : null}
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-4 pb-2 text-sm">
          <a href="#step-0" className="text-muted hover:text-ink">{t("step0")}</a>
          <a href="#step-1" className="text-muted hover:text-ink">{t("step1")}</a>
          <a href="#step-2" className="text-muted hover:text-ink">{t("step2")}</a>
          <a href="#summary" className="text-muted hover:text-ink">{t("summary")}</a>
        </nav>
      </header>
      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8">
        <p className="max-w-3xl text-sm leading-relaxed text-muted">{project.summary}</p>
        {mode === "client" ? <p className="rounded-lg bg-copperSoft px-3 py-2 text-sm">{t("clientBanner")}</p> : <p className="text-xs text-muted">{t("authBanner")}</p>}
        <section className="grid gap-6 lg:grid-cols-3">
          <FactList title={t("property")} items={project.property} />
          <FactList title={t("household")} items={project.household} />
          <div>
            <h2 className="text-xs uppercase tracking-wider text-muted">{t("requirements")}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed">
              {project.requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
        <Principles project={project} />
        <ExistingStep
          project={project}
          selection={props.selection}
          onMode={props.onMode}
          onDimension={props.onDimension}
          onFillExample={props.onFillExample}
        />
        <StructureStep
          project={project}
          selection={props.selection}
          onOption={props.onOption}
          onStructure={props.onStructure}
          onOpen={props.setLightbox}
        />
        <DecorStep
          project={project}
          selection={props.selection}
          onColors={props.onColors}
          onPickPreset={props.onPickPreset}
          onCommitPreset={props.onCommitPreset}
          onRestorePreset={props.onRestorePreset}
          onCommitColors={props.onCommitColors}
          onDecide={props.onDecide}
          onUnselect={props.onUnselect}
          onPreview={props.onPreview}
          onRestore={props.onRestoreCategory}
          onTileSwatch={props.onTileSwatch}
          onFixtureSwatch={props.onFixtureSwatch}
          onOpen={props.setLightbox}
        />
        <SummaryStep project={project} selection={props.selection} onReset={props.onReset} />
        <OpenItems items={project.openItems} />
        {mode === "designer" ? (
          <section className="rounded-lg border border-line bg-paper p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">{t("generations")}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">{t("generateHelp")}</p>
              </div>
              <Button type="button" variant="primary" disabled={props.generating} onClick={props.onGenerate}>
                {props.generating ? t("generateRunning") : t("generate")}
              </Button>
            </div>
            <ul className="mt-4 space-y-3">
              {props.generations.map((item) => (
                <li key={item.id} className="rounded-md border border-line p-3 text-sm">
                  <p>
                    {item.provider === "http" ? t("providerHttp") : t("providerStub")}
                    {" · "}
                    {item.status === "ready" ? t("statusReady") : item.status === "error" ? t("statusError") : t("statusStubbed")}
                  </p>
                  {item.message ? <p className="mt-1 text-xs text-muted">{item.message}</p> : null}
                  {item.imageSrc ? <img src={item.imageSrc} alt="" className="mt-2 max-h-48 rounded-md" /> : null}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted">{t("promptLabel")}</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted">{item.prompt}</pre>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      {props.lightbox ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={() => props.setLightbox(null)}>
          <div className="w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <FrameImage src={props.lightbox.src} alt={props.lightbox.alt} frames={props.lightbox.frames} frame={props.lightbox.frame} />
            <p className="mt-2 text-xs text-white">{t("closeLightbox")}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FactList({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wider text-muted">{title}</h2>
      <dl className="mt-2 space-y-2 text-sm">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted">{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
