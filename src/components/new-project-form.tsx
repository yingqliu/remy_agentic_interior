"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { translate } from "@/lib/i18n";

const kinds = [
  ["bathroom", "kindBathroom"],
  ["kitchen", "kindKitchen"],
  ["living", "kindLiving"],
  ["bedroom", "kindBedroom"],
  ["other", "kindOther"],
] as const;

export function NewProjectForm() {
  const router = useRouter();
  const t = (key: Parameters<typeof translate>[1]) => translate("zh", key);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        const form = event.currentTarget;
        const data = new FormData(form);
        if (!String(data.get("title") ?? "").trim()) {
          setError(t("titleRequired"));
          return;
        }
        const photo = data.get("photo");
        if (!(photo instanceof File) || photo.size === 0) {
          setError(t("photoRequired"));
          return;
        }
        setPending(true);
        const response = await fetch("/api/projects", { method: "POST", body: data });
        const body = (await response.json().catch(() => ({}))) as { slug?: string; error?: string };
        setPending(false);
        if (!response.ok || !body.slug) {
          setError(body.error === "type" ? t("photoType") : body.error === "size" ? t("photoBig") : t("createFailed"));
          return;
        }
        router.push(`/projects/${body.slug}`);
      }}
    >
      <Field label={t("fieldTitle")} name="title" required />
      <Field label={t("fieldClient")} name="clientName" />
      <label className="block text-sm">
        <span className="text-xs text-muted">{t("fieldRoomKind")}</span>
        <select name="roomKind" className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-2" defaultValue="bathroom">
          {kinds.map(([value, key]) => (
            <option key={value} value={value}>
              {t(key)}
            </option>
          ))}
        </select>
      </label>
      <Field label={t("fieldRoomName")} name="roomName" />
      <label className="block text-sm">
        <span className="text-xs text-muted">{t("fieldNeeds")}</span>
        <textarea name="requirements" rows={4} className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-2" />
      </label>
      <label className="block text-sm">
        <span className="text-xs text-muted">{t("fieldPhoto")}</span>
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-1 block w-full text-sm" />
      </label>
      {error ? <p className="text-sm text-copper">{error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50">
        {pending ? t("creating") : t("create")}
      </button>
    </form>
  );
}

function Field({ label, name, required }: { label: string; name: string; required?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-muted">{label}</span>
      <input name={name} required={required} className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-2" />
    </label>
  );
}
