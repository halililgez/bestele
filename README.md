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

Geliştirme notları ve fazlar için: [docs/ILERLEME.md](docs/ILERLEME.md)
