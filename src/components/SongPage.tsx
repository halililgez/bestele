import { useEffect, useRef, useState } from "react";
import type { Library } from "../useLibrary";
import {
  MAX_CAPO,
  MUSICAL_KEYS,
  normalizeCapo,
  STATUS_ORDER,
  TIME_SIGNATURES,
  type Song,
  type SongFields,
  type SongStatus,
} from "../types";
import { normalizeTag, relativeTime } from "../util";
import { ConfirmDialog } from "./Dialog";
import { SongSheet } from "./SongSheet";
import { RecordingsPanel } from "./RecordingsPanel";
import { DevelopmentPanel } from "./DevelopmentPanel";
import { RichText, useT } from "../i18n";

type Tab = "bilgi" | "beste" | "kayitlar" | "gelisim";

const TABS: Tab[] = ["beste", "kayitlar", "gelisim", "bilgi"];

const SAVE_DELAY = 500;

interface Props {
  song: Song;
  library: Library;
  onBack: () => void;
}

export function SongPage({ song, library, onBack }: Props) {
  const t = useT();
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

  // Ctrl+1..4: sekmeler arasında geç
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || document.querySelector(".overlay, .stage")) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < TABS.length) {
        e.preventDefault();
        setTab(TABS[i]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ton başka yerden (ör. beste sayfasında transpoze) değişirse taslağa yansıt
  useEffect(() => {
    setDraft((d) =>
      d.musicalKey === song.musicalKey && d.tempo === song.tempo && d.capo === song.capo
        ? d
        : { ...d, musicalKey: song.musicalKey, tempo: song.tempo, capo: song.capo },
    );
  }, [song.musicalKey, song.tempo, song.capo]);

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
          {t.song.back}
        </button>

        <input
          className="title-input"
          value={draft.title}
          placeholder={t.common.untitledSong}
          onChange={(e) => change("title", e.target.value)}
          aria-label={t.song.titleLabel}
        />
        <input
          className="writer-input"
          value={draft.writer}
          placeholder={t.song.writerPlaceholder}
          onChange={(e) => change("writer", e.target.value)}
          aria-label={t.song.writerLabel}
        />

        <div className="tabs" role="tablist">
          {TABS.map((id) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {t.song.tabs[id]}
            </button>
          ))}
        </div>

        {tab === "beste" ? (
          <SongSheet song={song} library={library} />
        ) : tab === "kayitlar" ? (
          <RecordingsPanel song={song} library={library} />
        ) : tab === "bilgi" ? (
          <>
            <div className="fields">
              <label className="field">
                <span>{t.song.status}</span>
                <select value={draft.status} onChange={(e) => change("status", e.target.value as SongStatus)}>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {t.status[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t.common.key}</span>
                <select value={draft.musicalKey} onChange={(e) => change("musicalKey", e.target.value)}>
                  <option value="">{t.common.keyUnset}</option>
                  {MUSICAL_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t.common.tempoBpm}</span>
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
                <span>{t.common.timeSignature}</span>
                <select value={draft.timeSignature} onChange={(e) => change("timeSignature", e.target.value)}>
                  {TIME_SIGNATURES.map((ts) => (
                    <option key={ts} value={ts}>
                      {ts}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t.common.capo}</span>
                <select value={draft.capo} onChange={(e) => change("capo", normalizeCapo(e.target.value))} title={t.song.capoTitle}>
                  {Array.from({ length: MAX_CAPO + 1 }, (_, n) => (
                    <option key={n} value={n}>
                      {n === 0 ? t.song.capoNone : t.song.capoFret(n)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t.song.folder}</span>
                <select value={draft.folderId ?? ""} onChange={(e) => change("folderId", e.target.value || null)}>
                  <option value="">{t.common.unfiled}</option>
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
                <span>{t.song.tags}</span>
                <TagEditor tags={draft.tags} onChange={(tags) => change("tags", tags)} />
              </div>
              <label className="field">
                <span>{t.song.notes}</span>
                <textarea
                  value={draft.notes}
                  placeholder={t.song.notesPlaceholder}
                  onChange={(e) => change("notes", e.target.value)}
                />
              </label>
            </div>

            <div className="page-actions">
              <span>
                {t.song.created(relativeTime(song.createdAt), relativeTime(song.updatedAt))}
              </span>
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                {t.song.deleteSong}
              </button>
            </div>
          </>
        ) : (
          <DevelopmentPanel song={song} library={library} />
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t.song.deleteSong}
          message={<RichText parts={t.song.deleteSongBody(draft.title || t.common.untitledSong)} />}
          confirmLabel={t.common.delete}
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
  const t = useT();
  const [input, setInput] = useState("");

  function commit() {
    const t = normalizeTag(input);
    setInput("");
    if (t && !tags.includes(t)) onChange([...tags, t]);
  }

  return (
    <div className="tag-editor">
      {tags.map((tag) => (
        <span key={tag} className="tag-token">
          #{tag}
          <button aria-label={t.song.removeTag(tag)} onClick={() => onChange(tags.filter((x) => x !== tag))}>
            ×
          </button>
        </span>
      ))}
      <input
        value={input}
        placeholder={tags.length ? "" : t.song.tagPlaceholder}
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
