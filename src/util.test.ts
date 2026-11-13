import { describe, expect, it } from "vitest";
import { normalizeTag, searchFold } from "./util";

describe("searchFold", () => {
  it("Türkçe karakterleri ve büyük harfleri sadeleştirir", () => {
    expect(searchFold("Gece Yarısı")).toBe("gece yarisi");
    expect(searchFold("İSTANBUL")).toBe("istanbul");
    expect(searchFold("Istasyonda")).toBe("istasyonda");
    expect(searchFold("Çiğdem Şöför Ülkü")).toBe("cigdem sofor ulku");
  });
});

describe("normalizeTag", () => {
  it("# ve boşlukları temizler", () => {
    expect(normalizeTag("  #akustik ")).toBe("akustik");
  });
});
