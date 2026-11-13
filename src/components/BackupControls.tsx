import { useRef, useState } from "react";
import type { Library } from "../useLibrary";
import { buildBackup, restoreBackup } from "../backup";
import { downloadFile } from "../exporting";
import { Dialog } from "./Dialog";

/** Kenar çubuğundaki "Yedekle / Yedekten yükle" düğmeleri. */
export function BackupControls({ library }: { library: Library }) {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [result, setResult] = useState<{ title: string; body: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function exportAll() {
    setBusy("export");
    try {
      const backup = await buildBackup();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(`bestele-yedek-${stamp}.json`, JSON.stringify(backup), "application/json");
      const audioCount = Object.keys(backup.audio).length;
      setResult({
        title: "Yedek hazır",
        body: `${backup.songs.length} şarkı, ${backup.versions.length} versiyon ve ${audioCount} ses dosyası “bestele-yedek-${stamp}.json” dosyasına kaydedildi (İndirilenler klasörü). Bu dosyayı güvenli bir yerde sakla.`,
      });
    } catch (e) {
      setResult({ title: "Yedek alınamadı", body: String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy("import");
    try {
      const r = await restoreBackup(await file.text());
      await library.reload();
      setResult({
        title: "Yedek yüklendi",
        body:
          r.songsAdded === r.songsInFile
            ? `${r.songsAdded} şarkı deftere eklendi.`
            : `Yedekteki ${r.songsInFile} şarkının ${r.songsAdded} tanesi eklendi; diğerleri defterde zaten vardı, onlara dokunulmadı.`,
      });
    } catch (e) {
      setResult({ title: "Yedek yüklenemedi", body: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="backup">
      <button className="link-btn" onClick={exportAll} disabled={busy !== null}>
        {busy === "export" ? "Yedekleniyor…" : "Yedekle"}
      </button>
      <span className="muted">·</span>
      <button className="link-btn" onClick={() => input.current?.click()} disabled={busy !== null}>
        {busy === "import" ? "Yükleniyor…" : "Yedekten yükle"}
      </button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
      {result && (
        <Dialog title={result.title} onClose={() => setResult(null)}>
          <p>{result.body}</p>
          <div className="dialog-actions">
            <button className="btn btn-primary" autoFocus onClick={() => setResult(null)}>
              Tamam
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
