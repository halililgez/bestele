import { useEffect, useMemo, useRef, useState } from "react";
import { saveFile, safeFileName, songToChordPro, songToText } from "../exporting";
import type { Library } from "../useLibrary";
import { useSections } from "../useSections";
import { SECTION_ORDER, type Section, type SectionKind, type Song } from "../types";
import { chordsIn, diatonicChords, playView, prefersFlats, tokenizeLine, transposeKey, transposeText } from "../chords";
import { ConfirmDialog } from "./Dialog";
import { sectionTitle } from "../sectionTitle";
import { MetronomeControl } from "./MetronomeControl";
import { StageMode } from "./StageMode";
import { ChordStrip } from "./ChordDiagram";
import { ChordPicker } from "./ChordPicker";
import { Select } from "./Select";
import { RichText, useT } from "../i18n";

type Mode = "yaz" | "oku";

const QUICK_KINDS: SectionKind[] = ["kita", "nakarat", "onnakarat", "kopru", "giris", "solo", "final"];
const TEMPLATE: SectionKind[] = ["kita", "nakarat", "kita", "nakarat", "kopru", "nakarat"];


interface Props {
  song: Song;
  library: Library;
}

export function SongSheet({ song, library }: Props) {
  const t = useT();
  const s = useSections(song.id, () => library.markTouched(song.id));
  const [mode, setMode] = useState<Mode>("yaz");
  const [transpose, setTranspose] = useState(0);
  const [scale, setScale] = useState(1);
  const [deleting, setDeleting] = useState<Section | null>(null);
  const active = useRef<{ id: string; el: HTMLTextAreaElement } | null>(null);
  const areas = useRef(new Map<string, HTMLTextAreaElement>());
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [stage, setStage] = useState(false);
  const [showShapes, setShowShapes] = useState(() => {
    try {
      return localStorage.getItem("bestele:show-shapes") === "1";
    } catch {
      return false;
    }
  });

  const [playCapo, setPlayCapo] = useState(() => {
    try {
      return localStorage.getItem("bestele:play-capo") !== "0";
    } catch {
      return true;
    }
  });

  function togglePlayCapo() {
    setPlayCapo((v) => {
      try {
        localStorage.setItem("bestele:play-capo", v ? "0" : "1");
      } catch {
        /* tercih kaydedilemezse sorun değil */
      }
      return !v;
    });
  }

  function toggleShapes() {
    setShowShapes((v) => {
      try {
        localStorage.setItem("bestele:show-shapes", v ? "0" : "1");
      } catch {
        /* tercih kaydedilemezse sorun değil */
      }
      return !v;
    });
  }

  const key = song.musicalKey;
  const targetKey = key ? transposeKey(key, transpose) : "";
  const flats = targetKey ? prefersFlats(targetKey) : false;
  const capo = song.capo ?? 0;
  const capoOn = capo > 0 && playCapo;
  // Oku / sahne / şemalarda gösterilen akorlar (capo açıksa çalınan şekiller)
  const view = capoOn ? playView(key, transpose, capo) : { semis: transpose, key: targetKey, flats };
  const capoLabel = capo > 0 ? (capoOn && view.key ? t.sheet.capoShape(capo, view.key) : t.sheet.capoLabel(capo)) : "";

  const used = useMemo(() => chordsIn(s.sections.map((x) => x.content).join("\n")), [s.sections]);
  const diatonic = useMemo(() => diatonicChords(key || "C"), [key]);
  const extraUsed = used.filter((c) => !diatonic.includes(c));

  function insertChord(chord: string) {
    const clean = chord.trim();
    if (!clean) return;
    let a = active.current;
    let start: number;
    let end: number;
    if (a && a.el.isConnected) {
      start = a.el.selectionStart;
      end = a.el.selectionEnd;
    } else {
      // Henüz hiçbir söz kutusuna tıklanmadıysa ilk bölümün sonuna ekle
      const first = s.sections[0];
      const el = first && areas.current.get(first.id);
      if (!first || !el) return;
      a = active.current = { id: first.id, el };
      start = end = el.value.length;
    }
    const el = a.el;
    const ins = `[${clean}]`;
    s.update(a.id, { content: el.value.slice(0, start) + ins + el.value.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ins.length, start + ins.length);
    });
  }

  async function applyTranspose() {
    const semis = transpose;
    await s.rewriteAll((c) => transposeText(c, semis, flats));
    if (key) await library.updateSong(song.id, { musicalKey: targetKey });
    setTranspose(0);
  }

  async function addTemplate() {
    for (const kind of TEMPLATE) await s.add(kind);
  }

  // Ctrl+E: Yaz/Oku, Ctrl+P: Oku görünümüne geçip yazdır
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || document.querySelector(".overlay, .stage")) return;
      const k = e.key.toLowerCase();
      if (k === "e") {
        e.preventDefault();
        setMode((m) => (m === "yaz" ? "oku" : "yaz"));
      } else if (k === "p") {
        e.preventDefault();
        setMode("oku");
        window.setTimeout(() => window.print(), 80);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function exportAs(kind: "txt" | "cho") {
    const name = safeFileName(song.title);
    try {
      if (kind === "txt") await saveFile(`${name}.txt`, songToText(song, s.sections, sectionTitle), t.common.filterText);
      else await saveFile(`${name}.cho`, songToChordPro(song, s.sections, sectionTitle), "ChordPro");
    } catch (e) {
      setExportError(t.common.saveFailed(e instanceof Error ? e.message : String(e)));
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(songToText(song, s.sections, sectionTitle));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* pano erişimi yoksa sessizce geç */
    }
  }

  if (!s.loaded) return null;

  return (
    <div className="sheet-wrap">
      <div className="sheet-toolbar">
        <div className="segmented" role="radiogroup" aria-label={t.sheet.view}>
          <button role="radio" aria-checked={mode === "yaz"} className={mode === "yaz" ? "on" : ""} onClick={() => setMode("yaz")}>
            {t.sheet.write}
          </button>
          <button role="radio" aria-checked={mode === "oku"} className={mode === "oku" ? "on" : ""} onClick={() => setMode("oku")}>
            {t.sheet.read}
          </button>
        </div>

        {mode === "oku" && (
          <>
            <div className="stepper" aria-label={t.sheet.transpose}>
              <button className="icon-btn" aria-label={t.sheet.semitoneDown} onClick={() => setTranspose((t) => t - 1)}>
                −
              </button>
              <span className="stepper-label">
                {transpose === 0 ? t.sheet.transpose : `${transpose > 0 ? "+" : ""}${transpose}`}
                {key && transpose !== 0 && (
                  <>
                    {" · "}
                    {key} → <strong>{targetKey}</strong>
                  </>
                )}
              </span>
              <button className="icon-btn" aria-label={t.sheet.semitoneUp} onClick={() => setTranspose((t) => t + 1)}>
                +
              </button>
            </div>
            {transpose !== 0 && (
              <>
                <button className="btn" onClick={() => setTranspose(0)}>
                  {t.sheet.reset}
                </button>
                <button className="btn btn-primary" onClick={applyTranspose}>
                  {t.sheet.saveInKey}
                </button>
              </>
            )}
            <div className="stepper" aria-label={t.sheet.fontSize}>
              <button className="icon-btn" aria-label={t.common.fontSmaller} onClick={() => setScale((v) => Math.max(0.7, v - 0.1))}>
                A−
              </button>
              <button className="icon-btn" aria-label={t.common.fontLarger} onClick={() => setScale((v) => Math.min(2, v + 0.1))}>
                A+
              </button>
            </div>
            <button className={`chip ${showShapes ? "on" : ""}`} onClick={toggleShapes} aria-pressed={showShapes}>
              {t.sheet.chordShapes}
            </button>
            {capo > 0 && (
              <button
                className={`chip ${capoOn ? "on" : ""}`}
                onClick={togglePlayCapo}
                aria-pressed={capoOn}
                title={t.sheet.playWithCapoTitle}
              >
                {t.sheet.playWithCapo(capo)}
              </button>
            )}
            <span className="toolbar-spacer" />
            <div className="export-group">
              <button className="btn btn-primary" onClick={() => setStage(true)} title={t.sheet.stageModeTitle}>
                {t.sheet.stageMode}
              </button>
              <button className="btn" onClick={() => window.print()} title="Ctrl + P">
                {t.sheet.print}
              </button>
              <button className="btn" onClick={copyText} title={t.sheet.copyTitle}>
                {copied ? t.sheet.copied : t.sheet.copyText}
              </button>
              <button className="btn" onClick={() => exportAs("txt")} title={t.sheet.txtTitle}>
                .txt
              </button>
              <button className="btn" onClick={() => exportAs("cho")} title={t.sheet.chordProTitle}>
                ChordPro
              </button>
            </div>
          </>
        )}
      </div>

      <MetronomeControl
        tempo={song.tempo}
        timeSignature={song.timeSignature}
        onTempo={(bpm) => library.updateSong(song.id, { tempo: bpm })}
      />

      {stage && (
        <StageMode
          song={song}
          sections={s.sections}
          transpose={view.semis}
          flats={view.flats}
          keyLabel={[targetKey, capoLabel].filter(Boolean).join(" · ")}
          onClose={() => setStage(false)}
        />
      )}

      {mode === "yaz" && s.sections.length > 0 && (
        <div className="palette" onMouseDown={(e) => e.target instanceof HTMLButtonElement && e.preventDefault()}>
          <span className="palette-title">{key ? t.sheet.inKey(key) : t.sheet.noKey}</span>
          {diatonic.map((c) => (
            <button key={c} className="chord-chip" onClick={() => insertChord(c)} title={t.sheet.insertChord(c)}>
              {c}
            </button>
          ))}
          {extraUsed.length > 0 && <span className="palette-sep" />}
          {extraUsed.map((c) => (
            <button key={c} className="chord-chip used" onClick={() => insertChord(c)} title={t.sheet.insertChord(c)}>
              {c}
            </button>
          ))}
          <span className="palette-custom">
            <ChordPicker flats={prefersFlats(key || "C")} defaultRoot={/^[A-G][#b]?/.exec(key)?.[0] ?? "C"} onInsert={insertChord} />
          </span>
        </div>
      )}

      {s.sections.length === 0 ? (
        <div className="empty sheet-empty">
          <h2>{t.sheet.emptyTitle}</h2>
          <p>{t.sheet.emptyBody}</p>
          <div className="add-row center">
            {QUICK_KINDS.slice(0, 4).map((k) => (
              <button key={k} className="btn" onClick={() => s.add(k)}>
                + {t.sectionKinds[k]}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={addTemplate}>
            {t.sheet.template}
          </button>
        </div>
      ) : mode === "yaz" ? (
        <>
          <p className="hint">
            {t.sheet.hintBefore}
            <code>{t.sheet.hintExample}</code>
            {t.sheet.hintAfter}
          </p>
          {s.sections.map((sec, i) => (
            <div className="section-card" key={sec.id}>
              <div className="section-head">
                <Select
                  size="sm"
                  className="kind-select"
                  value={sec.kind}
                  onChange={(k) => s.update(sec.id, { kind: k })}
                  ariaLabel={t.sheet.sectionKind}
                  options={SECTION_ORDER.map((k) => ({ value: k, label: t.sectionKinds[k] }))}
                />
                <input
                  className="label-input"
                  value={sec.label}
                  placeholder={sectionTitle({ ...sec, label: "" }, s.sections)}
                  onChange={(e) => s.update(sec.id, { label: e.target.value })}
                  aria-label={t.sheet.sectionName}
                />
                <span className="section-actions">
                  <button className="icon-btn" title={t.sheet.moveUp} aria-label={t.sheet.moveUp} disabled={i === 0} onClick={() => s.move(sec.id, -1)}>
                    ↑
                  </button>
                  <button
                    className="icon-btn"
                    title={t.sheet.moveDown}
                    aria-label={t.sheet.moveDown}
                    disabled={i === s.sections.length - 1}
                    onClick={() => s.move(sec.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="icon-btn"
                    title={t.sheet.duplicate}
                    aria-label={t.sheet.duplicate}
                    onClick={() => s.add(sec.kind, i + 1, { label: sec.label, content: sec.content })}
                  >
                    ⧉
                  </button>
                  <button
                    className="icon-btn"
                    title={t.sheet.deleteSection}
                    aria-label={t.sheet.deleteSection}
                    onClick={() => (sec.content.trim() ? setDeleting(sec) : s.remove(sec.id))}
                  >
                    ×
                  </button>
                </span>
              </div>
              <textarea
                className="section-text"
                value={sec.content}
                rows={Math.max(3, sec.content.split("\n").length + 1)}
                placeholder={t.sheet.lyricsPlaceholder}
                spellCheck={false}
                ref={(el) => {
                  if (el) areas.current.set(sec.id, el);
                  else areas.current.delete(sec.id);
                }}
                onFocus={(e) => (active.current = { id: sec.id, el: e.currentTarget })}
                onChange={(e) => s.update(sec.id, { content: e.target.value })}
              />
            </div>
          ))}
          <div className="add-row">
            <span className="add-label">{t.sheet.addSection}</span>
            {QUICK_KINDS.map((k) => (
              <button key={k} className="chip" onClick={() => s.add(k)}>
                + {t.sectionKinds[k]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="sheet" style={{ fontSize: `${scale}em` }}>
          <header className="print-head">
            <h1>{song.title || t.common.untitledSong}</h1>
            <p>
              {[
                song.writer,
                targetKey && t.sheet.keyMeta(targetKey),
                song.tempo && `${song.tempo} BPM`,
                song.timeSignature,
                capoLabel,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
          </header>
          {showShapes && <ChordStrip chords={chordsIn(transposeText(s.sections.map((x) => x.content).join("\n"), view.semis, view.flats))} />}
          {s.sections.every((sec) => !sec.content.trim()) && (
            <p className="hint">{t.sheet.allEmpty}</p>
          )}
          {s.sections.filter((sec) => sec.content.trim()).map((sec) => (
            <section className={`sheet-section kind-${sec.kind}`} key={sec.id}>
              <h3 className="sheet-label">{sectionTitle(sec, s.sections)}</h3>
              <SheetText text={transposeText(sec.content, view.semis, view.flats)} />
            </section>
          ))}
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title={t.sheet.deleteSection}
          message={<RichText parts={t.sheet.deleteSectionBody(sectionTitle(deleting, s.sections))} />}
          confirmLabel={t.common.delete}
          onConfirm={() => s.remove(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}

      {exportError && (
        <div className="toast" role="alert">
          <span>{exportError}</span>
          <button onClick={() => setExportError(null)} aria-label={t.common.close}>
            ×
          </button>
        </div>
      )}

      {s.error && (
        <div className="toast" role="alert">
          <span>{t.common.problem(s.error)}</span>
          <button onClick={s.clearError} aria-label={t.common.close}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export function SheetText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="sheet-text">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="sheet-gap" />;
        const tokens = tokenizeLine(line);
        const hasChords = tokens.some((t) => t.chord);
        const hasText = tokens.some((t) => t.text.trim());
        return (
          <div key={i} className={`sheet-line${hasChords ? "" : " no-chords"}${hasText ? "" : " chords-only"}`}>
            {tokens.map((t, j) => (
              <span key={j} className="tok">
                <span className="c">{t.chord ?? ""}</span>
                <span className="t">{t.text}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
