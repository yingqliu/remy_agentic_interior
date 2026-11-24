import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Brand href="/" />
      <h1 className="mt-8 font-display text-3xl">没有这个项目</h1>
      <p className="mt-3 text-sm text-muted">
        <Link href="/" className="text-copper">
          回到项目列表
        </Link>
      </p>
    </div>
  );
}
