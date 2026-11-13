import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Recording } from "../types";
import { computePeaks, encodeWav, formatTime } from "../audioTools";

interface Props {
  rec: Recording;
  urlFor: (rec: Recording) => Promise<string>;
  /** Kırpılan parça yeni bir WAV kaydı olarak eklenir; orijinal kayıt değişmez. */
  onTrim: (wav: Blob, durationMs: number) => Promise<void>;
}

const BUCKETS = 800;

type Range = { start: number; end: number };

/** Kaydın dalga formu: tıklayınca oradan çalar, sürükleyince aralık seçer, seçilen aralık yeni kayıt olarak kırpılır. */
export function WaveformEditor({ rec, urlFor, onTrim }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const buffer = useRef<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [head, setHead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ x0: number; t0: number; moved: boolean } | null>(null);
  const stopAt = useRef<number | null>(null);

  // Sesi çöz ve dalga formunu hesapla
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = await urlFor(rec);
        const bytes = await (await fetch(url)).arrayBuffer();
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(bytes);
        void ctx.close();
        if (cancelled) return;
        buffer.current = decoded;
        setDuration(decoded.duration);
        setPeaks(computePeaks(decoded, BUCKETS));
        const a = new Audio(url);
        a.onended = () => setPlaying(false);
        a.onpause = () => setPlaying(false);
        a.onplay = () => setPlaying(true);
        audio.current = a;
      } catch (e) {
        if (!cancelled) setError(`Ses çözülemedi: ${String(e)}`);
      }
    })();
    return () => {
      cancelled = true;
      audio.current?.pause();
    };
  }, [rec, urlFor]);

  // Çalarken oynatma çizgisini ilerlet, seçimin sonunda dur
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const a = audio.current;
      if (!a) return;
      if (stopAt.current !== null && a.currentTime >= stopAt.current) {
        a.pause();
        stopAt.current = null;
      }
      setHead(a.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Çizim
  useEffect(() => {
    const c = canvas.current;
    if (!c || !peaks) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);
    const css = getComputedStyle(c);
    const ink = css.getPropertyValue("--wave").trim() || "#888";
    const sel = css.getPropertyValue("--wave-sel").trim() || "#c44";
    const bg = css.getPropertyValue("--wave-bg").trim() || "rgba(200,80,60,0.12)";
    g.clearRect(0, 0, w, h);
    const x = (t: number) => (duration ? (t / duration) * w : 0);
    if (range) {
      g.fillStyle = bg;
      g.fillRect(x(range.start), 0, x(range.end) - x(range.start), h);
    }
    const bar = w / peaks.length;
    peaks.forEach((p, i) => {
      const t = ((i + 0.5) / peaks.length) * duration;
      g.fillStyle = range && t >= range.start && t <= range.end ? sel : ink;
      const bh = Math.max(1, p * (h - 4));
      g.fillRect(i * bar, (h - bh) / 2, Math.max(1, bar - 0.5), bh);
    });
    g.fillStyle = sel;
    g.fillRect(x(head) - 1, 0, 2, h);
  }, [peaks, range, head, duration]);

  function timeAt(clientX: number) {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
  }

  function onPointerDown(e: RPointerEvent) {
    if (!duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x0: e.clientX, t0: timeAt(e.clientX), moved: false };
  }

  function onPointerMove(e: RPointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x0) > 3) d.moved = true;
    if (d.moved) {
      const t = timeAt(e.clientX);
      setRange({ start: Math.min(d.t0, t), end: Math.max(d.t0, t) });
    }
  }

  function onPointerUp(e: RPointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    // Tıklama: oradan çal
    const t = timeAt(e.clientX);
    const a = audio.current;
    if (!a) return;
    stopAt.current = null;
    a.currentTime = t;
    setHead(t);
    void a.play();
  }

  function playRange() {
    const a = audio.current;
    if (!a) return;
    if (playing) {
      a.pause();
      return;
    }
    const from = range ? range.start : head >= duration - 0.05 ? 0 : head;
    stopAt.current = range ? range.end : null;
    a.currentTime = from;
    void a.play();
  }

  async function trim() {
    const b = buffer.current;
    if (!b || !range) return;
    setSaving(true);
    try {
      const wav = encodeWav(b, range.start, range.end);
      await onTrim(new Blob([wav as BlobPart], { type: "audio/wav" }), Math.round((range.end - range.start) * 1000));
      setRange(null);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <div className="rec-error">{error}</div>;

  const len = range ? range.end - range.start : 0;

  return (
    <div className="wave">
      {!peaks ? (
        <div className="wave-loading">Dalga formu hazırlanıyor…</div>
      ) : (
        <canvas
          ref={canvas}
          className="wave-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label="Dalga formu: tıkla ve çal, sürükle ve seç"
        />
      )}
      <div className="wave-controls">
        <button className="btn" onClick={playRange} disabled={!peaks}>
          {playing ? "❚❚ Durdur" : range ? "▶ Seçimi dinle" : "▶ Çal"}
        </button>
        <span className="wave-time">
          {formatTime(head)} / {formatTime(duration)}
        </span>
        {range ? (
          <>
            <span className="wave-sel">
              Seçim: {formatTime(range.start)} – {formatTime(range.end)} ({len.toFixed(1)} sn)
            </span>
            <button className="link-btn" onClick={() => setRange(null)}>
              Seçimi kaldır
            </button>
            <span className="toolbar-spacer" />
            <button className="btn btn-primary" onClick={trim} disabled={saving || len < 0.2}>
              {saving ? "Kaydediliyor…" : "Seçimi yeni kayıt olarak kaydet"}
            </button>
          </>
        ) : (
          <span className="muted wave-hint">Bir parçayı kırpmak için dalga formunun üstünde sürükle.</span>
        )}
      </div>
    </div>
  );
}
