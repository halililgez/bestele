import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Library } from "../useLibrary";
import { getRepo } from "../data/repo";
import { STATUS_LABELS, STATUS_ORDER, type Recording, type Song, type SongStatus, type Version, type VersionSnapshot } from "../types";
import { formatDuration, useRecordings } from "../useRecordings";
import { makeSnapshot, snapshotSections, snapshotText, useVersions } from "../versioning";
import { diffLines, diffStats, type DiffLine } from "../diff";
import { relativeTime } from "../util";
import { sectionTitle, SheetText } from "./SongSheet";
import { ConfirmDialog, Dialog } from "./Dialog";

interface Props {
  song: Song;
  library: Library;
}

const dateFmt = new Intl.DateTimeFormat("tr", { dateStyle: "medium", timeStyle: "short" });

type TimelineEvent =
  | { kind: "version"; at: number; version: Version }
  | { kind: "recording"; at: number; recording: Recording }
  | { kind: "start"; at: number };

type Compare = { versionId: string; against: "previous" | "current"; lines: DiffLine[] };

export function DevelopmentPanel({ song, library }: Props) {
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
      name: `“${version.name}” versiyonuna dönmeden önce`,
      note: "Geri dönmeden önce otomatik kaydedildi.",
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
    setNotice(`Şarkı “${version.name}” hâline döndürüldü. Önceki hâli de versiyon olarak saklandı.`);
  }

  return (
    <div className="development">
      <div className="journey" aria-label="Aşamalar">
        {STATUS_ORDER.map((st, i) => {
          const first = journey.get(st);
          const reached = STATUS_ORDER.indexOf(song.status) >= i;
          return (
            <div key={st} className={`journey-step ${reached ? "reached" : ""} ${song.status === st ? "current" : ""}`}>
              <span className={`journey-dot status-${st}`} />
              <span className="journey-name">{STATUS_LABELS[st]}</span>
              <span className="journey-date">{first ? dateFmt.format(new Date(first.createdAt)) : reached && song.status === st ? "şu an" : "—"}</span>
            </div>
          );
        })}
      </div>

      <div className="dev-toolbar">
        <button className="btn btn-primary" onClick={() => setSaving(true)}>
          + Versiyon kaydet
        </button>
        <label className="check">
          <input type="checkbox" checked={onlyVersions} onChange={(e) => setOnlyVersions(e.target.checked)} />
          Yalnızca versiyonlar
        </label>
      </div>

      {notice && (
        <div className="notice">
          {notice}
          <button className="icon-btn" aria-label="Kapat" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}

      {v.loaded && v.versions.length === 0 && (
        <p className="hint">
          Şarkının şu anki hâlini (sözler, akorlar, ton, tempo) bir versiyon olarak kaydet. Zamanla “İlk taslak”, “Stüdyo öncesi”, “Son hâli” gibi
          versiyonlar biriktikçe şarkının nasıl geliştiğini burada görürsün.
        </p>
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
                    {e.recording.source === "dosya" ? "Dosya yüklendi" : "Kayıt alındı"}: <strong>{e.recording.title || "Adsız kayıt"}</strong>
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
                  <span className="tl-text">Şarkı deftere eklendi</span>
                  <span className="tl-date">{dateFmt.format(new Date(e.at))}</span>
                </div>
              </div>
            </li>
          ),
        )}
      </ol>

      {saving && (
        <SaveVersionDialog
          song={song}
          defaultName={`Versiyon ${v.versions.length + 1}`}
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
          title="Bu versiyona dön"
          message={
            <>
              Sözler, akorlar, ton, tempo ve ölçü <strong>{restoring.name}</strong> versiyonundaki hâline döndürülecek. Şu anki hâli kaybolmaz, önce
              otomatik olarak yeni bir versiyon şeklinde saklanır.
            </>
          }
          confirmLabel="Geri dön"
          onConfirm={() => restore(restoring)}
          onClose={() => setRestoring(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Versiyonu sil"
          message={
            <>
              <strong>{deleting.name}</strong> versiyonu silinecek. Şarkının şu anki hâli ve kayıtlar etkilenmez.
            </>
          }
          confirmLabel="Sil"
          onConfirm={() => v.remove(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}

      {(v.error || rec.error) && (
        <div className="toast" role="alert">
          <span>Bir sorun oldu: {v.error || rec.error}</span>
          <button
            onClick={() => {
              v.clearError();
              rec.clearError();
            }}
            aria-label="Kapat"
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
            aria-label="Versiyon adı"
          />
          <span className={`status status-${version.stage}`}>{STATUS_LABELS[version.stage]}</span>
          <span className="tl-date" title={dateFmt.format(new Date(version.createdAt))}>
            {relativeTime(version.createdAt)}
          </span>
        </div>

        <div className="version-meta">
          <span>{snap.sections.length} bölüm</span>
          <span>{lineCount} satır</span>
          {snap.musicalKey && <span className="pill">{snap.musicalKey}</span>}
          {snap.tempo && <span className="pill">{snap.tempo} BPM</span>}
          {changes && (changes.added > 0 || changes.removed > 0) ? (
            <span className="diffstat">
              öncekine göre <span className="plus">+{changes.added}</span> <span className="minus">−{changes.removed}</span>
            </span>
          ) : changes ? (
            <span className="diffstat">öncekiyle aynı</span>
          ) : (
            <span className="diffstat">ilk versiyon</span>
          )}
        </div>

        <textarea
          className="rec-note"
          rows={1}
          value={note}
          placeholder="Bu versiyonda ne değişti? Neyi denedin?"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== version.note && onUpdate({ note })}
        />

        <div className="version-recs">
          {attached.map((r) => (
            <span key={r.id} className="version-rec">
              <MiniPlayer rec={r} urlFor={urlFor} />
              <span>{r.title || "Adsız kayıt"}</span>
              <span className="muted">{formatDuration(r.durationMs)}</span>
              <button
                className="icon-btn"
                aria-label="Kaydı versiyondan çıkar"
                onClick={() => onUpdate({ recordingIds: version.recordingIds.filter((id) => id !== r.id) })}
              >
                ×
              </button>
            </span>
          ))}
          {attachable.length > 0 && (
            <select
              className="select attach-select"
              value=""
              onChange={(e) => e.target.value && onUpdate({ recordingIds: [...version.recordingIds, e.target.value] })}
              aria-label="Versiyona kayıt ekle"
            >
              <option value="">+ Kayıt bağla…</option>
              {attachable.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title || "Adsız kayıt"}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="version-actions">
          <button className={`chip ${viewing ? "on" : ""}`} onClick={onView}>
            Görüntüle
          </button>
          {previous && (
            <button className={`chip ${compare?.against === "previous" ? "on" : ""}`} onClick={() => onCompare("previous")}>
              Öncekiyle karşılaştır
            </button>
          )}
          <button className={`chip ${compare?.against === "current" ? "on" : ""}`} onClick={() => onCompare("current")}>
            Şimdikiyle karşılaştır
          </button>
          <span className="spacer" />
          <button className="btn" onClick={onRestore}>
            Bu versiyona dön
          </button>
          <button className="icon-btn" aria-label="Versiyonu sil" title="Versiyonu sil" onClick={onDelete}>
            ×
          </button>
        </div>

        {viewing && (
          <div className="sheet version-sheet">
            {secs.filter((s) => s.content.trim()).length === 0 && <p className="hint">Bu versiyonda söz ya da akor yoktu.</p>}
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
              {compare.against === "current" ? "Bu versiyondan şimdiki hâle" : "Önceki versiyondan bu versiyona"}
              {" · "}
              <span className="plus">eklenen</span> / <span className="minus">çıkarılan</span>
            </div>
            {compare.lines.every((l) => l.op === "same") ? (
              <p className="hint">Hiçbir fark yok.</p>
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
    <button className="mini-play" onClick={toggle} aria-label={playing ? "Durdur" : "Dinle"}>
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
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<SongStatus>(song.status);
  const [updateStatus, setUpdateStatus] = useState(true);
  // Son 24 saatteki kayıtlar varsayılan olarak seçili gelir
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(recordings.filter((r) => Date.now() - r.createdAt < 24 * 3600 * 1000).map((r) => r.id)),
  );

  return (
    <Dialog title="Versiyon kaydet" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name: name.trim() || defaultName, note, stage, recordingIds: [...picked] }, updateStatus);
        }}
      >
        <p>Sözler, akorlar, ton ve tempo şu anki hâliyle saklanır.</p>
        <div className="fields">
          <label className="field wide">
            <span>Versiyon adı</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. İlk taslak, Stüdyo öncesi" />
          </label>
          <label className="field">
            <span>Aşama</span>
            <select value={stage} onChange={(e) => setStage(e.target.value as SongStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="field check-field">
            <span>&nbsp;</span>
            <label className="check">
              <input type="checkbox" checked={updateStatus} onChange={(e) => setUpdateStatus(e.target.checked)} disabled={stage === song.status} />
              Şarkının durumunu da güncelle
            </label>
          </label>
          <label className="field wide">
            <span>Not</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ne değişti, neyi denedin?" style={{ minHeight: 0 }} />
          </label>
        </div>
        {recordings.length > 0 && (
          <div className="field">
            <span>Bu versiyonun kayıtları</span>
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
                  {r.title || "Adsız kayıt"} <span className="muted">· {formatDuration(r.durationMs)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn-primary">
            Kaydet
          </button>
        </div>
      </form>
    </Dialog>
  );
}
