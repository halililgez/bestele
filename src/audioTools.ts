/** AudioBuffer'ın burada kullandığımız kısmı (testlerde sahte nesneyle de çalışsın diye) */
export interface PcmSource {
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  getChannelData(channel: number): Float32Array;
}

/**
 * Dalga formu için tepe değerleri: sesi `buckets` parçaya böler,
 * her parçadaki en yüksek mutlak genliği (0..1) döner. Kanallar birleştirilir.
 */
export function computePeaks(src: PcmSource, buckets: number): number[] {
  const n = Math.max(1, Math.floor(buckets));
  const peaks = new Array<number>(n).fill(0);
  if (src.length === 0) return peaks;
  const per = src.length / n;
  for (let c = 0; c < src.numberOfChannels; c++) {
    const data = src.getChannelData(c);
    for (let b = 0; b < n; b++) {
      const start = Math.floor(b * per);
      const end = Math.min(src.length, Math.max(start + 1, Math.floor((b + 1) * per)));
      // Uzun parçalarda her örneği gezmek gereksiz; en fazla ~200 örnek
      const stride = Math.max(1, Math.floor((end - start) / 200));
      let peak = peaks[b];
      for (let i = start; i < end; i += stride) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
      }
      peaks[b] = Math.min(1, peak);
    }
  }
  return peaks;
}

/** Seçilen aralığı 16 bit PCM WAV dosyasına çevirir (kırpma için). */
export function encodeWav(src: PcmSource, startSec: number, endSec: number): Uint8Array {
  const rate = src.sampleRate;
  const from = Math.max(0, Math.min(src.length, Math.round(startSec * rate)));
  const to = Math.max(from, Math.min(src.length, Math.round(endSec * rate)));
  const frames = to - from;
  const channels = Math.min(2, Math.max(1, src.numberOfChannels));
  const bytesPerFrame = channels * 2;
  const dataSize = frames * bytesPerFrame;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const ascii = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * bytesPerFrame, true);
  v.setUint16(32, bytesPerFrame, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, dataSize, true);

  const data = Array.from({ length: channels }, (_, c) => src.getChannelData(c));
  let o = 44;
  for (let i = from; i < to; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

/** Saniyeyi "1:05.3" biçiminde yazar. */
export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
