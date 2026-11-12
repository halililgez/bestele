import { useCallback, useEffect, useRef, useState } from "react";
import { getRepo, newId } from "./data/repo";
import { extensionFor, getAudioStore } from "./data/audioStore";
import type { Recording, RecordingPatch } from "./types";

export interface NewAudio {
  blob: Blob;
  title: string;
  sectionId: string | null;
  durationMs: number | null;
  source: Recording["source"];
  originalName?: string;
}

/** Bir şarkının ses kayıtlarını yükler, ekler, düzenler ve çalınabilir adreslerini üretir. */
export function useRecordings(songId: string, onTouched: () => void) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urls = useRef(new Map<string, string>());
  const touchedRef = useRef(onTouched);
  touchedRef.current = onTouched;

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        const list = await (await getRepo()).listRecordings(songId);
        if (!cancelled) {
          setRecordings(list);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    const cache = urls.current;
    return () => {
      cancelled = true;
      for (const u of cache.values()) URL.revokeObjectURL(u);
      cache.clear();
    };
  }, [songId]);

  const add = useCallback(
    async (a: NewAudio): Promise<Recording | undefined> => {
      try {
        const mime = a.blob.type || "audio/webm";
        const fileName = `${newId()}.${extensionFor(mime, a.originalName)}`;
        const data = new Uint8Array(await a.blob.arrayBuffer());
        await getAudioStore().save(fileName, data);
        const rec = await (await getRepo()).createRecording({
          songId,
          sectionId: a.sectionId,
          title: a.title,
          note: "",
          fileName,
          mimeType: mime,
          durationMs: a.durationMs,
          sizeBytes: data.byteLength,
          source: a.source,
        });
        urls.current.set(rec.id, URL.createObjectURL(a.blob));
        setRecordings((prev) => [rec, ...prev]);
        touchedRef.current();
        return rec;
      } catch (e) {
        setError(String(e));
        return undefined;
      }
    },
    [songId],
  );

  const update = useCallback(async (id: string, patch: RecordingPatch) => {
    setRecordings((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try {
      await (await getRepo()).updateRecording(id, patch);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const remove = useCallback(async (rec: Recording) => {
    try {
      await (await getRepo()).deleteRecording(rec.id);
      await getAudioStore().remove(rec.fileName).catch(() => undefined);
      const u = urls.current.get(rec.id);
      if (u) URL.revokeObjectURL(u);
      urls.current.delete(rec.id);
      setRecordings((prev) => prev.filter((r) => r.id !== rec.id));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  /** Kaydın çalınabilir blob adresi (ilk istekte diskten okunur, sonra önbellekten gelir). */
  const urlFor = useCallback(async (rec: Recording): Promise<string> => {
    const cached = urls.current.get(rec.id);
    if (cached) return cached;
    const data = await getAudioStore().load(rec.fileName);
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type: rec.mimeType || "audio/webm" }));
    urls.current.set(rec.id, url);
    return url;
  }, []);

  return { recordings, loaded, error, clearError: () => setError(null), add, update, remove, urlFor };
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "–:––";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Bir ses dosyasının süresini tarayıcıya ölçtürür (ölçülemezse null). */
export function measureDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const timer = window.setTimeout(() => done(null), 5000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null);
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      done(null);
    };
    audio.src = url;
  });
}
