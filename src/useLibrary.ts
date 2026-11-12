import { useCallback, useEffect, useState } from "react";
import { getRepo, type Repo } from "./data/repo";
import { getAudioStore } from "./data/audioStore";
import type { Folder, Song, SongFields } from "./types";

/** Şarkıları ve klasörleri yükleyip değişiklikleri depoya yazan merkezi durum. */
export function useLibrary() {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getRepo();
        const [s, f] = await Promise.all([r.listSongs(), r.listFolders()]);
        if (cancelled) return;
        setRepo(r);
        setSongs(s);
        setFolders(f);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const guard = useCallback(
    async <T,>(fn: (r: Repo) => Promise<T>): Promise<T | undefined> => {
      if (!repo) return undefined;
      try {
        return await fn(repo);
      } catch (e) {
        setError(String(e));
        return undefined;
      }
    },
    [repo],
  );

  const createSong = useCallback(
    (fields: SongFields) =>
      guard(async (r) => {
        const song = await r.createSong(fields);
        setSongs((prev) => [song, ...prev]);
        return song;
      }),
    [guard],
  );

  const updateSong = useCallback(
    (id: string, patch: Partial<SongFields>) =>
      guard(async (r) => {
        const song = await r.updateSong(id, patch);
        setSongs((prev) => prev.map((s) => (s.id === id ? song : s)));
        return song;
      }),
    [guard],
  );

  const deleteSong = useCallback(
    (id: string) =>
      guard(async (r) => {
        // Önce şarkının ses dosyalarını sil, sonra kayıtlarını
        const audio = getAudioStore();
        for (const rec of await r.listRecordings(id)) {
          await audio.remove(rec.fileName).catch(() => undefined);
        }
        await r.deleteSong(id);
        setSongs((prev) => prev.filter((s) => s.id !== id));
      }),
    [guard],
  );

  const createFolder = useCallback(
    (name: string) =>
      guard(async (r) => {
        const folder = await r.createFolder(name);
        setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name, "tr")));
        return folder;
      }),
    [guard],
  );

  const renameFolder = useCallback(
    (id: string, name: string) =>
      guard(async (r) => {
        await r.renameFolder(id, name);
        setFolders((prev) =>
          prev.map((f) => (f.id === id ? { ...f, name } : f)).sort((a, b) => a.name.localeCompare(b.name, "tr")),
        );
      }),
    [guard],
  );

  const deleteFolder = useCallback(
    (id: string) =>
      guard(async (r) => {
        await r.deleteFolder(id);
        setFolders((prev) => prev.filter((f) => f.id !== id));
        setSongs((prev) => prev.map((s) => (s.folderId === id ? { ...s, folderId: null } : s)));
      }),
    [guard],
  );

  /** Bölüm gibi alt veriler değişince şarkının "son değişiklik" zamanını ekranda tazeler. */
  const markTouched = useCallback((id: string) => {
    const now = Date.now();
    setSongs((prev) => prev.map((s) => (s.id === id ? { ...s, updatedAt: now } : s)));
  }, []);

  return {
    ready: repo !== null,
    markTouched,
    storage: repo?.kind ?? null,
    songs,
    folders,
    error,
    clearError: () => setError(null),
    createSong,
    updateSong,
    deleteSong,
    createFolder,
    renameFolder,
    deleteFolder,
  };
}

export type Library = ReturnType<typeof useLibrary>;
