import Link from "next/link";
import { Brand } from "@/components/brand";
import { isDatabaseError, listProjects } from "@/server/projects";
import { translate } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const kindLabel: Record<string, string> = {
  bathroom: "卫生间",
  kitchen: "厨房",
  living: "客厅",
  bedroom: "卧室",
  other: "其他",
};

export default async function HomePage() {
  const t = (key: Parameters<typeof translate>[1]) => translate("zh", key);
  try {
    const projects = await listProjects();
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Brand />
        <p className="mt-6 max-w-xl text-base leading-relaxed">{t("homeLead")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/projects/new" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">
            {t("newProject")}
          </Link>
          <Link href="/login" className="rounded-full border border-line bg-paper px-4 py-2 text-sm">
            {t("loginLink")}
          </Link>
        </div>
        <h2 className="mt-12 font-display text-2xl">{t("projects")}</h2>
        <p className="mt-1 text-sm text-muted">{t("seededHint")}</p>
        {projects.length === 0 ? <p className="mt-4 text-sm">{t("noProjects")}</p> : null}
        <ul className="mt-4 space-y-3">
          {projects.map((project) => (
            <li key={project.slug} className="rounded-lg border border-line bg-paper p-4">
              <p className="text-xs uppercase tracking-wider text-muted">{kindLabel[project.roomKind] ?? project.roomKind}</p>
              <h3 className="mt-1 text-lg font-medium">{project.title}</h3>
              <p className="mt-1 text-sm text-muted">{project.summary}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link href={`/projects/${project.slug}`} className="text-copper">
                  {t("openStudio")}
                </Link>
                <Link href={`/c/${project.shareToken}`} className="text-copper">
                  {t("clientLink")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  } catch (error) {
    if (!isDatabaseError(error)) throw error;
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Brand />
        <h1 className="mt-8 font-display text-3xl">{t("setupTitle")}</h1>
        <p className="mt-3 text-sm leading-relaxed">{t("setupBody")}</p>
      </div>
    );
  }
}
