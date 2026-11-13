import { useEffect, useRef, useState } from "react";
import { formatDuration } from "../useRecordings";
import { t as msg, useT } from "../i18n";

type Phase = "idle" | "starting" | "recording" | "paused";

interface Props {
  onRecorded: (blob: Blob, durationMs: number) => void;
}

function pickMime(): string | undefined {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
}

/** Mikrofondan kayıt: başlat / duraklat / bitir, süre ve ses seviyesi göstergesiyle. */
export function Recorder({ onRecorded }: Props) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef(0);
  // Süre ölçümü: duraklatmalar düşülerek
  const startedAt = useRef(0);
  const accumulated = useRef(0);

  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  function cleanup() {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    setLevel(0);
  }

  useEffect(() => () => {
    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    cleanup();
  }, []);

  function currentMs() {
    return accumulated.current + (recorder.current?.state === "recording" ? performance.now() - startedAt.current : 0);
  }

  async function start() {
    setError(null);
    setPhase("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        // Müzik kaydı için tarayıcının konuşma filtrelerini kapat
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      stream.current = s;

      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(s).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v));
        setLevel(peak);
        setElapsed(currentMs());
        raf.current = requestAnimationFrame(tick);
      };

      const mime = pickMime();
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const duration = currentMs();
        cleanup();
        setPhase("idle");
        setElapsed(0);
        onRecordedRef.current(new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" }), Math.round(duration));
      };
      recorder.current = rec;
      accumulated.current = 0;
      startedAt.current = performance.now();
      rec.start(1000);
      setPhase("recording");
      tick();
    } catch (e) {
      cleanup();
      setPhase("idle");
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? msg().recorder.noPermission
          : name === "NotFoundError"
            ? msg().recorder.noMic
            : msg().recorder.startFailed(String(e)),
      );
    }
  }

  function pause() {
    const r = recorder.current;
    if (!r) return;
    if (r.state === "recording") {
      accumulated.current += performance.now() - startedAt.current;
      r.pause();
      setPhase("paused");
    } else if (r.state === "paused") {
      startedAt.current = performance.now();
      r.resume();
      setPhase("recording");
    }
  }

  function stop() {
    const r = recorder.current;
    if (!r || r.state === "inactive") return;
    if (r.state === "recording") accumulated.current += performance.now() - startedAt.current;
    // stop() durumu hemen "inactive" yapar; onstop'taki ölçüm yalnızca biriken süreyi kullanır
    r.stop();
  }

  const active = phase === "recording" || phase === "paused";

  return (
    <div className={`recorder ${phase}`}>
      {!active ? (
        <button className="rec-btn" onClick={start} disabled={phase === "starting"} aria-label={t.recorder.start}>
          <span className="rec-dot" />
        </button>
      ) : (
        <button className="rec-btn stop" onClick={stop} aria-label={t.recorder.finish}>
          <span className="rec-square" />
        </button>
      )}
      <div className="rec-body">
        <div className="rec-status">
          {phase === "idle" && t.recorder.idle}
          {phase === "starting" && t.recorder.starting}
          {phase === "recording" && t.recorder.recording}
          {phase === "paused" && t.recorder.paused}
        </div>
        <div className="rec-time">{formatDuration(active ? elapsed : 0)}</div>
        <div className="meter" aria-hidden>
          <div className="meter-fill" style={{ width: `${Math.min(100, level * 140)}%` }} data-hot={level > 0.9 || undefined} />
        </div>
        {error && <div className="rec-error">{error}</div>}
      </div>
      {active && (
        <button className="btn" onClick={pause}>
          {phase === "paused" ? t.recorder.resume : t.recorder.pause}
        </button>
      )}
    </div>
  );
}
