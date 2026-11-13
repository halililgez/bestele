import { useCallback, useEffect, useRef, useState } from "react";
import { getRepo } from "./data/repo";
import type { Section, SectionFields, SectionKind } from "./types";

const SAVE_DELAY = 500;

/**
 * Bir şarkının bölümlerini yükler ve düzenler.
 * Yazı değişiklikleri ekranda hemen görünür, depoya kısa bir gecikmeyle yazılır.
 */
export function useSections(songId: string, onTouched: () => void) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(new Map<string, Partial<SectionFields>>());
  const timer = useRef<number | undefined>(undefined);
  const touchedRef = useRef(onTouched);
  touchedRef.current = onTouched;
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const entries = [...pending.current.entries()];
    pending.current.clear();
    if (entries.length === 0) return;
    try {
      const repo = await getRepo();
      for (const [id, patch] of entries) await repo.updateSection(id, patch);
      touchedRef.current();
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setSections([]);
    (async () => {
      try {
        const repo = await getRepo();
        const list = await repo.listSections(songId);
        if (!cancelled) {
          setSections(list);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
      flush();
    };
  }, [songId, flush]);

  // Ekleme / silme / taşıma işlemleri sırayla çalışır: hızlı çift tıklamada iki ekleme
  // aynı bölüm listesini okuyup aynı sıra numarasını yazmasın.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const run = useCallback(
    (fn: () => Promise<void>) => {
      const next = queue.current.then(async () => {
        try {
          await flush();
          await fn();
          touchedRef.current();
        } catch (e) {
          setError(String(e));
        }
      });
      queue.current = next;
      return next;
    },
    [flush],
  );

  const add = useCallback(
    (kind: SectionKind, index?: number, fields?: Partial<SectionFields>) =>
      run(async () => {
        const repo = await getRepo();
        await repo.createSection(songId, { kind, label: "", content: "", ...fields }, index);
        setSections(await repo.listSections(songId));
      }),
    [run, songId],
  );

  const update = useCallback(
    (id: string, patch: Partial<SectionFields>) => {
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      pending.current.set(id, { ...pending.current.get(id), ...patch });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_DELAY);
    },
    [flush],
  );

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        pending.current.delete(id);
        const repo = await getRepo();
        await repo.deleteSection(id);
        setSections((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, position: i })));
      }),
    [run],
  );

  const move = useCallback(
    (id: string, delta: number) =>
      run(async () => {
        const prev = sectionsRef.current;
        const i = prev.findIndex((s) => s.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= prev.length) return;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        setSections(next.map((s, k) => ({ ...s, position: k })));
        const repo = await getRepo();
        await repo.reorderSections(
          songId,
          next.map((s) => s.id),
        );
      }),
    [run, songId],
  );

  /** Bütün bölümlerin içeriğini bir dönüşümle değiştirir (ör. transpoze). */
  const rewriteAll = useCallback(
    (fn: (content: string) => string) =>
      run(async () => {
        const repo = await getRepo();
        const current = await repo.listSections(songId);
        const next: Section[] = [];
        for (const s of current) {
          const content = fn(s.content);
          next.push(content === s.content ? s : await repo.updateSection(s.id, { content }));
        }
        setSections(next);
      }),
    [run, songId],
  );

  return { sections, loaded, error, clearError: () => setError(null), add, update, remove, move, rewriteAll };
}
