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
| 2 | Kayıtlar: mikrofon, dosya yükleme, oynatıcı | ✅ PR merge edildi |
| 3 | Gelişim: versiyonlar, zaman çizelgesi, karşılaştırma | ✅ PR merge edildi |
| 4 | Cila: dışa aktarma ve yazdırma, yedek, ikon, kısayollar | ⏳ |

## Günlük

- **2026-11-13 ~02:45:** Faz 0 main'e gönderildi. Faz 1 başlıyor (branch `faz-1-beste-sayfasi`). Token limiti 05:20'de yenileniyor; 06:02'de oturumda otomatik devam job'ı kurulu.
- **2026-11-13 ~03:10:** Faz 1 bitti: `sections` tablosu (migration 2), `src/chords.ts` (+ vitest testleri, `npm test`), `useSections`, `SongSheet` (Yaz/Oku, akor paleti, transpoze + "Bu tonda kaydet", hazır yapı). Tarayıcıda denendi; masaüstünde SQLite tarafı elle denenmedi. Sıradaki: Faz 2 (kayıtlar).
- **2026-11-13 ~03:30:** Faz 2 bitti: `recordings` tablosu (migration 3), Rust komutları `save_recording` / `read_recording` / `delete_recording` (ses dosyaları `<appData>/recordings/`), `src/data/audioStore.ts` (tarayıcıda IndexedDB), `useRecordings`, `Recorder` (MediaRecorder + seviye göstergesi + duraklat), `RecordingsPanel` (yükleme, oynatma, bölüme bağlama, not, filtre). Tarayıcıda dosya yükleme/oynatma denendi; mikrofon tarayıcı panelinde engelli olduğu için masaüstünde denenmeli. Sıradaki: Faz 3 (gelişim).
- **2026-11-13 ~03:50:** Faz 3 bitti: `versions` tablosu (migration 4, snapshot JSON), `src/diff.ts` (+ testler), `src/versioning.ts` (useVersions, snapshot yardımcıları), `DevelopmentPanel` (aşama yolculuğu, zaman çizelgesi: versiyon + kayıt + başlangıç, versiyon kaydet diyaloğu, görüntüle, öncekiyle/şimdikiyle karşılaştır, geri dön (önce otomatik yedek), versiyona kayıt bağlama, mini oynatıcı). `replaceSections` aynı sıradaki bölümleri yerinde günceller (kayıt bağlantıları korunur). Sıradaki: Faz 4 (cila).
