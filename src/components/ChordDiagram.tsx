import { guitarShape } from "../guitarChords";

const W = 74;
const H = 96;
const LEFT = 14;
const TOP = 22;
const GAP_X = 10;
const GAP_Y = 13;
const FRETS = 5;

/** Tek bir akorun gitar şeması (SVG). */
export function ChordDiagram({ chord }: { chord: string }) {
  const shape = guitarShape(chord);
  return (
    <figure className="chord-diagram" title={shape?.simplified ? "Basitleştirilmiş şema" : undefined}>
      <figcaption>
        {chord}
        {shape?.simplified && <span className="simplified">*</span>}
      </figcaption>
      {!shape ? (
        <div className="no-shape">şema yok</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${chord} akoru gitar şeması`}>
          {/* Başlangıç perdesi */}
          {shape.baseFret > 1 && (
            <text x={LEFT - 4} y={TOP + GAP_Y * 0.7} className="cd-fret" textAnchor="end">
              {shape.baseFret}
            </text>
          )}
          {/* Perde çizgileri */}
          {Array.from({ length: FRETS + 1 }, (_, i) => (
            <line
              key={`f${i}`}
              x1={LEFT}
              x2={LEFT + GAP_X * 5}
              y1={TOP + i * GAP_Y}
              y2={TOP + i * GAP_Y}
              className={i === 0 && shape.baseFret === 1 ? "cd-nut" : "cd-line"}
            />
          ))}
          {/* Teller */}
          {Array.from({ length: 6 }, (_, s) => (
            <line key={`s${s}`} x1={LEFT + s * GAP_X} x2={LEFT + s * GAP_X} y1={TOP} y2={TOP + FRETS * GAP_Y} className="cd-line" />
          ))}
          {/* Barre */}
          {shape.barre && (
            <rect
              x={LEFT + shape.barre.from * GAP_X - 4}
              y={TOP + (shape.barre.fret - shape.baseFret + 0.5) * GAP_Y - 4}
              width={(shape.barre.to - shape.barre.from) * GAP_X + 8}
              height={8}
              rx={4}
              className="cd-dot"
            />
          )}
          {/* Parmaklar ve açık/kapalı teller */}
          {shape.frets.map((f, s) => {
            const x = LEFT + s * GAP_X;
            if (f < 0)
              return (
                <text key={s} x={x} y={TOP - 6} className="cd-mark" textAnchor="middle">
                  ×
                </text>
              );
            if (f === 0) return <circle key={s} cx={x} cy={TOP - 9} r={3} className="cd-open" />;
            if (shape.barre && f === shape.barre.fret && s >= shape.barre.from && s <= shape.barre.to) return null;
            return <circle key={s} cx={x} cy={TOP + (f - shape.baseFret + 0.5) * GAP_Y} r={4} className="cd-dot" />;
          })}
        </svg>
      )}
    </figure>
  );
}

/** Şarkıda geçen akorların şema şeridi. */
export function ChordStrip({ chords }: { chords: string[] }) {
  if (!chords.length) return null;
  return (
    <div className="chord-strip" aria-label="Akor şemaları">
      {chords.map((c) => (
        <ChordDiagram key={c} chord={c} />
      ))}
    </div>
  );
}
