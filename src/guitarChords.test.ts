import { describe, expect, it } from "vitest";
import { guitarShape } from "./guitarChords";

describe("guitarShape", () => {
  it("açık akorlar", () => {
    expect(guitarShape("C")?.frets).toEqual([-1, 3, 2, 0, 1, 0]);
    expect(guitarShape("Am")?.frets).toEqual([-1, 0, 2, 2, 1, 0]);
    expect(guitarShape("G/B")?.frets).toEqual([3, 2, 0, 0, 0, 3]);
  });

  it("F: 1. perdede E şekli barre", () => {
    const s = guitarShape("F")!;
    expect(s.frets).toEqual([1, 3, 3, 2, 1, 1]);
    expect(s.barre).toEqual({ fret: 1, from: 0, to: 5 });
    expect(s.baseFret).toBe(1);
  });

  it("Bm: 2. perdede A şekli barre", () => {
    const s = guitarShape("Bm")!;
    expect(s.frets).toEqual([-1, 2, 4, 4, 3, 2]);
    expect(s.barre).toEqual({ fret: 2, from: 1, to: 5 });
  });

  it("F#m ve Bb", () => {
    expect(guitarShape("F#m")!.frets).toEqual([2, 4, 4, 2, 2, 2]);
    expect(guitarShape("Bb")!.frets).toEqual([-1, 1, 3, 3, 3, 1]);
  });

  it("yüksek perdede başlangıç perdesi gösterilir", () => {
    const s = guitarShape("Eb7")!;
    expect(s.frets).toEqual([-1, 6, 8, 6, 8, 6]);
    expect(s.baseFret).toBe(6);
  });

  it("tanınmayan nitelikleri basitleştirir", () => {
    const s = guitarShape("Am9")!;
    expect(s.frets).toEqual([-1, 0, 2, 0, 1, 0]);
    expect(s.simplified).toBe(true);
    expect(guitarShape("Cadd9")!.simplified).toBe(true);
  });

  it("akor olmayanlar", () => {
    expect(guitarShape("N.C.")).toBeNull();
    expect(guitarShape("x2")).toBeNull();
  });
});
