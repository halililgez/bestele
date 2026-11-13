import { describe, expect, it } from "vitest";
import { beatsPerBar, bpmFromTaps } from "./metronome";

describe("bpmFromTaps", () => {
  it("eşit aralıklı vuruşlardan tempo bulur", () => {
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120);
    expect(bpmFromTaps([0, 652, 1304])).toBe(92);
  });
  it("tek vuruşla tempo vermez", () => {
    expect(bpmFromTaps([1000])).toBeNull();
  });
  it("uzun aradan önceki vuruşları unutur", () => {
    expect(bpmFromTaps([0, 400, 5000, 5600])).toBe(100);
  });
  it("son altı vuruşu kullanır", () => {
    expect(bpmFromTaps([0, 1000, 2000, 2500, 3000, 3500, 4000, 4500, 5000])).toBe(120);
  });
});

describe("beatsPerBar", () => {
  it("basit ve bileşik ölçüler", () => {
    expect(beatsPerBar("4/4")).toBe(4);
    expect(beatsPerBar("3/4")).toBe(3);
    expect(beatsPerBar("6/8")).toBe(2);
    expect(beatsPerBar("12/8")).toBe(4);
    expect(beatsPerBar("7/8")).toBe(7);
    expect(beatsPerBar("")).toBe(4);
  });
});
