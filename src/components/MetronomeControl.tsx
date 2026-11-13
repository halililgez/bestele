import { useEffect, useRef, useState } from "react";
import { Metronome, beatsPerBar, bpmFromTaps } from "../metronome";

interface Props {
  tempo: number | null;
  timeSignature: string;
  /** Vuruşla bulunan ya da +/- ile değiştirilen tempoyu şarkıya kaydeder */
  onTempo: (bpm: number) => void;
}

const DEFAULT_BPM = 90;

/** Metronom: çal/durdur, vuruş göstergesi, +/− ve "vur" ile tempo bulma. */
export function MetronomeControl({ tempo, timeSignature, onTempo }: Props) {
  const metro = useRef<Metronome | null>(null);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1);
  const taps = useRef<number[]>([]);
  const bpm = tempo ?? DEFAULT_BPM;
  const beats = beatsPerBar(timeSignature);

  useEffect(() => {
    const m = new Metronome();
    m.onBeat = setBeat;
    metro.current = m;
    return () => m.dispose();
  }, []);

  useEffect(() => {
    if (!metro.current) return;
    metro.current.bpm = bpm;
    metro.current.beatsPerBar = beats;
  }, [bpm, beats]);

  function toggle() {
    const m = metro.current;
    if (!m) return;
    if (m.running) {
      m.stop();
      setPlaying(false);
      setBeat(-1);
    } else {
      m.bpm = bpm;
      m.beatsPerBar = beats;
      m.start();
      setPlaying(true);
    }
  }

  function tap() {
    const now = performance.now();
    taps.current = [...taps.current, now].slice(-8);
    const found = bpmFromTaps(taps.current);
    if (found) onTempo(found);
  }

  return (
    <div className="metronome" aria-label="Metronom">
      <button className={`metro-play ${playing ? "on" : ""}`} onClick={toggle} title={playing ? "Metronomu durdur" : "Metronomu başlat"}>
        {playing ? "■" : "♩"}
      </button>
      <button className="icon-btn" aria-label="Tempoyu düşür" onClick={() => onTempo(Math.max(20, bpm - 1))}>
        −
      </button>
      <span className="metro-bpm" title={tempo ? "Şarkının temposu" : "Şarkıya tempo girilmemiş, varsayılan kullanılıyor"}>
        {bpm}
        <small> BPM</small>
      </span>
      <button className="icon-btn" aria-label="Tempoyu artır" onClick={() => onTempo(Math.min(300, bpm + 1))}>
        +
      </button>
      <span className="metro-dots" aria-hidden>
        {Array.from({ length: beats }, (_, i) => (
          <span key={i} className={`metro-dot ${i === 0 ? "first" : ""} ${playing && beat === i ? "lit" : ""}`} />
        ))}
      </span>
      <button className="btn tap-btn" onClick={tap} title="Şarkının temposunda birkaç kez tıkla">
        Vur
      </button>
    </div>
  );
}
