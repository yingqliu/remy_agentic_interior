"use client";

import { useState } from "react";

export function HoverNote({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="border-b border-dashed border-line text-xs text-muted"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open ? (
        <span className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border border-line bg-paper p-2 text-left text-xs leading-relaxed text-ink shadow-card">
          {children}
        </span>
      ) : null}
    </span>
  );
}
