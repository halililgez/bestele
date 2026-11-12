# Bestele: İlerleme Notları

Bu dosya geliştirmenin nerede kaldığını tutar. Her oturum işe buradan başlar, iş bitince burayı günceller.

## Çalışma kuralları

- Her faz ayrı bir branch (`faz-N-...`) ve ayrı bir PR olur. PR'lar squash ile merge edilir ve branch silinir.
- Merge'den önce `npm run build` (tip kontrolü) ve `cargo build` (src-tauri) hatasız geçmelidir.
- Tarayıcı önizlemesi: `npm run dev`. Veriler localStorage'da tutulur (`src/data/localRepo.ts`).
- Masaüstü: `npm run tauri dev`. Veriler SQLite'ta tutulur (`src/data/sqlRepo.ts`). Şema değişiklikleri `MIGRATIONS` dizisinin sonuna eklenir.

## Fazlar

| Faz | İçerik | Durum |
| --- | --- | --- |
| 0 | İskelet: şarkı listesi, klasör, etiket, temalar | ✅ main'de |
| 1 | Beste sayfası: bölümler, söz + akor, transpoze | ✅ PR merge edildi |
| 2 | Kayıtlar: mikrofon, dosya yükleme, oynatıcı | ⏳ |
| 3 | Gelişim: versiyonlar, zaman çizelgesi, karşılaştırma | ⏳ |
| 4 | Cila: dışa aktarma ve yazdırma, yedek, ikon, kısayollar | ⏳ |

## Günlük

- **2026-11-13 ~02:45:** Faz 0 main'e gönderildi. Faz 1 başlıyor (branch `faz-1-beste-sayfasi`). Token limiti 05:20'de yenileniyor; 06:02'de oturumda otomatik devam job'ı kurulu.
- **2026-11-13 ~03:10:** Faz 1 bitti: `sections` tablosu (migration 2), `src/chords.ts` (+ vitest testleri, `npm test`), `useSections`, `SongSheet` (Yaz/Oku, akor paleti, transpoze + "Bu tonda kaydet", hazır yapı). Tarayıcıda denendi; masaüstünde SQLite tarafı elle denenmedi. Sıradaki: Faz 2 (kayıtlar).
