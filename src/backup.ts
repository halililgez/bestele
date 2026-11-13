import { getRepo } from "./data/repo";
import { getAudioStore } from "./data/audioStore";
import type { BackupFile, BackupRecords } from "./types";
import { t } from "./i18n";

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Bütün defteri (ses dosyaları dahil) tek bir JSON dosyasına toplar. */
export async function buildBackup(): Promise<BackupFile> {
  const repo = await getRepo();
  const audio = getAudioStore();
  const songs = await repo.listSongs();
  const data: BackupRecords = { folders: await repo.listFolders(), songs, sections: [], recordings: [], versions: [] };
  const files: Record<string, string> = {};
  for (const song of songs) {
    data.sections.push(...(await repo.listSections(song.id)));
    data.versions.push(...(await repo.listVersions(song.id)));
    for (const rec of await repo.listRecordings(song.id)) {
      data.recordings.push(rec);
      try {
        files[rec.fileName] = toBase64(await audio.load(rec.fileName));
      } catch {
        /* dosyası kayıp kayıtlar yalnızca bilgi olarak yedeklenir */
      }
    }
  }
  return { app: "bestele", format: 1, exportedAt: Date.now(), ...data, audio: files };
}

export interface RestoreResult {
  songsAdded: number;
  songsInFile: number;
}

/** Yedeği mevcut deftere ekler. Var olan şarkılar ezilmez. */
export async function restoreBackup(raw: string): Promise<RestoreResult> {
  let file: BackupFile;
  try {
    file = JSON.parse(raw);
  } catch {
    throw new Error(t().backup.unreadable);
  }
  if (file?.app !== "bestele" || file.format !== 1) throw new Error(t().backup.notBackup);
  const audio = getAudioStore();
  for (const [name, b64] of Object.entries(file.audio ?? {})) {
    await audio.save(name, fromBase64(b64));
  }
  const repo = await getRepo();
  const songsAdded = await repo.importRecords({
    folders: file.folders ?? [],
    songs: file.songs ?? [],
    sections: file.sections ?? [],
    recordings: file.recordings ?? [],
    versions: file.versions ?? [],
  });
  return { songsAdded, songsInFile: file.songs?.length ?? 0 };
}
