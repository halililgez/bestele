import { useMemo, useState } from "react";
import type { Library } from "../useLibrary";
import { THEME_LABELS, type Theme } from "../theme";
import { ConfirmDialog, Dialog } from "./Dialog";
import { BackupControls } from "./BackupControls";
import type { Folder } from "../types";

export const SHORTCUTS: [string, string][] = [
  ["Ctrl + N", "Yeni şarkı"],
  ["Ctrl + F", "Şarkılarda ara"],
  ["Esc", "Şarkıdan listeye dön"],
  ["Ctrl + 1 … 4", "Şarkıda sekme değiştir (Beste, Kayıtlar, Gelişim, Bilgiler)"],
  ["Ctrl + E", "Beste sayfasında Yaz / Oku arasında geç"],
  ["Ctrl + P", "Beste sayfasını yazdır (Oku görünümü)"],
  ["Boşluk", "Sahne modunda otomatik kaydırmayı başlat / durdur"],
  ["↑ ↓", "Sahne modunda kaydırma hızı"],
  ["+ −", "Sahne modunda yazı boyutu"],
];

export type LibraryFilter =
  | { kind: "all" }
  | { kind: "unfiled" }
  | { kind: "folder"; id: string }
  | { kind: "tag"; tag: string };

interface Props {
  library: Library;
  filter: LibraryFilter;
  onFilter: (f: LibraryFilter) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
}

export function Sidebar({ library, filter, onFilter, theme, onTheme }: Props) {
  const { songs, folders } = library;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Folder | null>(null);
  const [showKeys, setShowKeys] = useState(false);

  const folderCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of songs) if (s.folderId) m.set(s.folderId, (m.get(s.folderId) ?? 0) + 1);
    return m;
  }, [songs]);

  const tags = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of songs) for (const t of s.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [songs]);

  const unfiled = songs.filter((s) => !s.folderId).length;
  const is = (f: LibraryFilter) => JSON.stringify(f) === JSON.stringify(filter);

  async function submitNew(name: string) {
    setAdding(false);
    const clean = name.trim();
    if (!clean) return;
    const folder = await library.createFolder(clean);
    if (folder) onFilter({ kind: "folder", id: folder.id });
  }

  async function submitRename(id: string, name: string) {
    setEditing(null);
    const clean = name.trim();
    if (clean) await library.renameFolder(id, clean);
  }

  return (
    <aside className="sidebar">
      <h1 className="brand">
        Bestele
        <span className="brand-sub">Beste defteri</span>
      </h1>

      <nav className="side-section">
        <button className={`side-item ${is({ kind: "all" }) ? "active" : ""}`} onClick={() => onFilter({ kind: "all" })}>
          <span className="label">Tüm şarkılar</span>
          <span className="count">{songs.length}</span>
        </button>
        <button
          className={`side-item ${is({ kind: "unfiled" }) ? "active" : ""}`}
          onClick={() => onFilter({ kind: "unfiled" })}
        >
          <span className="label">Klasörsüz</span>
          <span className="count">{unfiled}</span>
        </button>
      </nav>

      <section className="side-section">
        <div className="side-heading">
          <span>Klasörler</span>
          <button className="icon-btn" title="Yeni klasör" aria-label="Yeni klasör" onClick={() => setAdding(true)}>
            +
          </button>
        </div>
        {folders.map((f) =>
          editing === f.id ? (
            <InlineInput key={f.id} initial={f.name} onDone={(v) => submitRename(f.id, v)} />
          ) : (
            <div className="side-row" key={f.id}>
              <button
                className={`side-item ${is({ kind: "folder", id: f.id }) ? "active" : ""}`}
                onClick={() => onFilter({ kind: "folder", id: f.id })}
                onDoubleClick={() => setEditing(f.id)}
              >
                <span className="label">{f.name}</span>
                <span className="count">{folderCounts.get(f.id) ?? 0}</span>
              </button>
              <span className="row-actions">
                <button className="icon-btn" title="Yeniden adlandır" aria-label="Yeniden adlandır" onClick={() => setEditing(f.id)}>
                  ✎
                </button>
                <button className="icon-btn" title="Klasörü sil" aria-label="Klasörü sil" onClick={() => setDeleting(f)}>
                  ×
                </button>
              </span>
            </div>
          ),
        )}
        {adding && <InlineInput initial="" placeholder="Klasör adı" onDone={submitNew} />}
        {folders.length === 0 && !adding && <div className="side-empty">Henüz klasör yok</div>}
      </section>

      {tags.length > 0 && (
        <section className="side-section">
          <div className="side-heading">
            <span>Etiketler</span>
          </div>
          {tags.map(([tag, count]) => (
            <button
              key={tag}
              className={`side-item ${is({ kind: "tag", tag }) ? "active" : ""}`}
              onClick={() => onFilter({ kind: "tag", tag })}
            >
              <span className="label">#{tag}</span>
              <span className="count">{count}</span>
            </button>
          ))}
        </section>
      )}

      <div className="sidebar-footer">
        <div className="segmented" role="radiogroup" aria-label="Tema">
          {(Object.keys(THEME_LABELS) as Theme[]).map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} className={theme === t ? "on" : ""} onClick={() => onTheme(t)}>
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
        <BackupControls library={library} />
        <button className="link-btn shortcuts-btn" onClick={() => setShowKeys(true)}>
          Klavye kısayolları
        </button>
        {library.storage === "browser" && (
          <div className="storage-note">Tarayıcı önizlemesi: veriler yalnızca bu tarayıcıda tutulur.</div>
        )}
      </div>

      {showKeys && (
        <Dialog title="Klavye kısayolları" onClose={() => setShowKeys(false)}>
          <dl className="keys">
            {SHORTCUTS.map(([k, d]) => (
              <div key={k}>
                <dt>
                  <kbd>{k}</kbd>
                </dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
          <div className="dialog-actions">
            <button className="btn btn-primary" autoFocus onClick={() => setShowKeys(false)}>
              Tamam
            </button>
          </div>
        </Dialog>
      )}

      {deleting && (
        <ConfirmDialog
          title="Klasörü sil"
          message={
            <>
              <strong>{deleting.name}</strong> klasörü silinecek. İçindeki şarkılar silinmez, "Klasörsüz" bölümüne taşınır.
            </>
          }
          confirmLabel="Klasörü sil"
          onConfirm={() => {
            if (filter.kind === "folder" && filter.id === deleting.id) onFilter({ kind: "all" });
            library.deleteFolder(deleting.id);
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </aside>
  );
}

function InlineInput({
  initial,
  placeholder,
  onDone,
}: {
  initial: string;
  placeholder?: string;
  onDone: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      className="side-input"
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") onDone(initial ? initial : "");
      }}
    />
  );
}
