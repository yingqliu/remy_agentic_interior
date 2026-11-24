import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { translate } from "@/lib/i18n";

export const metadata = { title: "登录" };

export default function LoginPage() {
  const t = (key: Parameters<typeof translate>[1]) => translate("zh", key);
  async function enter() {
    "use server";
    const jar = await cookies();
    jar.set("remy_designer", "1", { path: "/", sameSite: "lax", httpOnly: false });
    redirect("/");
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Brand href="/" />
      <h1 className="mt-8 font-display text-3xl">{t("loginTitle")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{t("loginBody")}</p>
      <form action={enter} className="mt-6">
        <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">
          {t("loginAction")}
        </button>
      </form>
      <p className="mt-6 text-sm">
        <Link href="/" className="text-copper">
          {t("backHome")}
        </Link>
      </p>
    </div>
  );
}
