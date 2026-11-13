import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { tr, type Messages, type Rich } from "./tr";
import { en } from "./en";

export type { Messages, Rich };

export type Locale = "tr" | "en";

/** Dil seçicide gösterilen adlar: her dil kendi adıyla yazılır. */
export const LOCALES: { id: Locale; label: string }[] = [
  { id: "tr", label: "Türkçe" },
  { id: "en", label: "English" },
];

const DICTS: Record<Locale, Messages> = { tr, en };
const KEY = "bestele:locale";

function isLocale(v: unknown): v is Locale {
  return v === "tr" || v === "en";
}

/**
 * Açılıştaki dil: kayıtlı tercih → (dil seçimi gelmeden önce kullanmaya başlamış biri için) Türkçe →
 * işletim sistemi / tarayıcı dili → İngilizce.
 */
export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLocale(saved)) return saved;
    if (localStorage.getItem("bestele:theme")) return "tr";
  } catch {
    /* depolama yoksa sistem diline bak */
  }
  const langs = typeof navigator !== "undefined" ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const l of langs) {
    const base = l?.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "en";
}

let current: Locale = detectLocale();

export function getLocale(): Locale {
  return current;
}

/** React dışındaki kod (dışa aktarma, hata mesajları, tarih biçimleri) için o anki dilin metinleri. */
export function t(): Messages {
  return DICTS[current];
}

/** Dili değiştirir ve tercihi saklar. Arayüzün yenilenmesi için bileşenler `useLocale().setLocale` kullanmalı. */
export function setLocale(locale: Locale) {
  current = locale;
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    /* tercih kaydedilemezse sorun değil */
  }
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<Ctx>({ locale: current, setLocale });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>(current);

  const change = useCallback((l: Locale) => {
    // Modül düzeyindeki dil, yeniden çizimden önce güncellenmeli ki t() da yeni dili döndürsün
    setLocale(l);
    setState(l);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale: change }), [locale, change]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Ctx {
  return useContext(LocaleContext);
}

/** Bileşenlerde o anki dilin metinleri; dil değişince bileşen yeniden çizilir. */
export function useT(): Messages {
  return DICTS[useContext(LocaleContext).locale];
}

/** [önce, kalın, sonra] biçimindeki metni, ortadaki adı kalın yazarak gösterir. */
export function RichText({ parts }: { parts: Rich }) {
  const [before, bold, after] = parts;
  return (
    <>
      {before}
      <strong>{bold}</strong>
      {after}
    </>
  );
}
