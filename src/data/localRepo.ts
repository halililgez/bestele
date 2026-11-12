import type { Folder, Song } from "../types";
import { newId, type Repo } from "./repo";

/**
 * Tarayıcı önizlemesi için geçici depo (localStorage).
 * Gerçek uygulama Tauri içinde SQLite kullanır; bu yalnızca geliştirme kolaylığı.
 */
const KEY = "bestele:preview-data";

interface Store {
  songs: Song[];
  folders: Folder[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* boş başla */
  }
  return { songs: [], folders: [] };
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* önizlemede kaydedilemezse yok say */
  }
}

export function createLocalRepo(): Repo {
  const store = load();

  return {
    kind: "browser",

    async listSongs() {
      return [...store.songs].sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async createSong(fields) {
      const now = Date.now();
      const song: Song = { ...fields, id: newId(), createdAt: now, updatedAt: now };
      store.songs.push(song);
      save(store);
      return song;
    },

    async updateSong(id, patch) {
      const i = store.songs.findIndex((s) => s.id === id);
      if (i < 0) throw new Error("Şarkı bulunamadı");
      store.songs[i] = { ...store.songs[i], ...patch, updatedAt: Date.now() };
      save(store);
      return store.songs[i];
    },

    async deleteSong(id) {
      store.songs = store.songs.filter((s) => s.id !== id);
      save(store);
    },

    async listFolders() {
      return [...store.folders].sort((a, b) => a.name.localeCompare(b.name, "tr"));
    },

    async createFolder(name) {
      const folder: Folder = { id: newId(), name, createdAt: Date.now() };
      store.folders.push(folder);
      save(store);
      return folder;
    },

    async renameFolder(id, name) {
      const f = store.folders.find((x) => x.id === id);
      if (f) f.name = name;
      save(store);
    },

    async deleteFolder(id) {
      store.folders = store.folders.filter((f) => f.id !== id);
      store.songs = store.songs.map((s) => (s.folderId === id ? { ...s, folderId: null } : s));
      save(store);
    },
  };
}
