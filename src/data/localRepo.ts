import type { Folder, Section, Song } from "../types";
import { newId, type Repo } from "./repo";

/**
 * Tarayıcı önizlemesi için geçici depo (localStorage).
 * Gerçek uygulama Tauri içinde SQLite kullanır; bu yalnızca geliştirme kolaylığı.
 */
const KEY = "bestele:preview-data";

interface Store {
  songs: Song[];
  folders: Folder[];
  sections: Section[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Store>;
      return { songs: s.songs ?? [], folders: s.folders ?? [], sections: s.sections ?? [] };
    }
  } catch {
    /* boş başla */
  }
  return { songs: [], folders: [], sections: [] };
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
      store.sections = store.sections.filter((s) => s.songId !== id);
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

    async listSections(songId) {
      return sectionsOf(songId).map((s) => ({ ...s }));
    },

    async createSection(songId, fields, index) {
      const list = sectionsOf(songId);
      const at = index === undefined ? list.length : Math.max(0, Math.min(index, list.length));
      const now = Date.now();
      const section: Section = { ...fields, id: newId(), songId, position: at, createdAt: now, updatedAt: now };
      list.splice(at, 0, section);
      renumber(list);
      store.sections.push(section);
      touch(songId, now);
      save(store);
      return { ...section };
    },

    async updateSection(id, patch) {
      const s = store.sections.find((x) => x.id === id);
      if (!s) throw new Error("Bölüm bulunamadı");
      const now = Date.now();
      Object.assign(s, patch, { updatedAt: now });
      touch(s.songId, now);
      save(store);
      return { ...s };
    },

    async deleteSection(id) {
      const s = store.sections.find((x) => x.id === id);
      if (!s) return;
      store.sections = store.sections.filter((x) => x.id !== id);
      renumber(sectionsOf(s.songId));
      touch(s.songId, Date.now());
      save(store);
    },

    async reorderSections(songId, orderedIds) {
      orderedIds.forEach((id, i) => {
        const s = store.sections.find((x) => x.id === id && x.songId === songId);
        if (s) s.position = i;
      });
      touch(songId, Date.now());
      save(store);
    },
  };

  function sectionsOf(songId: string): Section[] {
    return store.sections.filter((s) => s.songId === songId).sort((a, b) => a.position - b.position);
  }

  function renumber(list: Section[]) {
    list.forEach((s, i) => (s.position = i));
  }

  function touch(songId: string, now: number) {
    const song = store.songs.find((s) => s.id === songId);
    if (song) song.updatedAt = now;
  }
}
