import { SECTION_LABELS, type Section } from "./types";

/** Etiketi boş bölümlere "Kıta 1, Kıta 2" gibi ad üretir. */
export function sectionTitle(section: Section, all: Section[]): string {
  if (section.label.trim()) return section.label.trim();
  const base = SECTION_LABELS[section.kind];
  if (section.kind !== "kita" && section.kind !== "diger") return base;
  const same = all.filter((s) => s.kind === section.kind && !s.label.trim());
  if (same.length < 2) return base;
  return `${base} ${same.findIndex((s) => s.id === section.id) + 1}`;
}
