import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Library } from "../useLibrary";
import { getRepo } from "../data/repo";
import { STATUS_ORDER, type Recording, type Song, type SongStatus, type Version, type VersionSnapshot } from "../types";
import { formatDuration, useRecordings } from "../useRecordings";
import { makeSnapshot, snapshotSections, snapshotText, useVersions } from "../versioning";
import { diffLines, diffStats, type DiffLine } from "../diff";
import { formatDateTime, relativeTime } from "../util";
import { RichText, useT } from "../i18n";
import { SheetText } from "./SongSheet";
import { sectionTitle } from "../sectionTitle";
import { ConfirmDialog, Dialog } from "./Dialog";
import { Select, statusOptions } from "./Select";

interface Props {
  song: Song;
  library: Library;
}

type TimelineEvent =
  | { kind: "version"; at: number; version: Version }
  | { kind: "recording"; at: number; recording: Recording }
  | { kind: "start"; at: number };

type Compare = { versionId: string; against: "previous" | "current"; lines: DiffLine[] };

export function DevelopmentPanel({ song, library }: Props) {
  const t = useT();
  const touched = useCallback(() => library.markTouched(song.id), [library, song.id]);
  const v = useVersions(song.id, touched);
  const rec = useRecordings(song.id, touched);
  const [saving, setSaving] = useState(false);
  const [onlyVersions, setOnlyVersions] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [compare, setCompare] = useState<Compare | null>(null);
  const [restoring, setRestoring] = useState<Version | null>(null);
  const [deleting, setDeleting] = useState<Version | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const recById = useMemo(() => new Map(rec.recordings.map((r) => [r.id, r])), [rec.recordings]);

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = v.versions.map((version) => ({ kind: "version", at: version.createdAt, version }));
    if (!onlyVersions) {
      for (const r of rec.recordings) list.push({ kind: "recording", at: r.createdAt, recording: r });
      list.push({ kind: "start", at: song.createdAt });
    }
    return list.sort((a, b) => b.at - a.at);
  }, [v.versions, rec.recordings, onlyVersions, song.createdAt]);

  /** Her aşamaya ilk ulaşılan versiyon */
  const journey = useMemo(() => {
    const firsts = new Map<SongStatus, Version>();
    for (const version of [...v.versions].reverse()) if (!firsts.has(version.stage)) firsts.set(version.stage, version);
    return firsts;
  }, [v.versions]);

  const titleOf = sectionTitle;

  async function currentSnapshot(): Promise<VersionSnapshot> {
    const sections = await (await getRepo()).listSections(song.id);
    return makeSnapshot(song, sections);
  }

  async function toggleCompare(version: Version, against: Compare["against"]) {
    if (compare?.versionId === version.id && compare.against === against) {
      setCompare(null);
      return;
    }
    let before: VersionSnapshot | null;
    let after: VersionSnapshot;
    if (against === "current") {
      before = version.snapshot;
      after = await currentSnapshot();
    } else {
      const idx = v.versions.findIndex((x) => x.id === version.id);
      before = v.versions[idx + 1]?.snapshot ?? null;
      after = version.snapshot;
    }
    const lines = diffLines(before ? snapshotText(before, titleOf) : "", snapshotText(after, titleOf));
    setViewing(null);
    setCompare({ versionId: version.id, against, lines });
  }

  async function restore(version: Version) {
    await v.create(song, {
      name: t.development.beforeRestoreName(version.name),
      note: t.development.beforeRestoreNote,
      stage: song.status,
      recordingIds: [],
    });
    const repo = await getRepo();
    await repo.replaceSections(song.id, version.snapshot.sections);
    await library.updateSong(song.id, {
      musicalKey: version.snapshot.musicalKey,
      tempo: version.snapshot.tempo,
      timeSignature: version.snapshot.timeSignature,
    });
    setCompare(null);
    setNotice(t.development.restored(version.name));
  }

  return (
    <div className="development">
      <div className="journey" aria-label={t.development.stages}>
        {STATUS_ORDER.map((st, i) => {
          const first = journey.get(st);
          const reached = STATUS_ORDER.indexOf(song.status) >= i;
          return (
            <div key={st} className={`journey-step ${reached ? "reached" : ""} ${song.status === st ? "current" : ""}`}>
              <span className={`journey-dot status-${st}`} />
              <span className="journey-name">{t.status[st]}</span>
              <span className="journey-date">{first ? formatDateTime(first.createdAt) : reached && song.status === st ? t.development.now : "—"}</span>
            </div>
          );
        })}
      </div>

      <div className="dev-toolbar">
        <button className="btn btn-primary" onClick={() => setSaving(true)}>
          {t.development.saveVersion}
        </button>
        <label className="check">
          <input type="checkbox" checked={onlyVersions} onChange={(e) => setOnlyVersions(e.target.checked)} />
          {t.development.onlyVersions}
        </label>
      </div>

      {notice && (
        <div className="notice">
          {notice}
          <button className="icon-btn" aria-label={t.common.close} onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}

      {v.loaded && v.versions.length === 0 && (
        <p className="hint">{t.development.emptyHint}</p>
      )}

      <ol className="timeline">
        {events.map((e) =>
          e.kind === "version" ? (
            <VersionItem
              key={e.version.id}
              version={e.version}
              previous={v.versions[v.versions.findIndex((x) => x.id === e.version.id) + 1] ?? null}
              recordings={rec.recordings}
              recById={recById}
              urlFor={rec.urlFor}
              viewing={viewing === e.version.id}
              compare={compare?.versionId === e.version.id ? compare : null}
              onView={() => {
                setCompare(null);
                setViewing(viewing === e.version.id ? null : e.version.id);
              }}
              onCompare={(against) => toggleCompare(e.version, against)}
              onUpdate={(patch) => v.update(e.version.id, patch)}
              onRestore={() => setRestoring(e.version)}
              onDelete={() => setDeleting(e.version)}
            />
          ) : e.kind === "recording" ? (
            <li key={`r-${e.recording.id}`} className="tl-item tl-minor">
              <span className="tl-icon">🎙</span>
              <div className="tl-body">
                <div className="tl-line">
                  <MiniPlayer rec={e.recording} urlFor={rec.urlFor} />
                  <span className="tl-text">
                    {e.recording.source === "dosya" ? t.development.fileUploaded : t.development.recorded}: <strong>{e.recording.title || t.common.untitledRecording}</strong>
                  </span>
                  <span className="tl-date">{relativeTime(e.at)}</span>
                </div>
              </div>
            </li>
          ) : (
            <li key="start" className="tl-item tl-minor">
              <span className="tl-icon">✎</span>
              <div className="tl-body">
                <div className="tl-line">
                  <span className="tl-text">{t.development.songAdded}</span>
                  <span className="tl-date">{formatDateTime(e.at)}</span>
                </div>
              </div>
            </li>
          ),
        )}
      </ol>

      {saving && (
        <SaveVersionDialog
          song={song}
          defaultName={t.development.defaultVersionName(v.versions.length + 1)}
          recordings={rec.recordings}
          onClose={() => setSaving(false)}
          onSave={async (fields, updateStatus) => {
            setSaving(false);
            await v.create(song, fields);
            if (updateStatus && fields.stage !== song.status) await library.updateSong(song.id, { status: fields.stage });
          }}
        />
      )}

      {restoring && (
        <ConfirmDialog
          title={t.development.restoreTitle}
          message={<RichText parts={t.development.restoreBody(restoring.name)} />}
          confirmLabel={t.development.restoreConfirm}
          onConfirm={() => restore(restoring)}
          onClose={() => setRestoring(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={t.development.deleteVersion}
          message={<RichText parts={t.development.deleteVersionBody(deleting.name)} />}
          confirmLabel={t.common.delete}
          onConfirm={() => v.remove(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}

      {(v.error || rec.error) && (
        <div className="toast" role="alert">
          <span>{t.common.problem(v.error || rec.error || "")}</span>
          <button
            onClick={() => {
              v.clearError();
              rec.clearError();
            }}
            aria-label={t.common.close}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

interface ItemProps {
  version: Version;
  previous: Version | null;
  recordings: Recording[];
  recById: Map<string, Recording>;
  urlFor: (r: Recording) => Promise<string>;
  viewing: boolean;
  compare: Compare | null;
  onView: () => void;
  onCompare: (against: Compare["against"]) => void;
  onUpdate: (patch: { name?: string; note?: string; recordingIds?: string[] }) => void;
  onRestore: () => void;
  onDelete: () => void;
}

function VersionItem({ version, previous, recordings, recById, urlFor, viewing, compare, onView, onCompare, onUpdate, onRestore, onDelete }: ItemProps) {
  const t = useT();
  const [name, setName] = useState(version.name);
  const [note, setNote] = useState(version.note);
  const snap = version.snapshot;
  const secs = useMemo(() => snapshotSections(snap), [snap]);
  const lineCount = snap.sections.reduce((n, s) => n + (s.content.trim() ? s.content.split("\n").length : 0), 0);

  const changes = useMemo(() => {
    if (!previous) return null;
    return diffStats(diffLines(snapshotText(previous.snapshot, sectionTitle), snapshotText(snap, sectionTitle)));
  }, [previous, snap]);

  const attached = version.recordingIds.map((id) => recById.get(id)).filter((r): r is Recording => Boolean(r));
  const attachable = recordings.filter((r) => !version.recordingIds.includes(r.id));

  return (
    <li className="tl-item tl-version">
      <span className={`tl-icon status-${version.stage}`}>●</span>
      <div className="tl-body version-card">
        <div className="version-head">
          <input
            className="version-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== version.name && onUpdate({ name: name.trim() })}
            aria-label={t.development.versionName}
          />
          <span className={`status status-${version.stage}`}>{t.status[version.stage]}</span>
          <span className="tl-date" title={formatDateTime(version.createdAt)}>
            {relativeTime(version.createdAt)}
          </span>
        </div>

        <div className="version-meta">
          <span>{t.development.sectionCount(snap.sections.length)}</span>
          <span>{t.development.lineCount(lineCount)}</span>
          {snap.musicalKey && <span className="pill">{snap.musicalKey}</span>}
          {snap.tempo && <span className="pill">{snap.tempo} BPM</span>}
          {changes && (changes.added > 0 || changes.removed > 0) ? (
            <span className="diffstat">
              {t.development.vsPrevious} <span className="plus">+{changes.added}</span> <span className="minus">−{changes.removed}</span>
            </span>
          ) : changes ? (
            <span className="diffstat">{t.development.sameAsPrevious}</span>
          ) : (
            <span className="diffstat">{t.development.firstVersion}</span>
          )}
        </div>

        <textarea
          className="rec-note"
          rows={1}
          value={note}
          placeholder={t.development.versionNotePlaceholder}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== version.note && onUpdate({ note })}
        />

        <div className="version-recs">
          {attached.map((r) => (
            <span key={r.id} className="version-rec">
              <MiniPlayer rec={r} urlFor={urlFor} />
              <span>{r.title || t.common.untitledRecording}</span>
              <span className="muted">{formatDuration(r.durationMs)}</span>
              <button
                className="icon-btn"
                aria-label={t.development.detachRecording}
                onClick={() => onUpdate({ recordingIds: version.recordingIds.filter((id) => id !== r.id) })}
              >
                ×
              </button>
            </span>
          ))}
          {attachable.length > 0 && (
            <Select
              size="sm"
              className="attach-select"
              value=""
              placeholder={t.development.attachPlaceholder}
              onChange={(id) => id && onUpdate({ recordingIds: [...version.recordingIds, id] })}
              ariaLabel={t.development.attachRecording}
              options={attachable.map((r) => ({ value: r.id, label: r.title || t.common.untitledRecording }))}
            />
          )}
        </div>

        <div className="version-actions">
          <button className={`chip ${viewing ? "on" : ""}`} onClick={onView}>
            {t.development.view}
          </button>
          {previous && (
            <button className={`chip ${compare?.against === "previous" ? "on" : ""}`} onClick={() => onCompare("previous")}>
              {t.development.comparePrevious}
            </button>
          )}
          <button className={`chip ${compare?.against === "current" ? "on" : ""}`} onClick={() => onCompare("current")}>
            {t.development.compareCurrent}
          </button>
          <span className="spacer" />
          <button className="btn" onClick={onRestore}>
            {t.development.restoreTitle}
          </button>
          <button className="icon-btn" aria-label={t.development.deleteVersion} title={t.development.deleteVersion} onClick={onDelete}>
            ×
          </button>
        </div>

        {viewing && (
          <div className="sheet version-sheet">
            {secs.filter((s) => s.content.trim()).length === 0 && <p className="hint">{t.development.noLyrics}</p>}
            {secs
              .filter((s) => s.content.trim())
              .map((s) => (
                <section key={s.id} className={`sheet-section kind-${s.kind}`}>
                  <h3 className="sheet-label">{sectionTitle(s, secs)}</h3>
                  <SheetText text={s.content} />
                </section>
              ))}
          </div>
        )}

        {compare && (
          <div className="diff">
            <div className="diff-legend">
              {compare.against === "current" ? t.development.diffToCurrent : t.development.diffFromPrevious}
              {" · "}
              <span className="plus">{t.development.added}</span> / <span className="minus">{t.development.removed}</span>
            </div>
            {compare.lines.every((l) => l.op === "same") ? (
              <p className="hint">{t.development.noDiff}</p>
            ) : (
              <pre className="diff-body">
                {compare.lines.map((l, i) => (
                  <div key={i} className={`diff-line ${l.op}`}>
                    <span className="diff-sign">{l.op === "add" ? "+" : l.op === "del" ? "−" : " "}</span>
                    {l.text || " "}
                  </div>
                ))}
              </pre>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function MiniPlayer({ rec, urlFor }: { rec: Recording; urlFor: (r: Recording) => Promise<string> }) {
  const t = useT();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => audio.current?.pause(), []);

  async function toggle() {
    if (!audio.current) {
      const a = new Audio(await urlFor(rec));
      a.onended = () => setPlaying(false);
      a.onpause = () => setPlaying(false);
      a.onplay = () => setPlaying(true);
      audio.current = a;
    }
    if (audio.current.paused) audio.current.play();
    else audio.current.pause();
  }

  return (
    <button className="mini-play" onClick={toggle} aria-label={playing ? t.common.stop : t.common.listen}>
      {playing ? "❚❚" : "▶"}
    </button>
  );
}

interface SaveProps {
  song: Song;
  defaultName: string;
  recordings: Recording[];
  onClose: () => void;
  onSave: (fields: { name: string; note: string; stage: SongStatus; recordingIds: string[] }, updateStatus: boolean) => void;
}

function SaveVersionDialog({ song, defaultName, recordings, onClose, onSave }: SaveProps) {
  const t = useT();
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<SongStatus>(song.status);
  const [updateStatus, setUpdateStatus] = useState(true);
  // Son 24 saatteki kayıtlar varsayılan olarak seçili gelir
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(recordings.filter((r) => Date.now() - r.createdAt < 24 * 3600 * 1000).map((r) => r.id)),
  );

  return (
    <Dialog title={t.development.saveTitle} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name: name.trim() || defaultName, note, stage, recordingIds: [...picked] }, updateStatus);
        }}
      >
        <p>{t.development.saveIntro}</p>
        <div className="fields">
          <label className="field wide">
            <span>{t.development.versionName}</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t.development.namePlaceholder} />
          </label>
          <label className="field">
            <span>{t.development.stage}</span>
            <Select value={stage} onChange={(v) => setStage(v as SongStatus)} options={statusOptions(t.status)} />
          </label>
          <label className="field check-field">
            <span>&nbsp;</span>
            <label className="check">
              <input type="checkbox" checked={updateStatus} onChange={(e) => setUpdateStatus(e.target.checked)} disabled={stage === song.status} />
              {t.development.updateStatus}
            </label>
          </label>
          <label className="field wide">
            <span>{t.development.note}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t.development.notePlaceholder} style={{ minHeight: 0 }} />
          </label>
        </div>
        {recordings.length > 0 && (
          <div className="field">
            <span>{t.development.versionRecordings}</span>
            <div className="pick-list">
              {recordings.slice(0, 12).map((r) => (
                <label key={r.id} className="check">
                  <input
                    type="checkbox"
                    checked={picked.has(r.id)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(r.id);
                      else next.delete(r.id);
                      setPicked(next);
                    }}
                  />
                  {r.title || t.common.untitledRecording} <span className="muted">· {formatDuration(r.durationMs)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary">
            {t.common.save}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
