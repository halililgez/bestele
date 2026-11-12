import { useEffect, useRef, useState } from "react";
import type { Library } from "../useLibrary";
import {
  MUSICAL_KEYS,
  STATUS_LABELS,
  STATUS_ORDER,
  TIME_SIGNATURES,
  type Song,
  type SongFields,
  type SongStatus,
} from "../types";
import { normalizeTag, relativeTime } from "../util";
import { ConfirmDialog } from "./Dialog";
import { SongSheet } from "./SongSheet";

type Tab = "bilgi" | "beste" | "kayitlar" | "gelisim";

const TABS: { id: Tab; label: string; soon?: boolean }[] = [
  { id: "beste", label: "Beste sayfası" },
  { id: "bilgi", label: "Bilgiler" },
  { id: "kayitlar", label: "Kayıtlar", soon: true },
  { id: "gelisim", label: "Gelişim", soon: true },
];

const SOON_TEXT: Record<Exclude<Tab, "bilgi" | "beste">, { title: string; body: string }> = {
  kayitlar: {
    title: "Kayıtlar",
    body: "Mikrofondan kayıt alabilecek ya da hazır ses dosyalarını yükleyebileceksin. Her kayıt şarkıya ve istersen bir bölüme bağlanacak.",
  },
  gelisim: {
    title: "Gelişim",
    body: "Şarkının versiyonlarını kaydedip ilk fikirden son hâline kadar olan yolculuğu, kayıtlarıyla birlikte bir zaman çizgisinde göreceksin.",
  },
};

const SAVE_DELAY = 500;

interface Props {
  song: Song;
  library: Library;
  onBack: () => void;
}

export function SongPage({ song, library, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("beste");
  const [draft, setDraft] = useState<Song>(song);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pending = useRef<Partial<SongFields>>({});
  const timer = useRef<number | undefined>(undefined);
  const { updateSong } = library;

  // Başka bir şarkıya geçildiğinde taslağı sıfırla
  useEffect(() => {
    setDraft(song);
    setTab("beste");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]);

  // Ton başka yerden (ör. beste sayfasında transpoze) değişirse taslağa yansıt
  useEffect(() => {
    setDraft((d) => (d.musicalKey === song.musicalKey ? d : { ...d, musicalKey: song.musicalKey }));
  }, [song.musicalKey]);

  // Sayfadan çıkarken bekleyen değişiklikleri hemen kaydet
  useEffect(() => {
    const id = song.id;
    return () => {
      window.clearTimeout(timer.current);
      if (Object.keys(pending.current).length) {
        updateSong(id, pending.current);
        pending.current = {};
      }
    };
  }, [song.id, updateSong]);

  function change<K extends keyof SongFields>(key: K, value: SongFields[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    pending.current = { ...pending.current, [key]: value };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const patch = pending.current;
      pending.current = {};
      updateSong(song.id, patch);
    }, SAVE_DELAY);
  }

  return (
    <div className="paper">
      <div className="song-page">
        <button className="back" onClick={onBack}>
          ← Şarkılar
        </button>

        <input
          className="title-input"
          value={draft.title}
          placeholder="Adsız şarkı"
          onChange={(e) => change("title", e.target.value)}
          aria-label="Şarkının adı"
        />
        <input
          className="writer-input"
          value={draft.writer}
          placeholder="Söz / müzik…"
          onChange={(e) => change("writer", e.target.value)}
          aria-label="Söz ve müzik"
        />

        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label}
              {t.soon && <span className="soon">yakında</span>}
            </button>
          ))}
        </div>

        {tab === "beste" ? (
          <SongSheet song={song} library={library} />
        ) : tab === "bilgi" ? (
          <>
            <div className="fields">
              <label className="field">
                <span>Durum</span>
                <select value={draft.status} onChange={(e) => change("status", e.target.value as SongStatus)}>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Ton</span>
                <select value={draft.musicalKey} onChange={(e) => change("musicalKey", e.target.value)}>
                  <option value="">Belirsiz</option>
                  {MUSICAL_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tempo (BPM)</span>
                <input
                  type="number"
                  min={20}
                  max={300}
                  value={draft.tempo ?? ""}
                  placeholder="—"
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    change("tempo", Number.isFinite(n) && n > 0 ? n : null);
                  }}
                />
              </label>
              <label className="field">
                <span>Ölçü</span>
                <select value={draft.timeSignature} onChange={(e) => change("timeSignature", e.target.value)}>
                  {TIME_SIGNATURES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Klasör</span>
                <select value={draft.folderId ?? ""} onChange={(e) => change("folderId", e.target.value || null)}>
                  <option value="">Klasörsüz</option>
                  {library.folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="fields" style={{ gridTemplateColumns: "1fr" }}>
              <div className="field">
                <span>Etiketler</span>
                <TagEditor tags={draft.tags} onChange={(tags) => change("tags", tags)} />
              </div>
              <label className="field">
                <span>Notlar</span>
                <textarea
                  value={draft.notes}
                  placeholder="Fikirler, ilham, kime gidecek, ne eksik…"
                  onChange={(e) => change("notes", e.target.value)}
                />
              </label>
            </div>

            <div className="page-actions">
              <span>
                Oluşturuldu {relativeTime(song.createdAt)} · son değişiklik {relativeTime(song.updatedAt)}
              </span>
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                Şarkıyı sil
              </button>
            </div>
          </>
        ) : (
          <div className="soon-panel">
            <h3>{SOON_TEXT[tab].title}</h3>
            <p>{SOON_TEXT[tab].body}</p>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Şarkıyı sil"
          message={
            <>
              <strong>{draft.title || "Adsız şarkı"}</strong> kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </>
          }
          confirmLabel="Sil"
          onConfirm={async () => {
            window.clearTimeout(timer.current);
            pending.current = {};
            await library.deleteSong(song.id);
            onBack();
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  function commit() {
    const t = normalizeTag(input);
    setInput("");
    if (t && !tags.includes(t)) onChange([...tags, t]);
  }

  return (
    <div className="tag-editor">
      {tags.map((t) => (
        <span key={t} className="tag-token">
          #{t}
          <button aria-label={`${t} etiketini kaldır`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        value={input}
        placeholder={tags.length ? "" : "Etiket ekle (Enter)…  ör. aşk, akustik"}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !input && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}
