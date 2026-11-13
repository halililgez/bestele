import { beforeAll, describe, expect, it } from "vitest";
import { chordsOverLyrics, safeFileName, songToChordPro, songToText } from "./exporting";
import { emptySong, type Section, type Song } from "./types";
import { setLocale } from "./i18n";

// Beklenen metinler Türkçe; sistem dili ne olursa olsun Türkçe çalış
beforeAll(() => setLocale("tr"));

const song: Song = {
  ...emptySong("Gece Yarısı Treni"),
  musicalKey: "Am",
  tempo: 92,
  id: "s1",
  createdAt: 0,
  updatedAt: 0,
};

const sec = (kind: Section["kind"], content: string, i: number): Section => ({
  id: `x${i}`,
  songId: "s1",
  kind,
  label: "",
  content,
  position: i,
  createdAt: 0,
  updatedAt: 0,
});

const titleOf = (s: Section) => (s.kind === "nakarat" ? "Nakarat" : "Kıta");

describe("chordsOverLyrics", () => {
  it("akorları sözdeki konumlarına hizalar", () => {
    expect(chordsOverLyrics("[Am]Gece ya[F]rısı")).toEqual(["Am     F", "Gece yarısı"]);
  });
  it("çakışan akorlarda sözü iter", () => {
    expect(chordsOverLyrics("[Am7]a[Dm]b")).toEqual(["Am7 Dm", "a   b"]);
  });
  it("yalnız akor satırı", () => {
    expect(chordsOverLyrics("[Am][F]")).toEqual(["Am F"]);
  });
  it("akorsuz satır olduğu gibi kalır", () => {
    expect(chordsOverLyrics("sadece söz")).toEqual(["sadece söz"]);
  });
});

describe("dışa aktarma", () => {
  const sections = [sec("kita", "[Am]Gece", 0), sec("nakarat", "[F]Gitme", 1), sec("kopru", "", 2)];

  it("düz metin", () => {
    expect(songToText(song, sections, titleOf)).toBe(
      ["Gece Yarısı Treni", "Ton: Am  ·  Tempo: 92 BPM  ·  Ölçü: 4/4", "", "[Kıta]", "Am", "Gece", "", "[Nakarat]", "F", "Gitme", ""].join("\n"),
    );
  });

  it("ChordPro", () => {
    const cho = songToChordPro(song, sections, titleOf);
    expect(cho).toContain("{title: Gece Yarısı Treni}");
    expect(cho).toContain("{key: Am}");
    expect(cho).toContain("{start_of_chorus: Nakarat}\n[F]Gitme\n{end_of_chorus}");
    expect(cho).not.toContain("bridge");
  });

  it("capo bilgisi metne ve ChordPro'ya eklenir", () => {
    const capoSong = { ...song, capo: 2 };
    expect(songToText(capoSong, sections, titleOf).split("\n")[1]).toBe("Ton: Am  ·  Tempo: 92 BPM  ·  Ölçü: 4/4  ·  Capo: 2");
    expect(songToChordPro(capoSong, sections, titleOf)).toContain("{capo: 2}");
    expect(songToChordPro(song, sections, titleOf)).not.toContain("capo");
  });

  it("dosya adı", () => {
    expect(safeFileName('Aşk: "son" şarkı?')).toBe("Aşk- -son- şarkı-");
  });
});
