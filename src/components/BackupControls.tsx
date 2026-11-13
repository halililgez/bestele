import { useRef, useState } from "react";
import type { Library } from "../useLibrary";
import { buildBackup, restoreBackup } from "../backup";
import { saveFile } from "../exporting";
import { Dialog } from "./Dialog";
import { useT } from "../i18n";

/** Kenar çubuğundaki "Yedekle / Yedekten yükle" düğmeleri. */
export function BackupControls({ library }: { library: Library }) {
  const t = useT();
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [result, setResult] = useState<{ title: string; body: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function exportAll() {
    setBusy("export");
    try {
      const backup = await buildBackup();
      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = t.backup.fileName(stamp);
      const saved = await saveFile(fileName, JSON.stringify(backup), t.common.filterBackup);
      if (!saved.saved) return; // kullanıcı kaydetme penceresinde vazgeçti
      const audioCount = Object.keys(backup.audio).length;
      setResult({
        title: t.backup.readyTitle,
        body: t.backup.readyBody(backup.songs.length, backup.versions.length, audioCount, saved.where, saved.inDownloads),
      });
    } catch (e) {
      setResult({ title: t.backup.exportFailed, body: String(e) });
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
        title: t.backup.importedTitle,
        body: r.songsAdded === r.songsInFile ? t.backup.importedAll(r.songsAdded) : t.backup.importedSome(r.songsAdded, r.songsInFile),
      });
    } catch (e) {
      setResult({ title: t.backup.importFailed, body: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="backup">
      <button className="link-btn" onClick={exportAll} disabled={busy !== null}>
        {busy === "export" ? t.backup.exporting : t.backup.export}
      </button>
      <span className="muted">·</span>
      <button className="link-btn" onClick={() => input.current?.click()} disabled={busy !== null}>
        {busy === "import" ? t.common.loading : t.backup.import}
      </button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
      {result && (
        <Dialog title={result.title} onClose={() => setResult(null)}>
          <p>{result.body}</p>
          <div className="dialog-actions">
            <button className="btn btn-primary" autoFocus onClick={() => setResult(null)}>
              {t.common.ok}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
