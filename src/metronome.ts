/**
 * Web Audio ile metronom. Tıklar ses saatine göre önceden planlanır, böylece
 * arayüz takılsa bile vuruşlar kaymaz ("lookahead" zamanlayıcı).
 */
export class Metronome {
  bpm = 100;
  beatsPerBar = 4;
  /** Her vuruş duyulduğu anda çağrılır (0 = ölçünün ilk vuruşu) */
  onBeat: ((beat: number) => void) | null = null;

  private ctx: AudioContext | null = null;
  private timer: number | undefined;
  private nextTime = 0;
  private beat = 0;
  private pending: number[] = [];

  get running() {
    return this.timer !== undefined;
  }

  start() {
    if (this.running) return;
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
    this.nextTime = this.ctx.currentTime + 0.06;
    this.beat = 0;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.pending.forEach((t) => window.clearTimeout(t));
    this.pending = [];
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const beatInBar = this.beat % Math.max(1, this.beatsPerBar);
      this.click(this.nextTime, beatInBar === 0);
      const delay = Math.max(0, (this.nextTime - ctx.currentTime) * 1000);
      const t = window.setTimeout(() => {
        this.pending = this.pending.filter((x) => x !== t);
        this.onBeat?.(beatInBar);
      }, delay);
      this.pending.push(t);
      this.nextTime += 60 / Math.max(20, Math.min(300, this.bpm));
      this.beat++;
    }
  }

  private click(time: number, accent: boolean) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    gain.gain.setValueAtTime(accent ? 0.5 : 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }
}

/** Ölçü işaretinden ölçüdeki vuruş sayısı (6/8, 9/8, 12/8 gibi bileşik ölçülerde noktalı dörtlük sayılır). */
export function beatsPerBar(timeSignature: string): number {
  const [num, den] = timeSignature.split("/").map((n) => parseInt(n, 10));
  if (!num) return 4;
  if (den === 8 && num % 3 === 0 && num > 3) return num / 3;
  return num;
}

/**
 * Vuruş zamanlarından (ms) tempo hesaplar. Son 2 saniyeden uzun ara verilmişse
 * öncekiler yok sayılır. En az iki vuruş gerekir.
 */
export function bpmFromTaps(taps: number[]): number | null {
  const recent: number[] = [];
  for (let i = taps.length - 1; i >= 0; i--) {
    if (recent.length && recent[0] - taps[i] > 2000) break;
    recent.unshift(taps[i]);
    if (recent.length === 6) break;
  }
  if (recent.length < 2) return null;
  const avg = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
  const bpm = Math.round(60000 / avg);
  return bpm >= 20 && bpm <= 300 ? bpm : null;
}
