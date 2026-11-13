import { parseChord } from "./chords";

/**
 * Gitar akor şeması. `frets` kalından inceye 6 tel: -1 = çalınmaz (x), 0 = açık tel, n = n. perde.
 * Perdeler mutlak numaradır; çizimde `baseFret`'ten başlayan 5 perde gösterilir.
 */
export interface GuitarShape {
  frets: number[];
  baseFret: number;
  /** Barre varsa: hangi perde, hangi telden hangi tele (0 = kalın E) */
  barre?: { fret: number; from: number; to: number };
  /** Nitelik tanınmadığında basitleştirilmiş şema verildiyse true */
  simplified?: boolean;
}

type Quality = "maj" | "m" | "7" | "m7" | "maj7" | "sus2" | "sus4" | "dim" | "5";

const NOTE_INDEX: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11, "B#": 0, Fb: 4, "E#": 5,
};

/** Yaygın açık akorlar (perdeler mutlak) */
const OPEN: Record<string, number[]> = {
  "C:maj": [-1, 3, 2, 0, 1, 0],
  "D:maj": [-1, -1, 0, 2, 3, 2],
  "E:maj": [0, 2, 2, 1, 0, 0],
  "G:maj": [3, 2, 0, 0, 0, 3],
  "A:maj": [-1, 0, 2, 2, 2, 0],
  "D:m": [-1, -1, 0, 2, 3, 1],
  "E:m": [0, 2, 2, 0, 0, 0],
  "A:m": [-1, 0, 2, 2, 1, 0],
  "C:7": [-1, 3, 2, 3, 1, 0],
  "D:7": [-1, -1, 0, 2, 1, 2],
  "E:7": [0, 2, 0, 1, 0, 0],
  "G:7": [3, 2, 0, 0, 0, 1],
  "A:7": [-1, 0, 2, 0, 2, 0],
  "B:7": [-1, 2, 1, 2, 0, 2],
  "D:m7": [-1, -1, 0, 2, 1, 1],
  "E:m7": [0, 2, 0, 0, 0, 0],
  "A:m7": [-1, 0, 2, 0, 1, 0],
  "C:maj7": [-1, 3, 2, 0, 0, 0],
  "D:maj7": [-1, -1, 0, 2, 2, 2],
  "F:maj7": [-1, -1, 3, 2, 1, 0],
  "G:maj7": [3, 2, 0, 0, 0, 2],
  "A:maj7": [-1, 0, 2, 1, 2, 0],
  "D:sus2": [-1, -1, 0, 2, 3, 0],
  "A:sus2": [-1, 0, 2, 2, 0, 0],
  "D:sus4": [-1, -1, 0, 2, 3, 3],
  "E:sus4": [0, 2, 2, 2, 0, 0],
  "A:sus4": [-1, 0, 2, 2, 3, 0],
  "E:5": [0, 2, 2, -1, -1, -1],
  "A:5": [-1, 0, 2, 2, -1, -1],
};

/** Taşınabilir şekiller: kök 6. telde (E şekli) ve 5. telde (A şekli); kökten göreli perdeler */
const E_SHAPE: Partial<Record<Quality, number[]>> = {
  maj: [0, 2, 2, 1, 0, 0],
  m: [0, 2, 2, 0, 0, 0],
  "7": [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, -1, 1, 1, 0, -1],
  sus4: [0, 2, 2, 2, 0, 0],
  "5": [0, 2, 2, -1, -1, -1],
};

const A_SHAPE: Partial<Record<Quality, number[]>> = {
  maj: [-1, 0, 2, 2, 2, 0],
  m: [-1, 0, 2, 2, 1, 0],
  "7": [-1, 0, 2, 0, 2, 0],
  m7: [-1, 0, 2, 0, 1, 0],
  maj7: [-1, 0, 2, 1, 2, 0],
  sus2: [-1, 0, 2, 2, 0, 0],
  sus4: [-1, 0, 2, 2, 3, 0],
  dim: [-1, 0, 1, 2, 1, -1],
  "5": [-1, 0, 2, 2, -1, -1],
};

function qualityOf(raw: string): { q: Quality; simplified: boolean } {
  const s = raw.trim();
  const table: [RegExp, Quality][] = [
    [/^(maj7|M7|Δ7?|ma7)$/, "maj7"],
    [/^(m7|min7|-7)$/, "m7"],
    [/^(m|min|-)$/, "m"],
    [/^7$/, "7"],
    [/^(sus2)$/, "sus2"],
    [/^(sus4|sus)$/, "sus4"],
    [/^(dim|°|o|dim7|°7)$/, "dim"],
    [/^5$/, "5"],
    [/^(maj)?$/, "maj"],
  ];
  for (const [re, q] of table) if (re.test(s)) return { q, simplified: false };
  // Tanınmayanları en yakın temel akora indir (ör. m9 → m7, 9 → 7, add9 → majör)
  if (/^m(?!aj)/.test(s)) return { q: /7|9|11|13/.test(s) ? "m7" : "m", simplified: true };
  if (/^(maj|M)/.test(s)) return { q: "maj7", simplified: true };
  if (/^(9|11|13|7)/.test(s)) return { q: "7", simplified: true };
  return { q: "maj", simplified: true };
}

function fromShape(shape: number[], rootFret: number): GuitarShape {
  const frets = shape.map((f) => (f < 0 ? -1 : f + rootFret));
  const played = frets.filter((f) => f > 0);
  const min = played.length ? Math.min(...played) : 1;
  const max = played.length ? Math.max(...played) : 1;
  const baseFret = max <= 5 ? 1 : min;
  let barre: GuitarShape["barre"];
  if (rootFret > 0) {
    // Kökün bulunduğu perdede, o perdeye basan ilk ve son tel arası barre
    const idx = frets.map((f, i) => (f === rootFret ? i : -1)).filter((i) => i >= 0);
    if (idx.length >= 2) barre = { fret: rootFret, from: idx[0], to: idx[idx.length - 1] };
  }
  return { frets, baseFret, barre };
}

/** Akor adından gitar şeması üretir; tanınmayan akorlar için null. Slash bas notası yok sayılır. */
export function guitarShape(chord: string): GuitarShape | null {
  const p = parseChord(chord);
  if (!p) return null;
  const root = NOTE_INDEX[p.root];
  const { q, simplified } = qualityOf(p.quality);
  const canonical = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][root];
  const open = OPEN[`${canonical}:${q}`];
  if (open) {
    const played = open.filter((f) => f > 0);
    return { frets: [...open], baseFret: played.length && Math.max(...played) > 5 ? Math.min(...played) : 1, simplified };
  }
  const candidates: GuitarShape[] = [];
  const eShape = E_SHAPE[q];
  const aShape = A_SHAPE[q];
  // E teli = 4, A teli = 9 (C'den yarım ses uzaklığı)
  if (eShape) candidates.push(fromShape(eShape, (root - 4 + 12) % 12));
  if (aShape) candidates.push(fromShape(aShape, (root - 9 + 12) % 12));
  if (!candidates.length) return null;
  const lowest = (s: GuitarShape) => Math.max(0, ...s.frets.filter((f) => f >= 0));
  candidates.sort((a, b) => lowest(a) - lowest(b));
  return { ...candidates[0], simplified };
}
