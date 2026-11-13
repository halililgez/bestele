const rtf = new Intl.RelativeTimeFormat("tr", { numeric: "auto" });

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function relativeTime(ts: number): string {
  const diff = (ts - Date.now()) / 1000;
  for (const [unit, secs] of STEPS) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return "az önce";
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
