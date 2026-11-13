import { useCallback, useEffect, useState } from "react";
import { getRepo } from "./data/repo";
import type { Section, Song, SongStatus, Version, VersionPatch, VersionSnapshot } from "./types";

export function makeSnapshot(song: Song, sections: Section[]): VersionSnapshot {
  return {
    title: song.title,
    musicalKey: song.musicalKey,
    tempo: song.tempo,
    timeSignature: song.timeSignature,
    sections: sections.map((s) => ({ kind: s.kind, label: s.label, content: s.content })),
  };
}

/** Anlık görüntüdeki bölümleri ekranda gösterilebilir Section nesnelerine çevirir. */
export function snapshotSections(snap: VersionSnapshot, songId = ""): Section[] {
  return snap.sections.map((s, i) => ({ ...s, id: `snap-${i}`, songId, position: i, createdAt: 0, updatedAt: 0 }));
}

/** Karşılaştırma için anlık görüntünün düz metin hâli. */
export function snapshotText(snap: VersionSnapshot, titleOf: (s: Section, all: Section[]) => string): string {
  const meta = [
    snap.musicalKey ? `Ton: ${snap.musicalKey}` : null,
    snap.tempo ? `Tempo: ${snap.tempo} BPM` : null,
    `Ölçü: ${snap.timeSignature}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const secs = snapshotSections(snap);
  const body = secs.map((s) => [`— ${titleOf(s, secs)} —`, ...(s.content.trim() ? s.content.split("\n") : [])].join("\n"));
  return [meta, ...body].join("\n");
}

export function useVersions(songId: string, onTouched: () => void) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setVersions(await (await getRepo()).listVersions(songId));
      setLoaded(true);
    } catch (e) {
      setError(String(e));
    }
  }, [songId]);

  useEffect(() => {
    setLoaded(false);
    reload();
  }, [reload]);

  const create = useCallback(
    async (song: Song, fields: { name: string; note: string; stage: SongStatus; recordingIds: string[] }) => {
      try {
        const repo = await getRepo();
        const sections = await repo.listSections(song.id);
        const v = await repo.createVersion({ songId: song.id, snapshot: makeSnapshot(song, sections), ...fields });
        setVersions((prev) => [v, ...prev]);
        onTouched();
        return v;
      } catch (e) {
        setError(String(e));
        return undefined;
      }
    },
    [onTouched],
  );

  const update = useCallback(async (id: string, patch: VersionPatch) => {
    setVersions((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    try {
      await (await getRepo()).updateVersion(id, patch);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await (await getRepo()).deleteVersion(id);
      setVersions((prev) => prev.filter((v) => v.id !== id));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  return { versions, loaded, error, clearError: () => setError(null), create, update, remove, reload };
}
