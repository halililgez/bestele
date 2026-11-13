import type {
  BackupRecords,
  Folder,
  Recording,
  RecordingFields,
  RecordingPatch,
  Section,
  SectionFields,
  Song,
  SongFields,
  Version,
  VersionFields,
  VersionPatch,
} from "../types";
import { createLocalRepo } from "./localRepo";
import { createSqlRepo } from "./sqlRepo";

/**
 * Uygulamanın veriye eriştiği tek kapı.
 * Masaüstü uygulamasında SQLite, tarayıcı önizlemesinde localStorage kullanılır.
 */
export interface Repo {
  readonly kind: "sqlite" | "browser";
  listSongs(): Promise<Song[]>;
  createSong(fields: SongFields): Promise<Song>;
  updateSong(id: string, patch: Partial<SongFields>): Promise<Song>;
  deleteSong(id: string): Promise<void>;
  listFolders(): Promise<Folder[]>;
  createFolder(name: string): Promise<Folder>;
  renameFolder(id: string, name: string): Promise<void>;
  /** Klasör silinince içindeki şarkılar "klasörsüz" kalır, silinmez. */
  deleteFolder(id: string): Promise<void>;

  /** Bölümler `position` sırasıyla döner. */
  listSections(songId: string): Promise<Section[]>;
  /** `index` verilmezse sona eklenir. */
  createSection(songId: string, fields: SectionFields, index?: number): Promise<Section>;
  updateSection(id: string, patch: Partial<SectionFields>): Promise<Section>;
  deleteSection(id: string): Promise<void>;
  /** Verilen sıraya göre position değerlerini yeniden yazar. */
  reorderSections(songId: string, orderedIds: string[]): Promise<void>;

  /** Kayıtlar yeniden eskiye sıralı döner. Ses verisi ayrı tutulur (bkz. audioStore). */
  listRecordings(songId: string): Promise<Recording[]>;
  createRecording(fields: RecordingFields): Promise<Recording>;
  updateRecording(id: string, patch: RecordingPatch): Promise<Recording>;
  deleteRecording(id: string): Promise<void>;

  /** Versiyonlar yeniden eskiye sıralı döner. */
  listVersions(songId: string): Promise<Version[]>;
  createVersion(fields: VersionFields): Promise<Version>;
  updateVersion(id: string, patch: VersionPatch): Promise<Version>;
  deleteVersion(id: string): Promise<void>;
  /** Şarkının bütün bölümlerini verilen listeyle değiştirir (versiyona geri dönme). */
  replaceSections(songId: string, sections: SectionFields[]): Promise<Section[]>;

  /** Yedekten gelen kayıtları ekler; aynı kimlikle zaten var olanlar atlanır. Eklenen şarkı sayısını döner. */
  importRecords(data: BackupRecords): Promise<number>;

  /** Arama için her şarkının bütün bölüm metinleri (şarkı kimliği → metin). */
  lyricsIndex(): Promise<Record<string, string>>;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let repoPromise: Promise<Repo> | null = null;

export function getRepo(): Promise<Repo> {
  if (!repoPromise) {
    repoPromise = isTauri() ? createSqlRepo() : Promise.resolve(createLocalRepo());
  }
  return repoPromise;
}
