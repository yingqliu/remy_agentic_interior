"use client";

import { createContext, useContext, useMemo } from "react";
import { translate, type Locale, type MessageKey } from "@/lib/i18n";

type LocaleValue = {
  locale: Locale;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<LocaleValue>(
    () => ({
      locale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useT() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useT must be used inside LocaleProvider");
  return value;
}
