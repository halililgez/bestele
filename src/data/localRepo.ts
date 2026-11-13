import type { Folder, Recording, Section, Song, Version } from "../types";
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
  recordings: Recording[];
  versions: Version[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Store>;
      return {
        songs: s.songs ?? [],
        folders: s.folders ?? [],
        sections: s.sections ?? [],
        recordings: s.recordings ?? [],
        versions: s.versions ?? [],
      };
    }
  } catch {
    /* boş başla */
  }
  return { songs: [], folders: [], sections: [], recordings: [], versions: [] };
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
      store.recordings = store.recordings.filter((r) => r.songId !== id);
      store.versions = store.versions.filter((v) => v.songId !== id);
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
      store.recordings = store.recordings.map((r) => (r.sectionId === id ? { ...r, sectionId: null } : r));
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

    async listRecordings(songId) {
      return store.recordings
        .filter((r) => r.songId === songId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => ({ ...r }));
    },

    async createRecording(fields) {
      const now = Date.now();
      const rec: Recording = { ...fields, id: newId(), createdAt: now };
      store.recordings.push(rec);
      touch(fields.songId, now);
      save(store);
      return { ...rec };
    },

    async updateRecording(id, patch) {
      const r = store.recordings.find((x) => x.id === id);
      if (!r) throw new Error("Kayıt bulunamadı");
      Object.assign(r, patch);
      save(store);
      return { ...r };
    },

    async deleteRecording(id) {
      store.recordings = store.recordings.filter((r) => r.id !== id);
      save(store);
    },

    async listVersions(songId) {
      return store.versions
        .filter((v) => v.songId === songId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((v) => structuredClone(v));
    },

    async createVersion(fields) {
      const now = Date.now();
      const v: Version = { ...structuredClone(fields), id: newId(), createdAt: now };
      store.versions.push(v);
      touch(fields.songId, now);
      save(store);
      return structuredClone(v);
    },

    async updateVersion(id, patch) {
      const v = store.versions.find((x) => x.id === id);
      if (!v) throw new Error("Versiyon bulunamadı");
      Object.assign(v, structuredClone(patch));
      save(store);
      return structuredClone(v);
    },

    async deleteVersion(id) {
      store.versions = store.versions.filter((v) => v.id !== id);
      save(store);
    },

    async replaceSections(songId, sections) {
      const old = sectionsOf(songId);
      const now = Date.now();
      sections.forEach((s, i) => {
        if (old[i]) {
          Object.assign(old[i], { kind: s.kind, label: s.label, content: s.content, position: i, updatedAt: now });
        } else {
          store.sections.push({ ...s, id: newId(), songId, position: i, createdAt: now, updatedAt: now });
        }
      });
      const removed = new Set(old.slice(sections.length).map((s) => s.id));
      store.sections = store.sections.filter((s) => !removed.has(s.id));
      store.recordings = store.recordings.map((r) => (r.sectionId && removed.has(r.sectionId) ? { ...r, sectionId: null } : r));
      touch(songId, now);
      save(store);
      return sectionsOf(songId).map((s) => ({ ...s }));
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
