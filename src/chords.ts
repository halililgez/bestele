/**
 * Akor işlemleri: ayrıştırma, transpoze, tona uygun (diatonik) akorlar,
 * ve "[Am]Gece ya[F]rısı" biçimindeki satırları parçalara ayırma.
 */

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
/** Ton adlarında kullandığımız yazımlar (types.ts MUSICAL_KEYS ile aynı) */
const KEY_ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

const NOTE_INDEX: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, F: 5, "E#": 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

const CHORD_RE = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/;

export interface ParsedChord {
  root: string;
  quality: string;
  bass: string | null;
}

export function parseChord(chord: string): ParsedChord | null {
  const m = CHORD_RE.exec(chord.trim());
  if (!m || NOTE_INDEX[m[1]] === undefined) return null;
  if (m[3] && NOTE_INDEX[m[3]] === undefined) return null;
  return { root: m[1], quality: m[2], bass: m[3] ?? null };
}

function shift(note: string, semis: number, flats: boolean): string {
  const i = NOTE_INDEX[note];
  if (i === undefined) return note;
  const j = (((i + semis) % 12) + 12) % 12;
  return (flats ? FLATS : SHARPS)[j];
}

export function transposeChord(chord: string, semis: number, flats = false): string {
  const p = parseChord(chord);
  if (!p || semis % 12 === 0) return chord;
  const bass = p.bass ? "/" + shift(p.bass, semis, flats) : "";
  return shift(p.root, semis, flats) + p.quality + bass;
}

function splitKey(key: string): { root: string; minor: boolean } | null {
  const m = /^([A-G](?:#|b)?)(m?)$/.exec(key.trim());
  if (!m || NOTE_INDEX[m[1]] === undefined) return null;
  return { root: m[1], minor: m[2] === "m" };
}

export function transposeKey(key: string, semis: number): string {
  const k = splitKey(key);
  if (!k) return key;
  const j = (((NOTE_INDEX[k.root] + semis) % 12) + 12) % 12;
  return KEY_ROOTS[j] + (k.minor ? "m" : "");
}

const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"]);

/** Bu tonda akorlar bemol (b) ile mi yazılmalı? */
export function prefersFlats(key: string): boolean {
  return FLAT_KEYS.has(key.trim());
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_QUALITIES = ["", "m", "m", "", "", "m", "dim"];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
const MINOR_QUALITIES = ["m", "dim", "", "m", "m", "", ""];

/** Tonun temel akorları (I ii iii IV V vi vii° ya da minör karşılıkları). */
export function diatonicChords(key: string): string[] {
  const k = splitKey(key);
  if (!k) return [];
  const flats = prefersFlats(key);
  const steps = k.minor ? MINOR_STEPS : MAJOR_STEPS;
  const qualities = k.minor ? MINOR_QUALITIES : MAJOR_QUALITIES;
  const chords = steps.map((s, i) => shift(k.root, s, flats) + qualities[i]);
  // Minörde armonik V (majör) de çok kullanılır
  if (k.minor) chords.push(shift(k.root, 7, flats));
  return chords;
}

const INLINE_RE = /\[([^\]\n]*)\]/g;

/** Metindeki bütün [akor] işaretlerini transpoze eder. */
export function transposeText(text: string, semis: number, flats = false): string {
  if (semis % 12 === 0) return text;
  return text.replace(INLINE_RE, (_, c: string) => `[${transposeChord(c, semis, flats)}]`);
}

/** Metinde geçen akorlar, ilk görünme sırasıyla ve tekrarsız. */
export function chordsIn(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(INLINE_RE)) {
    const c = m[1].trim();
    if (c) seen.add(c);
  }
  return [...seen];
}

export interface Token {
  chord: string | null;
  text: string;
}

/**
 * Bir satırı ekranda akor-üstte / söz-altta gösterilecek parçalara böler.
 * Sözler kelime kelime bölünür ki uzun satırlar düzgün kaydırılsın.
 */
export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let pending: string | null = null;

  const pushText = (text: string) => {
    const words = text.match(/\S+\s*|\s+/g) ?? [];
    if (words.length === 0) {
      if (pending !== null) tokens.push({ chord: pending, text: "" });
      pending = null;
      return;
    }
    words.forEach((w, i) => {
      tokens.push({ chord: i === 0 ? pending : null, text: w });
    });
    pending = null;
  };

  for (const m of line.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    const before = line.slice(last, idx);
    if (before || pending !== null) pushText(before);
    pending = m[1].trim();
    last = idx + m[0].length;
  }
  pushText(line.slice(last));
  return tokens;
}
