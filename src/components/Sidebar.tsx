import { useMemo, useState } from "react";
import type { Library } from "../useLibrary";
import { THEMES, type Theme } from "../theme";
import { LOCALES, RichText, useLocale, useT } from "../i18n";
import { compareText } from "../util";
import { ConfirmDialog, Dialog } from "./Dialog";
import { BackupControls } from "./BackupControls";
import type { Folder } from "../types";

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
  const t = useT();
  const { locale, setLocale } = useLocale();
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
    return [...m.entries()].sort((a, b) => compareText(a[0], b[0]));
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
        <span className="brand-sub">{t.sidebar.tagline}</span>
      </h1>

      <nav className="side-section">
        <button className={`side-item ${is({ kind: "all" }) ? "active" : ""}`} onClick={() => onFilter({ kind: "all" })}>
          <span className="label">{t.sidebar.allSongs}</span>
          <span className="count">{songs.length}</span>
        </button>
        <button
          className={`side-item ${is({ kind: "unfiled" }) ? "active" : ""}`}
          onClick={() => onFilter({ kind: "unfiled" })}
        >
          <span className="label">{t.common.unfiled}</span>
          <span className="count">{unfiled}</span>
        </button>
      </nav>

      <section className="side-section">
        <div className="side-heading">
          <span>{t.sidebar.folders}</span>
          <button className="icon-btn" title={t.sidebar.newFolder} aria-label={t.sidebar.newFolder} onClick={() => setAdding(true)}>
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
                <button className="icon-btn" title={t.sidebar.rename} aria-label={t.sidebar.rename} onClick={() => setEditing(f.id)}>
                  ✎
                </button>
                <button className="icon-btn" title={t.sidebar.deleteFolder} aria-label={t.sidebar.deleteFolder} onClick={() => setDeleting(f)}>
                  ×
                </button>
              </span>
            </div>
          ),
        )}
        {adding && <InlineInput initial="" placeholder={t.sidebar.folderName} onDone={submitNew} />}
        {folders.length === 0 && !adding && <div className="side-empty">{t.sidebar.noFolders}</div>}
      </section>

      {tags.length > 0 && (
        <section className="side-section">
          <div className="side-heading">
            <span>{t.sidebar.tags}</span>
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
        <div className="segmented" role="radiogroup" aria-label={t.sidebar.theme}>
          {THEMES.map((th) => (
            <button key={th} role="radio" aria-checked={theme === th} className={theme === th ? "on" : ""} onClick={() => onTheme(th)}>
              {t.themes[th]}
            </button>
          ))}
        </div>
        <div className="segmented" role="radiogroup" aria-label={t.sidebar.language}>
          {LOCALES.map((l) => (
            <button
              key={l.id}
              role="radio"
              lang={l.id}
              aria-checked={locale === l.id}
              className={locale === l.id ? "on" : ""}
              onClick={() => setLocale(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <BackupControls library={library} />
        <button className="link-btn shortcuts-btn" onClick={() => setShowKeys(true)}>
          {t.sidebar.shortcuts}
        </button>
        {library.storage === "browser" && (
          <div className="storage-note">{t.sidebar.browserStorage}</div>
        )}
      </div>

      {showKeys && (
        <Dialog title={t.sidebar.shortcuts} onClose={() => setShowKeys(false)}>
          <dl className="keys">
            {t.shortcuts.map(([k, d]) => (
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
              {t.common.ok}
            </button>
          </div>
        </Dialog>
      )}

      {deleting && (
        <ConfirmDialog
          title={t.sidebar.deleteFolder}
          message={<RichText parts={t.sidebar.deleteFolderBody(deleting.name)} />}
          confirmLabel={t.sidebar.deleteFolder}
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
