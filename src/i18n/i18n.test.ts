import { afterEach, describe, expect, it } from "vitest";
import { getLocale, setLocale, t } from ".";
import { tr } from "./tr";
import { en } from "./en";
import { sectionTitle } from "../sectionTitle";
import { songToText } from "../exporting";
import { relativeTime } from "../util";
import { emptySong, type Section, type Song } from "../types";

/** Sözlüğün bütün anahtar yollarını düz liste olarak verir (ör. "song.tabs.beste"). */
function keyPaths(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

/** Metin değerlerini (fonksiyonları örnek argümanlarla çağırarak) toplar. */
function values(obj: object): unknown[] {
  return Object.values(obj).flatMap((v) => {
    if (typeof v === "function") return [v("x", "y", "z", "w")];
    if (v && typeof v === "object" && !Array.isArray(v)) return values(v);
    return [v];
  });
}

const sec = (kind: Section["kind"], i: number, label = ""): Section => ({
  id: `s${i}`,
  songId: "x",
  kind,
  label,
  content: "[Am]la",
  position: i,
  createdAt: 0,
  updatedAt: 0,
});

describe("sözlükler", () => {
  it("İngilizce, Türkçe ile aynı anahtarlara sahip", () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(tr).sort());
  });

  it("boş metin yok", () => {
    for (const dict of [tr, en]) {
      for (const v of values(dict)) {
        if (typeof v === "string") expect(v.trim()).not.toBe("");
      }
    }
  });

  it("kısayol listeleri aynı tuşları aynı sırada içerir", () => {
    expect(en.shortcuts.map(([k]) => k).filter((k) => k !== "Boşluk" && k !== "Space")).toEqual(
      tr.shortcuts.map(([k]) => k).filter((k) => k !== "Boşluk" && k !== "Space"),
    );
  });

  it("İngilizce çoğullar", () => {
    expect(en.library.songCount(1)).toBe("1 song");
    expect(en.library.songCount(3)).toBe("3 songs");
    expect(en.song.capoFret(1)).toBe("1st fret");
    expect(en.song.capoFret(2)).toBe("2nd fret");
    expect(en.song.capoFret(3)).toBe("3rd fret");
    expect(en.song.capoFret(5)).toBe("5th fret");
  });
});

describe("dil değiştirme", () => {
  afterEach(() => setLocale("tr"));

  it("t() o anki dili döndürür", () => {
    setLocale("en");
    expect(getLocale()).toBe("en");
    expect(t().common.untitledSong).toBe("Untitled song");
    setLocale("tr");
    expect(t().common.untitledSong).toBe("Adsız şarkı");
  });

  it("bölüm adları dile göre üretilir", () => {
    const all = [sec("kita", 0), sec("nakarat", 1), sec("kita", 2), sec("kopru", 3, "Özel")];
    setLocale("en");
    expect(all.map((s) => sectionTitle(s, all))).toEqual(["Verse 1", "Chorus", "Verse 2", "Özel"]);
    setLocale("tr");
    expect(all.map((s) => sectionTitle(s, all))).toEqual(["Kıta 1", "Nakarat", "Kıta 2", "Özel"]);
  });

  it("düz metin dışa aktarma İngilizce etiketler kullanır", () => {
    const song: Song = { ...emptySong(""), musicalKey: "Am", tempo: 92, capo: 2, id: "x", createdAt: 0, updatedAt: 0 };
    setLocale("en");
    const lines = songToText(song, [sec("kita", 0)], sectionTitle).split("\n");
    expect(lines[0]).toBe("Untitled song");
    expect(lines[1]).toBe("Key: Am  ·  Tempo: 92 BPM  ·  Time: 4/4  ·  Capo: 2");
    expect(lines[3]).toBe("[Verse]");
  });

  it("göreli zaman dile göre biçimlenir", () => {
    setLocale("en");
    expect(relativeTime(Date.now())).toBe("just now");
    expect(relativeTime(Date.now() - 2 * 24 * 3600 * 1000)).toBe("2 days ago");
    setLocale("tr");
    expect(relativeTime(Date.now())).toBe("az önce");
  });
});
