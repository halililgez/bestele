import { useState } from "react";
import { Popover } from "./Select";
import { useT } from "../i18n";

const SHARP_ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** Sık kullanılan akor nitelikleri ("" = majör) */
const QUALITIES = ["", "m", "7", "maj7", "m7", "sus2", "sus4", "add9", "6", "m6", "9", "dim", "dim7", "m7b5", "aug", "5"];

interface Props {
  flats: boolean;
  /** Seçici açıldığında hazır gelecek kök (ör. tonun kökü) */
  defaultRoot: string;
  onInsert: (chord: string) => void;
}

/** "Başka akor" seçicisi: kök + nitelik + (isteğe bağlı) bas notası. */
export function ChordPicker({ flats, defaultRoot, onInsert }: Props) {
  const t = useT();
  const roots = flats ? FLAT_ROOTS : SHARP_ROOTS;
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [root, setRoot] = useState(defaultRoot);
  const [quality, setQuality] = useState("");
  const [bass, setBass] = useState("");

  const chord = `${root}${quality}${bass && bass !== root ? `/${bass}` : ""}`;

  function toggle() {
    if (!open) {
      setRoot(roots.includes(root) ? root : defaultRoot);
      setBass("");
    }
    setOpen((o) => !o);
  }

  function insert() {
    onInsert(chord);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={setBtn}
        type="button"
        className={`chord-picker-btn ${open ? "open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <span aria-hidden="true">＋</span> {t.sheet.otherChord}
      </button>
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)} align="end" role="dialog" ariaLabel={t.sheet.otherChordLabel} className="chord-picker">
        <div onMouseDown={(e) => e.target instanceof HTMLButtonElement && e.preventDefault()}>
          <div className="cp-preview">
            <span className="cp-chord">{chord}</span>
            <button type="button" className="btn btn-primary" onClick={insert}>
              {t.sheet.insertChord(chord)}
            </button>
          </div>

          <div className="cp-label">{t.sheet.chordRoot}</div>
          <div className="cp-grid cp-roots">
            {roots.map((r) => (
              <button key={r} type="button" className={`cp-cell ${r === root ? "on" : ""}`} aria-pressed={r === root} onClick={() => setRoot(r)}>
                {r}
              </button>
            ))}
          </div>

          <div className="cp-label">{t.sheet.chordQuality}</div>
          <div className="cp-grid cp-qualities">
            {QUALITIES.map((q) => (
              <button
                key={q || "maj"}
                type="button"
                className={`cp-cell ${q === quality ? "on" : ""}`}
                aria-pressed={q === quality}
                onClick={() => setQuality(q)}
                onDoubleClick={() => {
                  setQuality(q);
                  onInsert(`${root}${q}${bass && bass !== root ? `/${bass}` : ""}`);
                  setOpen(false);
                }}
              >
                {q || t.sheet.chordMajor}
              </button>
            ))}
          </div>

          <div className="cp-label">{t.sheet.chordBass}</div>
          <div className="cp-grid cp-roots">
            <button type="button" className={`cp-cell cp-none ${bass === "" ? "on" : ""}`} aria-pressed={bass === ""} onClick={() => setBass("")}>
              {t.sheet.chordNoBass}
            </button>
            {roots
              .filter((r) => r !== root)
              .map((r) => (
                <button key={r} type="button" className={`cp-cell ${r === bass ? "on" : ""}`} aria-pressed={r === bass} onClick={() => setBass(r)}>
                  /{r}
                </button>
              ))}
          </div>
        </div>
      </Popover>
    </>
  );
}
