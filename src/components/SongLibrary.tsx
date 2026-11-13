import { useEffect, useMemo, useState } from "react";
import { getRepo } from "../data/repo";
import type { Library } from "../useLibrary";
import { STATUS_LABELS, STATUS_ORDER, type Song, type SongStatus } from "../types";
import { relativeTime, searchFold } from "../util";
import type { LibraryFilter } from "./Sidebar";

type Sort = "updated" | "created" | "title";

interface Props {
  library: Library;
  filter: LibraryFilter;
  onOpen: (id: string) => void;
  onNew: () => void;
}

export function SongLibrary({ library, filter, onOpen, onNew }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SongStatus | null>(null);
  const [sort, setSort] = useState<Sort>("updated");

  const heading = useMemo(() => {
    switch (filter.kind) {
      case "all":
        return "Tüm şarkılar";
      case "unfiled":
        return "Klasörsüz";
      case "tag":
        return `#${filter.tag}`;
      case "folder":
        return library.folders.find((f) => f.id === filter.id)?.name ?? "Klasör";
    }
  }, [filter, library.folders]);

  const inScope = useMemo(
    () =>
      library.songs.filter((s) => {
        switch (filter.kind) {
          case "all":
            return true;
          case "unfiled":
            return !s.folderId;
          case "folder":
            return s.folderId === filter.id;
          case "tag":
            return s.tags.includes(filter.tag);
        }
      }),
    [library.songs, filter],
  );

  // Sözlerde arama: arama kutusu doluyken bölüm metinleri bir kez yüklenir
  const searching = query.trim() !== "";
  const [lyrics, setLyrics] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!searching) return;
    let cancelled = false;
    getRepo()
      .then((r) => r.lyricsIndex())
      .then((index) => !cancelled && setLyrics(index))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [searching, library.songs]);

  const { visible, snippets } = useMemo(() => {
    const q = searchFold(query.trim());
    const snippets = new Map<string, string>();
    const list = inScope.filter((s) => {
      if (status && s.status !== status) return false;
      if (!q) return true;
      if ([s.title, s.writer, s.notes, s.musicalKey, ...s.tags].some((v) => searchFold(v).includes(q))) return true;
      const line = (lyrics[s.id] ?? "")
        .split("\n")
        .map((l) => l.replace(/\[[^\]]*\]/g, "").trim())
        .find((l) => searchFold(l).includes(q));
      if (line) snippets.set(s.id, line.length > 70 ? line.slice(0, 70) + "…" : line);
      return Boolean(line);
    });
    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title, "tr"));
    else if (sort === "created") sorted.sort((a, b) => b.createdAt - a.createdAt);
    else sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    return { visible: sorted, snippets };
  }, [inScope, query, status, sort, lyrics]);

  const nothingYet = library.songs.length === 0;

  return (
    <div className="paper">
      <header className="lib-header">
        <div>
          <h1 className="page-title">{heading}</h1>
          <div className="page-sub">{inScope.length} şarkı</div>
        </div>
        <button className="btn btn-primary" onClick={onNew}>
          + Yeni şarkı
        </button>
      </header>

      {nothingYet ? (
        <div className="empty">
          <h2>Defter boş</h2>
          <p>İlk şarkını ekle: aklındaki bir melodi, yarım bir nakarat, bir akor dizisi… Her şey bir fikirle başlar.</p>
          <button className="btn btn-primary" onClick={onNew}>
            + İlk şarkını ekle
          </button>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <input
              className="search"
              type="search"
              placeholder="Şarkı, söz, etiket ara…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="chips" role="group" aria-label="Durum filtresi">
              <button className={`chip ${status === null ? "on" : ""}`} onClick={() => setStatus(null)}>
                Hepsi
              </button>
              {STATUS_ORDER.map((st) => (
                <button key={st} className={`chip ${status === st ? "on" : ""}`} onClick={() => setStatus(status === st ? null : st)}>
                  {STATUS_LABELS[st]}
                </button>
              ))}
            </div>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sıralama">
              <option value="updated">Son düzenlenen</option>
              <option value="created">Son eklenen</option>
              <option value="title">Ada göre</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="empty">
              <p>Bu filtreye uyan şarkı yok.</p>
            </div>
          ) : (
            <div className="song-grid">
              {visible.map((s) => (
                <SongCard
                  key={s.id}
                  song={s}
                  folderName={library.folders.find((f) => f.id === s.folderId)?.name}
                  snippet={snippets.get(s.id)}
                  onOpen={onOpen}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SongCard({
  song,
  folderName,
  snippet,
  onOpen,
}: {
  song: Song;
  folderName?: string;
  snippet?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <button className="song-card" onClick={() => onOpen(song.id)}>
      <h3 className="title">{song.title || "Adsız şarkı"}</h3>
      {song.writer && <div className="writer">{song.writer}</div>}
      {snippet && <div className="snippet">“{snippet}”</div>}
      <div className="meta">
        {song.musicalKey && <span className="pill">{song.musicalKey}</span>}
        {song.tempo && <span className="pill">{song.tempo} BPM</span>}
        {song.timeSignature && song.timeSignature !== "4/4" && <span className="pill">{song.timeSignature}</span>}
      </div>
      {song.tags.length > 0 && (
        <div className="tags">
          {song.tags.map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </div>
      )}
      <div className="card-foot">
        <span className={`status status-${song.status}`}>{STATUS_LABELS[song.status]}</span>
        <span>{folderName ? `${folderName} · ` : ""}{relativeTime(song.updatedAt)}</span>
      </div>
    </button>
  );
}
