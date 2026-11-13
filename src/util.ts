import { getLocale, t } from "./i18n";

const rtfCache = new Map<string, Intl.RelativeTimeFormat>();
const dtfCache = new Map<string, Intl.DateTimeFormat>();

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function relativeTime(ts: number): string {
  const locale = getLocale();
  let rtf = rtfCache.get(locale);
  if (!rtf) rtfCache.set(locale, (rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })));
  const diff = (ts - Date.now()) / 1000;
  for (const [unit, secs] of STEPS) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return t().common.justNow;
}

/** Tarih ve saat, o anki dilde (ör. "14 Kas 2026 15:30" / "Nov 14, 2026, 3:30 PM"). */
export function formatDateTime(ts: number | Date): string {
  const locale = getLocale();
  let dtf = dtfCache.get(locale);
  if (!dtf) dtfCache.set(locale, (dtf = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" })));
  return dtf.format(ts);
}

/** Ad sıralaması, o anki dilin alfabesine göre. */
export function compareText(a: string, b: string): number {
  return a.localeCompare(b, getLocale());
}

export function trLower(s: string): string {
  return s.toLocaleLowerCase("tr");
}

const FOLD: Record<string, string> = { ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c", â: "a", î: "i", û: "u" };

/**
 * Arama için sadeleştirir: küçük harf + Türkçe karakterleri düz harfe çevirir.
 * Böylece "gece yarisi" araması "Gece Yarısı"nı, "istasyon" da "Istasyon"u bulur.
 */
export function searchFold(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[ışğüöçâîû]/g, (c) => FOLD[c] ?? c);
}

/** Etiketleri temizler: boşlukları kırpar, # işaretini atar, tekrarları siler. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").trim();
}
