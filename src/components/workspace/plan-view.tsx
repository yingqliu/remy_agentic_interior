"use client";

import { useRef, useState } from "react";
import type { PlanCamera, PlanDTO, PlanShape } from "@/lib/types";
import { Button } from "@/components/ui";
import { useT } from "./locale";

const FILL: Record<string, string> = {
  room: "#f6f1ea",
  wet: "#f6e7e0",
  fixture: "#fffcf8",
  accent: "#9a4e32",
  base: "#f3efe8",
  none: "transparent",
};

function parseViewBox(viewBox: string) {
  const [, , width, height] = viewBox.split(/[\s,]+/).map(Number);
  return { width: width || 200, height: height || 300 };
}

function Shape({ shape }: { shape: PlanShape }) {
  if (shape.type === "rect") {
    return (
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        rx={shape.rx}
        fill={FILL[shape.fill ?? "none"]}
        stroke="#1c1916"
        strokeWidth={shape.fill === "room" ? 1.5 : 1}
        strokeDasharray={shape.dashed ? "3 2" : undefined}
      />
    );
  }
  if (shape.type === "line") {
    return <line x1={shape.x} y1={shape.y} x2={shape.x2} y2={shape.y2} stroke="#1c1916" strokeWidth={1.4} />;
  }
  const fill = shape.fill === "muted" ? "#6f675f" : shape.fill === "onAccent" ? "#fffcf8" : "#1c1916";
  return (
    <text
      x={shape.x}
      y={shape.y}
      fontSize={shape.size ?? 7}
      textAnchor={shape.anchor ?? "start"}
      fill={fill}
      transform={shape.rotate ? `rotate(${shape.rotate} ${shape.x} ${shape.y})` : undefined}
    >
      {shape.text}
    </text>
  );
}

export function PlanView({ plan }: { plan: PlanDTO }) {
  const { t } = useT();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mode = useRef<"move" | "rotate" | null>(null);
  const [camera, setCamera] = useState<PlanCamera>(plan.camera ?? { x: 50, y: 80, angle: -90 });
  const [confirmed, setConfirmed] = useState(false);
  const [dragOn, setDragOn] = useState(false);
  const box = parseViewBox(plan.viewBox);
  const dragEnabled = Boolean(plan.interactive) && dragOn && !confirmed;

  const toPct = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.max(8, Math.min(92, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(6, Math.min(96, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const cx = (camera.x / 100) * box.width;
  const cy = (camera.y / 100) * box.height;
  const len = box.height * 0.22;
  const fov = 46;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const r1 = rad(camera.angle - fov / 2);
  const r2 = rad(camera.angle + fov / 2);
  const cone = `M ${cx} ${cy} L ${cx + Math.cos(r1) * len} ${cy + Math.sin(r1) * len} A ${len} ${len} 0 0 1 ${cx + Math.cos(r2) * len} ${cy + Math.sin(r2) * len} Z`;
  const tipX = cx + Math.cos(rad(camera.angle)) * (len + 6);
  const tipY = cy + Math.sin(rad(camera.angle)) * (len + 6);

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={plan.viewBox}
        className="w-full rounded-lg border border-line bg-paper"
        style={{ touchAction: dragEnabled ? "none" : "auto", cursor: dragEnabled ? "grab" : "default" }}
        onPointerMove={(event) => {
          if (!dragEnabled || !mode.current) return;
          const pct = toPct(event);
          if (!pct) return;
          if (mode.current === "move") setCamera((prev) => ({ ...prev, x: pct.x, y: pct.y }));
          else {
            const angle = (Math.atan2(pct.y - camera.y, pct.x - camera.x) * 180) / Math.PI;
            setCamera((prev) => ({ ...prev, angle }));
          }
        }}
        onPointerUp={() => {
          mode.current = null;
        }}
        onPointerLeave={() => {
          mode.current = null;
        }}
      >
        {plan.shapes.map((shape, index) => (
          <Shape key={index} shape={shape} />
        ))}
        {plan.interactive ? (
          <>
            <path d={cone} fill="rgba(154,78,50,0.18)" stroke="#9a4e32" strokeWidth={1} />
            <circle
              cx={cx}
              cy={cy}
              r={5}
              fill="#9a4e32"
              stroke="#fffcf8"
              strokeWidth={1.5}
              style={{ cursor: dragEnabled ? "grab" : "default" }}
              onPointerDown={(event) => {
                if (!dragEnabled) return;
                event.stopPropagation();
                mode.current = "move";
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
            />
            <circle
              cx={tipX}
              cy={tipY}
              r={3.5}
              fill="#fffcf8"
              stroke="#9a4e32"
              strokeWidth={1.5}
              style={{ cursor: dragEnabled ? "crosshair" : "default" }}
              onPointerDown={(event) => {
                if (!dragEnabled) return;
                event.stopPropagation();
                mode.current = "rotate";
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
            />
            <text x={cx + 8} y={cy + 14} fontSize={7} fill="#9a4e32">
              {confirmed ? t("cameraConfirmed") : t("cameraGuess")}
            </text>
          </>
        ) : null}
      </svg>
      {plan.interactive ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant={confirmed ? "primary" : "quiet"}
            onClick={() => {
              setConfirmed(true);
              setDragOn(false);
            }}
          >
            {t("confirmCamera")}
          </Button>
          <Button
            variant={dragOn && !confirmed ? "primary" : "quiet"}
            onClick={() => {
              setConfirmed(false);
              setDragOn(true);
            }}
          >
            {t("dragCamera")}
          </Button>
        </div>
      ) : null}
      {plan.note ? <p className="mt-2 text-xs leading-relaxed text-muted">{plan.note}</p> : null}
    </div>
  );
}
