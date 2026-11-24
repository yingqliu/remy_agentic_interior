import type { ButtonHTMLAttributes } from "react";

export function Button({
  variant = "quiet",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" }) {
  const look =
    variant === "primary"
      ? "border-ink bg-ink text-paper hover:bg-ink/90"
      : "border-line bg-paper text-ink hover:bg-sand";
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${look} ${className}`}
    />
  );
}

export function Pill({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs ${
        active && !disabled ? "border-copper bg-copperSoft text-ink" : "border-line bg-paper text-ink"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {label}
    </button>
  );
}

export function ImpactTag({
  cost,
  timeline,
  significant,
  timeLabel,
}: {
  cost?: string | null;
  timeline?: string | null;
  significant?: boolean;
  timeLabel: string;
}) {
  if (!significant || (!cost && !timeline)) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-copperSoft px-2 py-0.5 text-xs text-copper">
      {cost ? <span>{cost}</span> : null}
      {timeline ? (
        <span>
          {timeLabel} {timeline}
        </span>
      ) : null}
    </span>
  );
}

export function Swatches({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; color: string }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const on = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-pressed={on}
            onClick={() => onChange(item.id)}
            className="h-5 w-5 rounded-full"
            style={{
              background: item.color,
              boxShadow: on ? "0 0 0 2px #fffcf8, 0 0 0 4px #1c1916" : "inset 0 0 0 1px rgba(28,25,22,0.25)",
            }}
          />
        );
      })}
    </div>
  );
}
