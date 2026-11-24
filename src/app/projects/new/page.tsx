import Link from "next/link";
import { Brand } from "@/components/brand";
import { NewProjectForm } from "@/components/new-project-form";
import { translate } from "@/lib/i18n";

export const metadata = { title: "新建项目" };

export default function NewProjectPage() {
  const t = (key: Parameters<typeof translate>[1]) => translate("zh", key);
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Brand href="/" />
      <h1 className="mt-8 font-display text-3xl">{t("newTitle")}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{t("newLead")}</p>
      <NewProjectForm />
      <p className="mt-6 text-sm">
        <Link href="/" className="text-copper">
          {t("backHome")}
        </Link>
      </p>
    </div>
  );
}
