export function FrameImage({
  src,
  alt,
  frames = 1,
  frame = 0,
  badge,
  onClick,
}: {
  src: string;
  alt: string;
  frames?: number;
  frame?: number;
  badge?: string;
  onClick?: () => void;
}) {
  const total = Math.max(1, frames);
  return (
    <div
      className={`relative w-full overflow-hidden bg-sand ${onClick ? "cursor-zoom-in" : ""}`}
      style={{ aspectRatio: "1280 / 800" }}
      onClick={onClick}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="absolute top-0 h-full max-w-none select-none"
        style={{ width: `${total * 100}%`, left: `${-frame * 100}%` }}
      />
      {badge ? (
        <span className="pointer-events-none absolute left-2 top-2 z-[2] rounded bg-paper/85 px-1.5 py-0.5 text-[10px] leading-none text-muted">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

export function HotspotThumb({
  src,
  alt,
  x,
  y,
  frames = 1,
  frame = 0,
  badge,
}: {
  src: string;
  alt: string;
  x: number;
  y: number;
  frames?: number;
  frame?: number;
  badge?: string;
}) {
  const windowPct = 32;
  let left = x - windowPct / 2;
  let top = y - windowPct / 2;
  left = Math.max(0, Math.min(100 - windowPct, left));
  top = Math.max(0, Math.min(100 - windowPct, top));
  const scale = 100 / windowPct;
  return (
    <div className="relative h-[60px] w-20 shrink-0 overflow-hidden rounded-md border border-line bg-sand">
      <div
        className="absolute"
        style={{
          width: `${scale * 100}%`,
          height: `${scale * 100}%`,
          left: `${-(left / windowPct) * 100}%`,
          top: `${-(top / windowPct) * 100}%`,
        }}
      >
        <FrameImage src={src} alt={alt} frames={frames} frame={frame} badge={badge} />
      </div>
    </div>
  );
}
