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
| 4 | Cila: dışa aktarma ve yazdırma, yedek, ikon, kısayollar | ✅ PR merge edildi |
| 5 | Prova araçları: metronom + tap tempo, sahne modu, sözlerde arama | ✅ PR merge edildi |
| 6 | Kayıt dalga formu ve kırpma | ✅ PR merge edildi |
| 7 | Gitar akor şemaları | ✅ PR merge edildi |
| 8 | SQLite deposu için gerçek SQLite testleri | ✅ PR merge edildi |
| 9 | Gitar capo desteği | ✅ PR merge edildi |

## Günlük

- **2026-11-13 ~02:45:** Faz 0 main'e gönderildi. Faz 1 başlıyor (branch `faz-1-beste-sayfasi`). Token limiti 05:20'de yenileniyor; 06:02'de oturumda otomatik devam job'ı kurulu.
- **2026-11-13 ~03:10:** Faz 1 bitti: `sections` tablosu (migration 2), `src/chords.ts` (+ vitest testleri, `npm test`), `useSections`, `SongSheet` (Yaz/Oku, akor paleti, transpoze + "Bu tonda kaydet", hazır yapı). Tarayıcıda denendi; masaüstünde SQLite tarafı elle denenmedi. Sıradaki: Faz 2 (kayıtlar).
- **2026-11-13 ~03:30:** Faz 2 bitti: `recordings` tablosu (migration 3), Rust komutları `save_recording` / `read_recording` / `delete_recording` (ses dosyaları `<appData>/recordings/`), `src/data/audioStore.ts` (tarayıcıda IndexedDB), `useRecordings`, `Recorder` (MediaRecorder + seviye göstergesi + duraklat), `RecordingsPanel` (yükleme, oynatma, bölüme bağlama, not, filtre). Tarayıcıda dosya yükleme/oynatma denendi; mikrofon tarayıcı panelinde engelli olduğu için masaüstünde denenmeli. Sıradaki: Faz 3 (gelişim).
- **2026-11-13 ~03:50:** Faz 3 bitti: `versions` tablosu (migration 4, snapshot JSON), `src/diff.ts` (+ testler), `src/versioning.ts` (useVersions, snapshot yardımcıları), `DevelopmentPanel` (aşama yolculuğu, zaman çizelgesi: versiyon + kayıt + başlangıç, versiyon kaydet diyaloğu, görüntüle, öncekiyle/şimdikiyle karşılaştır, geri dön (önce otomatik yedek), versiyona kayıt bağlama, mini oynatıcı). `replaceSections` aynı sıradaki bölümleri yerinde günceller (kayıt bağlantıları korunur). Sıradaki: Faz 4 (cila).
- **2026-11-13 ~04:10:** Faz 4 bitti: `src/exporting.ts` (düz metin akor-üstte, ChordPro, dosya indirme; + testler), Oku görünümünde Yazdır / Metni kopyala / .txt / ChordPro, yazdırma CSS'i, `src/backup.ts` + `BackupControls` (bütün defter + ses dosyaları tek JSON; geri yükleme mevcutları ezmez, `importRecords`), kısayollar (Ctrl+N/F/1-4/E/P, Esc), uygulama ikonu (`src-tauri/icons/source.svg` → `npx tauri icon`), README. Toplam 24 birim testi.

- **2026-11-13 ~04:30:** Masaüstü veritabanı salt okunur incelendi: `user_version = 4`, 5 tablo mevcut (migration'lar gerçek uygulamada çalışıyor). Faz 5 bitti: `src/metronome.ts` (lookahead zamanlayıcı, `bpmFromTaps`, `beatsPerBar`; + testler), `MetronomeControl` (Beste sayfasında; tempo şarkıya kaydedilir), `StageMode` (tam ekran, otomatik kaydırma, klavye), `lyricsIndex` + sözlerde arama, `searchFold` (Türkçe karakter duyarsız arama; + testler). Toplam 31 birim testi.
- **2026-11-13 ~04:45:** Faz 6 bitti: `src/audioTools.ts` (`computePeaks`, `encodeWav`, `formatTime`; + testler), `WaveformEditor` (Kayıtlar'da 〰 düğmesi: dalga formu, tıkla-çal, sürükle-seç, seçimi dinle, seçimi yeni WAV kaydı olarak kaydet; orijinal korunur, bölüm bağlantısı aktarılır). Toplam 37 birim testi. 06:02 job'ı güncellendi (Faz 6-7).
- **2026-11-13 ~05:00:** Faz 7 bitti: `src/guitarChords.ts` (açık akor tablosu + E/A şekli barre; tanınmayan nitelikler basitleştirilir; + testler), `ChordDiagram` / `ChordStrip` (SVG), Oku görünümünde "Akor şemaları" düğmesi (tercih hatırlanır, transpozeye uyar, baskıda görünür). Toplam 44 birim testi.
- **2026-11-13 ~05:15:** Faz 8 bitti: `src/data/sqlRepo.test.ts` — `@tauri-apps/plugin-sql` vitest ile taklit edilip `node:sqlite` (bellekte) üzerinde bütün SQLite deposu çalıştırılıyor: migration'lar, şarkı/klasör, bölümler (araya ekleme, sıralama, silme), kayıtlar, versiyonlar + geri dönme, şarkı silme, yedekten içe aktarma. Testler `tsconfig.test.json` ile ayrıca tip kontrolünden geçiyor (`npm run build` ikisini de çalıştırır; `@types/node` eklendi). Toplam 51 birim testi.
- **2026-11-13 ~06:15:** Faz 9 bitti: şarkıya `capo` alanı (migration 5: `ALTER TABLE songs ADD COLUMN capo`, localRepo ve yedekte eski kayıtlar için varsayılan 0, `normalizeCapo` 0-9). Bilgiler sekmesinde Capo seçimi. Oku görünümünde "Capo N ile çal" düğmesi (tercih hatırlanır): açıkken akorlar, şemalar ve sahne modu capo kadar aşağı gösterilir (`playView` in `src/chords.ts`; ör. Bm + capo 2 → Am şekli), başlıkta "Capo 2 · Am şekli". Dışa aktarmada `Capo: N` / ChordPro `{capo: N}` (akorlar sesin tonunda kalır). Toplam 58 birim testi. Tarayıcıda denendi.
- **2026-11-13 ~13:30:** Windows kurulum dosyası (NSIS, kullanıcı başına, Türkçe; PR #10), ikon düzeltmesi (`make-ico.ps1`: küçük boyutlar BMP, 256 px PNG; PR #11), GitHub Release v0.1.0 (repo özel). README'ye kurulum bölümü eklendi. Not: Claude oturumundan çalıştırılan kurulum Claude'un sanal AppData'sına gider; kullanıcıya kurulum Gezgin üzerinden başlatılmalı.

## Sonraki fikirler (henüz yapılmadı)

- Masaüstünde elle doğrulama: mikrofon kaydı, dosya indirme (yedek / .txt) ve yazdırma WebView2'de.
- Piyano akor şemaları.
- Capo önerisi (kolay açık akorlara düşen capo perdesini önermek).
- Kayıt dinlerken eşzamanlı söz takibi.
- Mobil sürüm (Tauri 2 iOS/Android).
