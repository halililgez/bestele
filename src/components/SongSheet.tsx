import { useEffect, useMemo, useRef, useState } from "react";
import { downloadFile, safeFileName, songToChordPro, songToText } from "../exporting";
import type { Library } from "../useLibrary";
import { useSections } from "../useSections";
import { SECTION_LABELS, SECTION_ORDER, type Section, type SectionKind, type Song } from "../types";
import { chordsIn, diatonicChords, prefersFlats, tokenizeLine, transposeKey, transposeText } from "../chords";
import { ConfirmDialog } from "./Dialog";
import { sectionTitle } from "../sectionTitle";
import { MetronomeControl } from "./MetronomeControl";
import { StageMode } from "./StageMode";
import { ChordStrip } from "./ChordDiagram";

type Mode = "yaz" | "oku";

const QUICK_KINDS: SectionKind[] = ["kita", "nakarat", "onnakarat", "kopru", "giris", "solo", "final"];
const TEMPLATE: SectionKind[] = ["kita", "nakarat", "kita", "nakarat", "kopru", "nakarat"];


interface Props {
  song: Song;
  library: Library;
}

export function SongSheet({ song, library }: Props) {
  const s = useSections(song.id, () => library.markTouched(song.id));
  const [mode, setMode] = useState<Mode>("yaz");
  const [transpose, setTranspose] = useState(0);
  const [scale, setScale] = useState(1);
  const [deleting, setDeleting] = useState<Section | null>(null);
  const active = useRef<{ id: string; el: HTMLTextAreaElement } | null>(null);
  const [customChord, setCustomChord] = useState("");
  const [copied, setCopied] = useState(false);
  const [stage, setStage] = useState(false);
  const [showShapes, setShowShapes] = useState(() => {
    try {
      return localStorage.getItem("bestele:show-shapes") === "1";
    } catch {
      return false;
    }
  });

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

  const used = useMemo(() => chordsIn(s.sections.map((x) => x.content).join("\n")), [s.sections]);
  const diatonic = useMemo(() => diatonicChords(key || "C"), [key]);
  const extraUsed = used.filter((c) => !diatonic.includes(c));

  function insertChord(chord: string) {
    const a = active.current;
    const clean = chord.trim();
    if (!a || !clean) return;
    const el = a.el;
    const start = el.selectionStart;
    const end = el.selectionEnd;
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

  function exportAs(kind: "txt" | "cho") {
    const name = safeFileName(song.title);
    if (kind === "txt") downloadFile(`${name}.txt`, songToText(song, s.sections, sectionTitle), "text/plain;charset=utf-8");
    else downloadFile(`${name}.cho`, songToChordPro(song, s.sections, sectionTitle), "text/plain;charset=utf-8");
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
        <div className="segmented" role="radiogroup" aria-label="Görünüm">
          <button role="radio" aria-checked={mode === "yaz"} className={mode === "yaz" ? "on" : ""} onClick={() => setMode("yaz")}>
            Yaz
          </button>
          <button role="radio" aria-checked={mode === "oku"} className={mode === "oku" ? "on" : ""} onClick={() => setMode("oku")}>
            Oku
          </button>
        </div>

        {mode === "oku" && (
          <>
            <div className="stepper" aria-label="Transpoze">
              <button className="icon-btn" aria-label="Yarım ses aşağı" onClick={() => setTranspose((t) => t - 1)}>
                −
              </button>
              <span className="stepper-label">
                {transpose === 0 ? "Transpoze" : `${transpose > 0 ? "+" : ""}${transpose}`}
                {key && transpose !== 0 && (
                  <>
                    {" · "}
                    {key} → <strong>{targetKey}</strong>
                  </>
                )}
              </span>
              <button className="icon-btn" aria-label="Yarım ses yukarı" onClick={() => setTranspose((t) => t + 1)}>
                +
              </button>
            </div>
            {transpose !== 0 && (
              <>
                <button className="btn" onClick={() => setTranspose(0)}>
                  Sıfırla
                </button>
                <button className="btn btn-primary" onClick={applyTranspose}>
                  Bu tonda kaydet
                </button>
              </>
            )}
            <div className="stepper" aria-label="Yazı boyutu">
              <button className="icon-btn" aria-label="Yazıyı küçült" onClick={() => setScale((v) => Math.max(0.7, v - 0.1))}>
                A−
              </button>
              <button className="icon-btn" aria-label="Yazıyı büyüt" onClick={() => setScale((v) => Math.min(2, v + 0.1))}>
                A+
              </button>
            </div>
            <button className={`chip ${showShapes ? "on" : ""}`} onClick={toggleShapes} aria-pressed={showShapes}>
              Akor şemaları
            </button>
            <span className="toolbar-spacer" />
            <div className="export-group">
              <button className="btn btn-primary" onClick={() => setStage(true)} title="Tam ekran, büyük yazı, otomatik kaydırma">
                Sahne modu
              </button>
              <button className="btn" onClick={() => window.print()} title="Ctrl + P">
                Yazdır
              </button>
              <button className="btn" onClick={copyText} title="Akorları sözlerin üstünde, düz metin olarak kopyalar">
                {copied ? "Kopyalandı ✓" : "Metni kopyala"}
              </button>
              <button className="btn" onClick={() => exportAs("txt")} title="Düz metin dosyası (.txt)">
                .txt
              </button>
              <button className="btn" onClick={() => exportAs("cho")} title="ChordPro dosyası: akor uygulamalarının çoğu açabilir">
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
          transpose={transpose}
          flats={flats}
          keyLabel={targetKey}
          onClose={() => setStage(false)}
        />
      )}

      {mode === "yaz" && s.sections.length > 0 && (
        <div className="palette" onMouseDown={(e) => e.target instanceof HTMLButtonElement && e.preventDefault()}>
          <span className="palette-title">{key ? `${key} tonunda` : "Ton seçilmedi (C)"}</span>
          {diatonic.map((c) => (
            <button key={c} className="chord-chip" onClick={() => insertChord(c)} title={`[${c}] ekle`}>
              {c}
            </button>
          ))}
          {extraUsed.length > 0 && <span className="palette-sep" />}
          {extraUsed.map((c) => (
            <button key={c} className="chord-chip used" onClick={() => insertChord(c)} title={`[${c}] ekle`}>
              {c}
            </button>
          ))}
          <form
            className="palette-custom"
            onSubmit={(e) => {
              e.preventDefault();
              insertChord(customChord);
              setCustomChord("");
            }}
          >
            <input value={customChord} onChange={(e) => setCustomChord(e.target.value)} placeholder="Başka akor…" aria-label="Akor yaz ve ekle" />
          </form>
        </div>
      )}

      {s.sections.length === 0 ? (
        <div className="empty sheet-empty">
          <h2>Sayfa boş</h2>
          <p>Bir bölüm ekleyerek başla ya da hazır bir şarkı yapısıyla başla.</p>
          <div className="add-row center">
            {QUICK_KINDS.slice(0, 4).map((k) => (
              <button key={k} className="btn" onClick={() => s.add(k)}>
                + {SECTION_LABELS[k]}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={addTemplate}>
            Hazır yapı: Kıta · Nakarat · Kıta · Nakarat · Köprü · Nakarat
          </button>
        </div>
      ) : mode === "yaz" ? (
        <>
          <p className="hint">
            Akorları köşeli parantezle sözün içine yaz: <code>[Am]Gece ya[F]rısı</code>. Yukarıdaki akorlara tıklayınca imlecin olduğu yere eklenir.
          </p>
          {s.sections.map((sec, i) => (
            <div className="section-card" key={sec.id}>
              <div className="section-head">
                <select
                  className="kind-select"
                  value={sec.kind}
                  onChange={(e) => s.update(sec.id, { kind: e.target.value as SectionKind })}
                  aria-label="Bölüm türü"
                >
                  {SECTION_ORDER.map((k) => (
                    <option key={k} value={k}>
                      {SECTION_LABELS[k]}
                    </option>
                  ))}
                </select>
                <input
                  className="label-input"
                  value={sec.label}
                  placeholder={sectionTitle({ ...sec, label: "" }, s.sections)}
                  onChange={(e) => s.update(sec.id, { label: e.target.value })}
                  aria-label="Bölüm adı"
                />
                <span className="section-actions">
                  <button className="icon-btn" title="Yukarı taşı" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => s.move(sec.id, -1)}>
                    ↑
                  </button>
                  <button
                    className="icon-btn"
                    title="Aşağı taşı"
                    aria-label="Aşağı taşı"
                    disabled={i === s.sections.length - 1}
                    onClick={() => s.move(sec.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="icon-btn"
                    title="Çoğalt"
                    aria-label="Çoğalt"
                    onClick={() => s.add(sec.kind, i + 1, { label: sec.label, content: sec.content })}
                  >
                    ⧉
                  </button>
                  <button
                    className="icon-btn"
                    title="Bölümü sil"
                    aria-label="Bölümü sil"
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
                placeholder={"[Am]Sözler buraya…\n[F]akorlar köşeli parantezde"}
                spellCheck={false}
                onFocus={(e) => (active.current = { id: sec.id, el: e.currentTarget })}
                onChange={(e) => s.update(sec.id, { content: e.target.value })}
              />
            </div>
          ))}
          <div className="add-row">
            <span className="add-label">Bölüm ekle:</span>
            {QUICK_KINDS.map((k) => (
              <button key={k} className="chip" onClick={() => s.add(k)}>
                + {SECTION_LABELS[k]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="sheet" style={{ fontSize: `${scale}em` }}>
          <header className="print-head">
            <h1>{song.title || "Adsız şarkı"}</h1>
            <p>
              {[
                song.writer,
                targetKey && `Ton: ${targetKey}`,
                song.tempo && `${song.tempo} BPM`,
                song.timeSignature,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
          </header>
          {showShapes && <ChordStrip chords={chordsIn(transposeText(s.sections.map((x) => x.content).join("\n"), transpose, flats))} />}
          {s.sections.every((sec) => !sec.content.trim()) && (
            <p className="hint">Bölümler henüz boş. "Yaz" görünümünde söz ve akor ekleyebilirsin.</p>
          )}
          {s.sections.filter((sec) => sec.content.trim()).map((sec) => (
            <section className={`sheet-section kind-${sec.kind}`} key={sec.id}>
              <h3 className="sheet-label">{sectionTitle(sec, s.sections)}</h3>
              <SheetText text={transposeText(sec.content, transpose, flats)} />
            </section>
          ))}
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Bölümü sil"
          message={
            <>
              <strong>{sectionTitle(deleting, s.sections)}</strong> bölümü ve içindeki sözler silinecek.
            </>
          }
          confirmLabel="Sil"
          onConfirm={() => s.remove(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}

      {s.error && (
        <div className="toast" role="alert">
          <span>Bir sorun oldu: {s.error}</span>
          <button onClick={s.clearError} aria-label="Kapat">
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
