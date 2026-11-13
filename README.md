# Bestele

Dijital beste defteri. Şarkıları, akorları, sözleri, ses kayıtlarını ve bir şarkının ilk fikirden son hâline kadar gelişimini tek yerde tutar.

## Kurulum (Windows)

**Gereksinim:** Windows 10 veya 11 (64 bit). Uygulamanın kullandığı Microsoft Edge WebView2 bu sürümlerde zaten yüklüdür; eksikse kurulum onu kendisi indirir.

1. [Releases](../../releases/latest) sayfasından **`Bestele_<sürüm>_x64-setup.exe`** dosyasını indir.
2. İndirilen dosyaya çift tıkla.
3. Windows **"Windows kişisel bilgisayarınızı korudu"** uyarısı gösterirse **Ek bilgi › Yine de çalıştır**'a tıkla. Uygulama henüz dijital olarak imzalı olmadığı için bu uyarı çıkar.
4. Kurulum ekranında **Kur**'a tıkla. Yönetici izni istemez.
5. Kurulum bitince Bestele masaüstünde ve Başlat menüsünde olur.

**Güncelleme:** Yeni sürümün kurulum dosyasını indirip aynı şekilde kur. Şarkıların ve kayıtların korunur.

**Kaldırma:** Ayarlar › Uygulamalar › Yüklü uygulamalar › Bestele › Kaldır. Kaldırmak şarkılarını silmez.

**Verilerin nerede?** Şarkılar `%APPDATA%\com.bestele.app\bestele.db` dosyasında, ses kayıtları aynı klasördeki `recordings` içinde. Bilgisayar değiştirirken uygulamadaki **Yedekle** ile her şeyi tek dosyaya al, yeni bilgisayarda **Yedekten yükle** de.

## Kurulum (macOS)

**Gereksinim:** macOS 10.15 (Catalina) veya üstü. Hem Apple Silicon (M1/M2/M3…) hem Intel Mac'lerde çalışır.

1. [Releases](../../releases/latest) sayfasından **`Bestele_<sürüm>_universal.dmg`** dosyasını indir.
2. `.dmg` dosyasını aç, **Bestele**'yi **Uygulamalar** (Applications) klasörüne sürükle.
3. Uygulama Apple tarafından imzalı ve onaylı olmadığı için ilk açılışta macOS onu engeller ("hasarlı" ya da "geliştirici doğrulanamadı" der). Terminal'de bir kez şunu çalıştır, ardından Bestele'yi normal şekilde aç:

   ```bash
   xattr -cr /Applications/Bestele.app
   ```

4. İlk kayıtta mikrofon izni istenir; **İzin Ver**'e tıkla. Sonradan değiştirmek için: Sistem Ayarları › Gizlilik ve Güvenlik › Mikrofon. İzin penceresi hiç çıkmıyorsa izni sıfırlayıp Bestele'yi yeniden aç:

   ```bash
   tccutil reset Microphone com.bestele.app
   ```

**Güncelleme:** Yeni `.dmg`'deki Bestele'yi Uygulamalar klasörüne sürükleyip eskisinin yerine koy, 3. adımı tekrarla. Şarkıların korunur.

**Verilerin nerede?** `~/Library/Application Support/com.bestele.app/` (şarkılar `bestele.db`, ses kayıtları `recordings`).

## Özellikler

- **Şarkı listesi:** Arama, durum filtresi (Fikir, Taslak, Demo, Tamamlandı), sıralama, klasörler ve etiketler.
- **Beste sayfası:** Şarkı bölümlere (kıta, nakarat, köprü…) ayrılır, akorlar sözün içine `[Am]Gece ya[F]rısı` biçiminde yazılır. Tona uygun akor paleti var. Oku görünümünde akorlar sözlerin üstünde gösterilir, transpoze yapılabilir.
- **Kayıtlar:** Mikrofondan kayıt (seviye göstergesi, duraklatma), ses dosyası yükleme, oynatma, kaydı bir bölüme bağlama ve not alma.
- **Gelişim:** Versiyon kaydetme, aşama yolculuğu, zaman çizelgesi, versiyonları karşılaştırma ve eski bir versiyona geri dönme (dönmeden önce otomatik yedek alınır).
- **Akor şemaları:** Oku görünümünde şarkıda geçen akorların gitar parmak pozisyonları gösterilir (transpozeye uyar, baskıda da çıkar).
- **Capo:** Şarkıya capo perdesi girilir. "Capo ile çal" açıkken akorlar ve şemalar çalınacak şekillerle gösterilir (ör. Bm tonunda capo 2 → Am şekli); ses tonu değişmez.
- **Dalga formu ve kırpma:** Kayıtların dalga formu görüntülenir, seçilen parça yeni bir kayıt olarak saklanır.
- **Prova araçları:** Metronom (ölçüye göre vurgulu ilk vuruş), "Vur" ile tempo bulma, sahne modu (tam ekran, büyük yazı, otomatik kaydırma).
- **Arama:** Ad, yazan, not, etiket ve sözlerin içinde. Türkçe karakter duyarsızdır ("gece yarisi" yazınca "Gece Yarısı" bulunur), eşleşen söz satırı kartta gösterilir.
- **Dışa aktarma:** Yazdırma, düz metin olarak kopyalama, `.txt` ve ChordPro (`.cho`) dosyası.
- **Yedekleme:** Bütün defter, ses dosyaları dahil tek bir `.json` dosyasına alınır. Yedekten yükleme mevcut şarkıları ezmez.
- **Temalar:** Defter (çizgili kâğıt) ve Modern (koyu).

## Klavye kısayolları

| Kısayol | İşlev |
| --- | --- |
| Ctrl + N | Yeni şarkı |
| Ctrl + F | Şarkılarda ara |
| Esc | Şarkıdan listeye dön |
| Ctrl + 1 … 4 | Şarkıda sekme değiştir |
| Ctrl + E | Yaz / Oku arasında geç |
| Ctrl + P | Beste sayfasını yazdır |
| Boşluk / ↑ ↓ / + − | Sahne modunda kaydırma, hız, yazı boyutu |

## Teknoloji

- **Tauri 2** (masaüstü; ileride iOS / Android)
- **React + TypeScript + Vite**
- **SQLite** (`tauri-plugin-sql`). Ses dosyaları uygulama verisi altındaki `recordings/` klasöründe tutulur.
- Tarayıcı önizlemesinde (`npm run dev`) veriler localStorage'da, sesler IndexedDB'de tutulur.

## Geliştirme

```bash
npm install
npm run tauri dev   # masaüstü uygulaması
npm run dev         # yalnızca tarayıcı önizlemesi
npm test            # birim testleri (vitest)
npm run tauri build # kurulum dosyası: src-tauri/target/release/bundle/nsis/Bestele_<sürüm>_x64-setup.exe
```

İkonlar `src-tauri/icons/source.svg` dosyasından `npx tauri icon src-tauri/icons/source.svg` komutuyla üretilir. Ardından Windows ikonu için `powershell -ExecutionPolicy Bypass -File src-tauri/icons/make-ico.ps1` çalıştırılır (Gezgin'in her boyutta okuyabildiği `icon.ico`).

**Yeni sürüm yayınlama:** `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` ve `package.json` içindeki sürümü artır, `npm run tauri build` çalıştır, ardından:

```bash
gh release create v<sürüm> src-tauri/target/release/bundle/nsis/Bestele_<sürüm>_x64-setup.exe
```

Sürüm yayınlanınca GitHub Actions ([release-macos.yml](.github/workflows/release-macos.yml)) macOS `.dmg` dosyasını kendisi derleyip aynı sürüme ekler. Var olan bir sürüme elle eklemek için: Actions › macOS sürümü › Run workflow, etiketi gir.

**Mac'te geliştirme:** Xcode Command Line Tools (`xcode-select --install`), Node.js ve Rust gerekir. `npm install` ve `npm run tauri dev` aynı şekilde çalışır; `npm run tauri build` `.app` ve `.dmg` üretir (`src-tauri/target/release/bundle/`). macOS'a özel ayarlar `src-tauri/tauri.macos.conf.json` ve `src-tauri/Info.plist` dosyalarındadır.

Geliştirme notları ve fazlar için: [docs/ILERLEME.md](docs/ILERLEME.md)

## Katkıda bulunma

Hata bildirimleri, öneriler ve pull request'ler memnuniyetle karşılanır. Ayrıntılar için: [CONTRIBUTING.md](CONTRIBUTING.md)

## Lisans

Copyright (C) 2026 Halil İlgez

Bestele özgür bir yazılımdır: [GNU Genel Kamu Lisansı sürüm 3](LICENSE) (GPL-3.0) koşulları altında kullanabilir, değiştirebilir ve dağıtabilirsin. Bestele'den türetilen ve dağıtılan her yazılım da aynı lisansla, kaynak koduyla birlikte yayınlanmak zorundadır. Yazılım hiçbir garanti olmaksızın sunulur.
