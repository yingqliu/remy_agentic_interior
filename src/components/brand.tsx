import Link from "next/link";

export function Brand({ href }: { href?: string }) {
  const mark = (
    <span className="inline-flex items-baseline gap-2">
      <span className="font-display text-2xl leading-none tracking-tight">Remy</span>
      <span className="text-[10px] uppercase tracking-[0.22em] text-muted">agentic remodel</span>
    </span>
  );
  if (!href) return mark;
  return (
    <Link href={href} className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-copper">
      {mark}
    </Link>
  );
}
