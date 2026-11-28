"use client";

import { useState } from "react";

export function HoverNote({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  const place = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const width = 256;
    setAnchor({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    });
    setOpen(true);
  };

  return (
    <span className="inline-flex" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="border-b border-dashed border-line text-xs text-muted"
        aria-expanded={open}
        onMouseEnter={(event) => place(event.currentTarget)}
        onClick={(event) => {
          if (open) setOpen(false);
          else place(event.currentTarget);
        }}
      >
        {label}
      </button>
      {open && anchor ? (
        <span
          className="fixed z-30 w-64 rounded-md border border-line bg-paper p-2 text-left text-xs leading-relaxed text-ink shadow-card"
          style={{ top: anchor.top, left: anchor.left }}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
