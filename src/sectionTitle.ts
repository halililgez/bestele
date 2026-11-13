import type { Section } from "./types";
import { t } from "./i18n";

/** Etiketi boş bölümlere "Kıta 1, Kıta 2" gibi ad üretir (o anki dilde). */
export function sectionTitle(section: Section, all: Section[]): string {
  if (section.label.trim()) return section.label.trim();
  const base = t().sectionKinds[section.kind];
  if (section.kind !== "kita" && section.kind !== "diger") return base;
  const same = all.filter((s) => s.kind === section.kind && !s.label.trim());
  if (same.length < 2) return base;
  return `${base} ${same.findIndex((s) => s.id === section.id) + 1}`;
}
