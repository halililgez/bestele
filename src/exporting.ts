import { tokenizeLine } from "./chords";
import type { Section, Song } from "./types";

type TitleOf = (s: Section, all: Section[]) => string;

/** "[Am]Gece ya[F]rısı" satırını iki satıra çevirir: üstte akorlar, altta söz (eş aralıklı yazı için). */
export function chordsOverLyrics(line: string): string[] {
  const tokens = tokenizeLine(line);
  if (!tokens.some((t) => t.chord)) return [line.replace(/\[[^\]]*\]/g, "")];
  let chords = "";
  let lyrics = "";
  for (const t of tokens) {
    if (t.chord) {
      // Akor, sözdeki konumunda başlar; önceki akorla çakışırsa söz boşlukla ileri itilir
      if (chords.length > lyrics.length) lyrics = lyrics.padEnd(chords.length, " ");
      chords = chords.padEnd(lyrics.length, " ") + t.chord + " ";
    }
    lyrics += t.text;
  }
  const out = [chords.trimEnd()];
  if (lyrics.trim()) out.push(lyrics.trimEnd());
  return out;
}

function metaLine(song: Song): string {
  return [
    song.writer && `Söz/Müzik: ${song.writer}`,
    song.musicalKey && `Ton: ${song.musicalKey}`,
    song.tempo && `Tempo: ${song.tempo} BPM`,
    song.timeSignature && `Ölçü: ${song.timeSignature}`,
    song.capo > 0 && `Capo: ${song.capo}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
}

/** Akorları sözlerin üstünde, düz metin. Mesajla paylaşmak ya da yazdırmak için. */
export function songToText(song: Song, sections: Section[], titleOf: TitleOf): string {
  const out: string[] = [song.title || "Adsız şarkı"];
  const meta = metaLine(song);
  if (meta) out.push(meta);
  for (const s of sections) {
    if (!s.content.trim()) continue;
    out.push("", `[${titleOf(s, sections)}]`);
    for (const line of s.content.split("\n")) {
      if (!line.trim()) out.push("");
      else out.push(...chordsOverLyrics(line));
    }
  }
  return out.join("\n") + "\n";
}

const CHORDPRO_ENV: Partial<Record<Section["kind"], string>> = {
  kita: "verse",
  nakarat: "chorus",
  kopru: "bridge",
};

/** ChordPro biçimi: birçok akor uygulamasının (OnSong, SongbookPro vb.) okuyabildiği standart. */
export function songToChordPro(song: Song, sections: Section[], titleOf: TitleOf): string {
  const out: string[] = [`{title: ${song.title || "Adsız şarkı"}}`];
  if (song.writer) out.push(`{artist: ${song.writer}}`);
  if (song.musicalKey) out.push(`{key: ${song.musicalKey}}`);
  if (song.tempo) out.push(`{tempo: ${song.tempo}}`);
  if (song.timeSignature) out.push(`{time: ${song.timeSignature}}`);
  if (song.capo > 0) out.push(`{capo: ${song.capo}}`);
  for (const s of sections) {
    if (!s.content.trim()) continue;
    const env = CHORDPRO_ENV[s.kind];
    const label = titleOf(s, sections);
    out.push("");
    if (env) out.push(`{start_of_${env}: ${label}}`);
    else out.push(`{comment: ${label}}`);
    out.push(s.content.replace(/\s+$/, ""));
    if (env) out.push(`{end_of_${env}}`);
  }
  return out.join("\n") + "\n";
}

/** Dosya adı için güvenli hâle getirir (Türkçe harfler korunur). */
export function safeFileName(name: string): string {
  return (name || "Adsız şarkı").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function downloadFile(fileName: string, content: BlobPart, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
