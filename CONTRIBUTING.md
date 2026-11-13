# Katkıda bulunma

Bestele'ye ilgi gösterdiğin için teşekkürler! Hata bildirimi, öneri ve kod katkısı memnuniyetle karşılanır.

## Hata bildirmek ya da öneri sunmak

[Issues](../../issues) sayfasından yeni bir kayıt aç. Hata bildiriyorsan şunları yaz:

- Ne yaptın, ne olmasını bekledin, ne oldu?
- Windows sürümü ve Bestele sürümü (ör. 0.1.0)
- Varsa ekran görüntüsü

## Kod katkısı

Repoya doğrudan yazma yetkisi yalnızca proje sahibindedir. Katkılar fork + pull request ile gelir ve her PR proje sahibi tarafından incelenip onaylanmadan birleştirilmez.

1. Repoyu fork'la ve yeni bir branch aç (`ozellik/kisa-ad` ya da `duzeltme/kisa-ad`).
2. Geliştirme ortamını kur:
   ```bash
   npm install
   npm run tauri dev
   ```
3. Değişikliğini yap. Büyük bir özellik düşünüyorsan önce bir issue açıp konuşalım, emeğin boşa gitmesin.
4. Göndermeden önce şunların hatasız geçtiğinden emin ol:
   ```bash
   npm test
   npm run build
   ```
   Rust tarafına dokunduysan `src-tauri` içinde `cargo build` de çalıştır.
5. PR açarken neyi neden değiştirdiğini ve nasıl denediğini yaz.

## Kurallar

- Arayüz metinleri Türkçe.
- Veritabanı şeması değişiyorsa `src/data/sqlRepo.ts` içindeki `MIGRATIONS` dizisinin **sonuna** yeni bir adım ekle; var olan adımları değiştirme. Tarayıcı önizlemesi için `src/data/localRepo.ts`'yi de güncelle.
- Saf mantık (akor, transpoze, dışa aktarma vb.) için `vitest` testi ekle.
- Yeni bağımlılık eklemeden önce gerçekten gerekli olduğundan emin ol.

## Lisans

Katkıların, projenin lisansı olan [GNU GPL v3](LICENSE) altında yayınlanır.
