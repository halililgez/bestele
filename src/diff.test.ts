import { describe, expect, it } from "vitest";
import { diffLines, diffStats } from "./diff";

describe("diffLines", () => {
  it("aynı metin değişiklik içermez", () => {
    const d = diffLines("a\nb", "a\nb");
    expect(diffStats(d)).toEqual({ added: 0, removed: 0 });
  });

  it("değişen satırı silinmiş + eklenmiş olarak gösterir", () => {
    expect(diffLines("[Am]Gece\n[F]treni", "[Am]Gece\n[G]treni")).toEqual([
      { op: "same", text: "[Am]Gece" },
      { op: "del", text: "[F]treni" },
      { op: "add", text: "[G]treni" },
    ]);
  });

  it("araya eklenen satırı bulur", () => {
    expect(diffLines("a\nc", "a\nb\nc")).toEqual([
      { op: "same", text: "a" },
      { op: "add", text: "b" },
      { op: "same", text: "c" },
    ]);
  });

  it("boş metinlerle çalışır", () => {
    expect(diffLines("", "x")).toEqual([{ op: "add", text: "x" }]);
    expect(diffLines("x", "")).toEqual([{ op: "del", text: "x" }]);
    expect(diffLines("", "")).toEqual([]);
  });
});
