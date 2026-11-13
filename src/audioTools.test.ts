import { describe, expect, it } from "vitest";
import { computePeaks, encodeWav, formatTime, type PcmSource } from "./audioTools";

function fake(channels: number[][], sampleRate = 10): PcmSource {
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length: channels[0].length,
    getChannelData: (c) => Float32Array.from(channels[c]),
  };
}

describe("computePeaks", () => {
  it("her parçanın en yüksek genliğini bulur", () => {
    const src = fake([[0, 0.5, -0.25, 0, 0, -1, 0.1, 0]]);
    expect(computePeaks(src, 4).map((x) => Math.round(x * 100) / 100)).toEqual([0.5, 0.25, 1, 0.1]);
  });
  it("kanalları birleştirir", () => {
    const src = fake([
      [0.1, 0.1],
      [0.9, 0],
    ]);
    expect(computePeaks(src, 2).map((x) => Math.round(x * 10) / 10)).toEqual([0.9, 0.1]);
  });
  it("boş ses", () => {
    expect(computePeaks(fake([[]]), 3)).toEqual([0, 0, 0]);
  });
});

describe("encodeWav", () => {
  it("seçilen aralığı geçerli bir WAV olarak yazar", () => {
    const src = fake([[0, 0.5, 1, -1, 0, 0, 0, 0, 0, 0]], 10);
    const wav = encodeWav(src, 0.1, 0.4); // 1..3. örnekler
    const v = new DataView(wav.buffer);
    const text = (o: number) => String.fromCharCode(...wav.slice(o, o + 4));
    expect(text(0)).toBe("RIFF");
    expect(text(8)).toBe("WAVE");
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(10); // örnekleme hızı
    expect(v.getUint32(40, true)).toBe(6); // 3 örnek × 2 bayt
    expect(v.getInt16(44, true)).toBe(Math.floor(0.5 * 0x7fff));
    expect(v.getInt16(46, true)).toBe(0x7fff);
    expect(v.getInt16(48, true)).toBe(-0x8000);
  });
  it("aralık dışını sınırlar", () => {
    const wav = encodeWav(fake([[0.1, 0.2]], 10), -5, 99);
    expect(new DataView(wav.buffer).getUint32(40, true)).toBe(4);
  });
});

describe("formatTime", () => {
  it("dakika:saniye.ondalık", () => {
    expect(formatTime(65.34)).toBe("1:05.3");
    expect(formatTime(3)).toBe("0:03.0");
  });
});
