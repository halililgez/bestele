import { describe, expect, it } from "vitest";
import {
  chordsIn,
  diatonicChords,
  parseChord,
  prefersFlats,
  tokenizeLine,
  transposeChord,
  transposeKey,
  transposeText,
} from "./chords";

describe("parseChord", () => {
  it("kök, nitelik ve bas notasını ayırır", () => {
    expect(parseChord("F#m7/C#")).toEqual({ root: "F#", quality: "m7", bass: "C#" });
    expect(parseChord("Bbmaj7")).toEqual({ root: "Bb", quality: "maj7", bass: null });
  });
  it("akor olmayan metni reddeder", () => {
    expect(parseChord("x2")).toBeNull();
    expect(parseChord("")).toBeNull();
  });
});

describe("transpose", () => {
  it("akorları kaydırır", () => {
    expect(transposeChord("Am", 2)).toBe("Bm");
    expect(transposeChord("G/B", 2)).toBe("A/C#");
    expect(transposeChord("E7", 1, true)).toBe("F7");
    expect(transposeChord("C", -1, true)).toBe("B");
    expect(transposeChord("D", 1, true)).toBe("Eb");
  });
  it("tanınmayan işaretleri olduğu gibi bırakır", () => {
    expect(transposeChord("N.C.", 3)).toBe("N.C.");
  });
  it("tonları uygulamanın yazımıyla kaydırır", () => {
    expect(transposeKey("Am", 2)).toBe("Bm");
    expect(transposeKey("C", 3)).toBe("Eb");
    expect(transposeKey("F#m", -1)).toBe("Fm");
  });
  it("metin içindeki bütün akorları kaydırır", () => {
    expect(transposeText("[Am]Gece [F]yarısı", 2)).toBe("[Bm]Gece [G]yarısı");
  });
});

describe("diatonicChords", () => {
  it("majör ton", () => {
    expect(diatonicChords("G")).toEqual(["G", "Am", "Bm", "C", "D", "Em", "F#dim"]);
  });
  it("minör ton (armonik V dahil)", () => {
    expect(diatonicChords("Am")).toEqual(["Am", "Bdim", "C", "Dm", "Em", "F", "G", "E"]);
  });
  it("bemol tonlar bemolle yazılır", () => {
    expect(prefersFlats("F")).toBe(true);
    expect(diatonicChords("F")).toContain("Bb");
  });
});

describe("tokenizeLine", () => {
  it("akorları kelimelere bağlar", () => {
    expect(tokenizeLine("[Am]Gece ya[F]rısı")).toEqual([
      { chord: "Am", text: "Gece " },
      { chord: null, text: "ya" },
      { chord: "F", text: "rısı" },
    ]);
  });
  it("yalnızca akorlardan oluşan satır", () => {
    expect(tokenizeLine("[Am][F]")).toEqual([
      { chord: "Am", text: "" },
      { chord: "F", text: "" },
    ]);
  });
  it("akorsuz satır", () => {
    expect(tokenizeLine("sadece söz")).toEqual([
      { chord: null, text: "sadece " },
      { chord: null, text: "söz" },
    ]);
  });
  it("chordsIn tekrarları atar", () => {
    expect(chordsIn("[Am]a [F]b [Am]c")).toEqual(["Am", "F"]);
  });
});
