import { useEffect, useRef, useState } from "react";
import type { Section, Song } from "../types";
import { sectionTitle } from "../sectionTitle";
import { transposeText } from "../chords";
import { SheetText } from "./SongSheet";

interface Props {
  song: Song;
  sections: Section[];
  transpose: number;
  flats: boolean;
  keyLabel: string;
  onClose: () => void;
}

const MAX_SPEED = 10;

/**
 * Sahne modu: tam ekran, koyu zemin, büyük yazı ve otomatik kaydırma.
 * Boşluk: kaydırmayı başlat/durdur · ↑/↓: hız · +/−: yazı boyutu · Esc: çık
 */
export function StageMode({ song, sections, transpose, flats, keyLabel, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState(3);
  const [scrolling, setScrolling] = useState(false);
  const [size, setSize] = useState(1.6);
  const pos = useRef(0);

  // Pencereyi tam ekrana al (destekleniyorsa)
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === " ") {
        e.preventDefault();
        setScrolling((v) => !v);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSpeed((v) => Math.min(MAX_SPEED, v + 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSpeed((v) => Math.max(1, v - 1));
      } else if (e.key === "+" || e.key === "=") {
        setSize((v) => Math.min(3.5, v + 0.1));
      } else if (e.key === "-") {
        setSize((v) => Math.max(0.8, v - 0.1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Otomatik kaydırma: hız 1 ≈ saniyede 12 piksel
  useEffect(() => {
    if (!scrolling) return;
    let raf = 0;
    let last = performance.now();
    pos.current = box.current?.scrollTop ?? 0;
    const step = (now: number) => {
      const el = box.current;
      if (!el) return;
      pos.current += ((now - last) / 1000) * speed * 12;
      last = now;
      el.scrollTop = pos.current;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        setScrolling(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [scrolling, speed]);

  const visible = sections.filter((s) => s.content.trim());

  return (
    <div className="stage" role="dialog" aria-modal="true" aria-label="Sahne modu">
      <div className="stage-bar">
        <strong>{song.title || "Adsız şarkı"}</strong>
        {keyLabel && <span>{keyLabel}</span>}
        {song.tempo && <span>{song.tempo} BPM</span>}
        <span className="stage-spacer" />
        <button className="stage-btn" onClick={() => setScrolling((v) => !v)}>
          {scrolling ? "❚❚ Durdur" : "▶ Kaydır"}
        </button>
        <span className="stage-speed">
          <button className="stage-btn" aria-label="Yavaşlat" onClick={() => setSpeed((v) => Math.max(1, v - 1))}>
            −
          </button>
          Hız {speed}
          <button className="stage-btn" aria-label="Hızlandır" onClick={() => setSpeed((v) => Math.min(MAX_SPEED, v + 1))}>
            +
          </button>
        </span>
        <span className="stage-speed">
          <button className="stage-btn" aria-label="Yazıyı küçült" onClick={() => setSize((v) => Math.max(0.8, v - 0.1))}>
            A−
          </button>
          <button className="stage-btn" aria-label="Yazıyı büyüt" onClick={() => setSize((v) => Math.min(3.5, v + 0.1))}>
            A+
          </button>
        </span>
        <button className="stage-btn" onClick={onClose}>
          Çık (Esc)
        </button>
      </div>
      <div className="stage-scroll" ref={box} onWheel={() => (pos.current = box.current?.scrollTop ?? 0)}>
        <div className="sheet stage-sheet" style={{ fontSize: `${size}em` }}>
          {visible.length === 0 && <p>Bu şarkıda henüz söz ya da akor yok.</p>}
          {visible.map((s) => (
            <section className={`sheet-section kind-${s.kind}`} key={s.id}>
              <h3 className="sheet-label">{sectionTitle(s, sections)}</h3>
              <SheetText text={transposeText(s.content, transpose, flats)} />
            </section>
          ))}
          <div className="stage-end">— son —</div>
        </div>
      </div>
      <div className="stage-help">Boşluk: kaydır / durdur · ↑ ↓ hız · + − yazı · Esc çık</div>
    </div>
  );
}
