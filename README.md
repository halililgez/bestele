# Bestele

Dijital beste defteri. Şarkıları, akorları, sözleri, ses kayıtlarını ve bir şarkının ilk fikirden son hâline kadar gelişimini tek yerde tutar.

## Teknoloji

- **Tauri 2** (masaüstü, ileride iOS / Android)
- **React + TypeScript + Vite** (arayüz)
- **SQLite** (`tauri-plugin-sql`), veriler bilgisayarda yerel olarak tutulur

## Çalıştırma

```bash
npm install
npm run tauri dev   # masaüstü uygulaması
npm run dev         # yalnızca tarayıcı önizlemesi (veriler localStorage'da)
```

## Yol haritası (ilk sürüm)

- [x] Şarkı listesi, klasörler, etiketler, ton / tempo / ölçü / durum, notlar
- [x] İki tema: Defter ve Modern
- [ ] Beste sayfası: söz + akor, bölümler (kıta, nakarat, köprü)
- [ ] Kayıtlar: mikrofondan kayıt ve dosya yükleme
- [ ] Gelişim: versiyonlar ve zaman çizelgesi
