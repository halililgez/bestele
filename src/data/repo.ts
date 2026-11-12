import type { Folder, Song, SongFields } from "../types";
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
}

export function newId(): string {
  return crypto.randomUUID();
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let repoPromise: Promise<Repo> | null = null;

export function getRepo(): Promise<Repo> {
  if (!repoPromise) {
    repoPromise = isTauri() ? createSqlRepo() : Promise.resolve(createLocalRepo());
  }
  return repoPromise;
}
