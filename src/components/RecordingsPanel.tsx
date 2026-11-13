import { useMemo, useRef, useState } from "react";
import type { Library } from "../useLibrary";
import type { Recording, Section, Song } from "../types";
import { useSections } from "../useSections";
import { formatDuration, formatSize, measureDuration, useRecordings } from "../useRecordings";
import { sectionTitle } from "../sectionTitle";
import { Recorder } from "./Recorder";
import { ConfirmDialog } from "./Dialog";
import { WaveformEditor } from "./WaveformEditor";
import { RichText, useT } from "../i18n";
import { formatDateTime } from "../util";

interface Props {
  song: Song;
  library: Library;
}

export function RecordingsPanel({ song, library }: Props) {
  const t = useT();
  const touched = () => library.markTouched(song.id);
  const r = useRecordings(song.id, touched);
  const { sections } = useSections(song.id, touched);
  const [targetSection, setTargetSection] = useState<string>("");
  const [filter, setFilter] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Recording | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const sectionName = (id: string | null) => {
    const s = id ? sections.find((x) => x.id === id) : undefined;
    return s ? sectionTitle(s, sections) : null;
  };

  const usedSections = useMemo(() => {
    const ids = new Set(r.recordings.map((x) => x.sectionId).filter(Boolean));
    return sections.filter((s) => ids.has(s.id));
  }, [r.recordings, sections]);

  const visible = filter === null ? r.recordings : r.recordings.filter((x) => (filter === "" ? !x.sectionId : x.sectionId === filter));

  function nextTitle() {
    const base = sectionName(targetSection || null) ?? (song.title || t.common.recording);
    return `${base} · ${formatDateTime(new Date())}`;
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setImporting(true);
    for (const f of Array.from(files)) {
      await r.add({
        blob: f,
        title: f.name.replace(/\.[^.]+$/, ""),
        sectionId: targetSection || null,
        durationMs: await measureDuration(f),
        source: "dosya",
        originalName: f.name,
      });
    }
    setImporting(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="recordings">
      <div className="rec-panel">
        <Recorder
          onRecorded={(blob, durationMs) =>
            r.add({ blob, title: nextTitle(), sectionId: targetSection || null, durationMs, source: "kayit" })
          }
        />
        <div className="rec-options">
          <label className="field">
            <span>{t.recordings.targetSection}</span>
            <select value={targetSection} onChange={(e) => setTargetSection(e.target.value)}>
              <option value="">{t.common.wholeSong}</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {sectionTitle(s, sections)}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={() => fileInput.current?.click()} disabled={importing}>
            {importing ? t.common.loading : t.recordings.uploadFile}
          </button>
          <input ref={fileInput} type="file" accept="audio/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </div>
      </div>

      {r.loaded && r.recordings.length === 0 ? (
        <div className="empty">
          <h2>{t.recordings.emptyTitle}</h2>
          <p>{t.recordings.emptyBody}</p>
        </div>
      ) : (
        <>
          {usedSections.length > 0 && (
            <div className="chips rec-filter">
              <button className={`chip ${filter === null ? "on" : ""}`} onClick={() => setFilter(null)}>
                {t.recordings.allCount(r.recordings.length)}
              </button>
              <button className={`chip ${filter === "" ? "on" : ""}`} onClick={() => setFilter("")}>
                {t.common.wholeSong}
              </button>
              {usedSections.map((s) => (
                <button key={s.id} className={`chip ${filter === s.id ? "on" : ""}`} onClick={() => setFilter(s.id)}>
                  {sectionTitle(s, sections)}
                </button>
              ))}
            </div>
          )}
          <ul className="rec-list">
            {visible.map((rec) => (
              <RecordingItem
                key={rec.id}
                rec={rec}
                sections={sections}
                urlFor={r.urlFor}
                onUpdate={(patch) => r.update(rec.id, patch)}
                onDelete={() => setDeleting(rec)}
                onTrim={async (wav, durationMs) => {
                  await r.add({
                    blob: wav,
                    title: t.recordings.trimmedTitle(rec.title || t.common.recording),
                    sectionId: rec.sectionId,
                    durationMs,
                    source: rec.source,
                    originalName: "kirpilmis.wav",
                  });
                }}
              />
            ))}
          </ul>
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title={t.recordings.deleteRecording}
          message={<RichText parts={t.recordings.deleteRecordingBody(deleting.title || t.common.untitledRecording)} />}
          confirmLabel={t.common.delete}
          onConfirm={() => r.remove(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}

      {r.error && (
        <div className="toast" role="alert">
          <span>{t.common.problem(r.error)}</span>
          <button onClick={r.clearError} aria-label={t.common.close}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

interface ItemProps {
  rec: Recording;
  sections: Section[];
  urlFor: (rec: Recording) => Promise<string>;
  onUpdate: (patch: Partial<Pick<Recording, "title" | "note" | "sectionId">>) => void;
  onDelete: () => void;
  onTrim: (wav: Blob, durationMs: number) => Promise<void>;
}

function RecordingItem({ rec, sections, urlFor, onUpdate, onDelete, onTrim }: ItemProps) {
  const t = useT();
  const [title, setTitle] = useState(rec.title);
  const [showWave, setShowWave] = useState(false);
  const [note, setNote] = useState(rec.note);
  const [src, setSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function play() {
    try {
      setSrc(await urlFor(rec));
    } catch (e) {
      setLoadError(String(e));
    }
  }

  return (
    <li className="rec-item">
      <div className="rec-row">
        {src ? (
          <audio className="rec-audio" src={src} controls autoPlay />
        ) : (
          <button className="play-btn" onClick={play} aria-label={t.common.listen}>
            ▶
          </button>
        )}
        <div className="rec-main">
          <input
            className="rec-title"
            value={title}
            placeholder={t.common.untitledRecording}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== rec.title && onUpdate({ title })}
            aria-label={t.recordings.titleLabel}
          />
          <div className="rec-meta">
            <span className={`badge ${rec.source}`}>{rec.source === "dosya" ? t.recordings.sourceFile : t.recordings.sourceRecording}</span>
            <span>{formatDuration(rec.durationMs)}</span>
            <span>{formatSize(rec.sizeBytes)}</span>
            <span>{formatDateTime(rec.createdAt)}</span>
          </div>
        </div>
        <select
          className="select rec-section"
          value={rec.sectionId ?? ""}
          onChange={(e) => onUpdate({ sectionId: e.target.value || null })}
          aria-label={t.recordings.linkedSection}
        >
          <option value="">{t.common.wholeSong}</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {sectionTitle(s, sections)}
            </option>
          ))}
        </select>
        <button
          className={`icon-btn wave-toggle ${showWave ? "on" : ""}`}
          title={t.recordings.waveform}
          aria-label={t.recordings.waveform}
          aria-pressed={showWave}
          onClick={() => setShowWave((v) => !v)}
        >
          〰
        </button>
        <button className="icon-btn" title={t.recordings.deleteRecording} aria-label={t.recordings.deleteRecording} onClick={onDelete}>
          ×
        </button>
      </div>
      {loadError && <div className="rec-error">{t.recordings.loadFailed(loadError)}</div>}
      {showWave && <WaveformEditor rec={rec} urlFor={urlFor} onTrim={onTrim} />}
      <textarea
        className="rec-note"
        value={note}
        rows={1}
        placeholder={t.recordings.notePlaceholder}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== rec.note && onUpdate({ note })}
      />
    </li>
  );
}
