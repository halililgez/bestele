import { useEffect, useState } from "react";
import { useLibrary } from "./useLibrary";
import { useTheme } from "./theme";
import { Sidebar, type LibraryFilter } from "./components/Sidebar";
import { SongLibrary } from "./components/SongLibrary";
import { SongPage } from "./components/SongPage";
import { NewSongDialog } from "./components/NewSongDialog";

export default function App() {
  const library = useLibrary();
  const [theme, setTheme] = useTheme();
  const [filter, setFilter] = useState<LibraryFilter>({ kind: "all" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const openSong = openId ? library.songs.find((s) => s.id === openId) : undefined;

  // Genel kısayollar (diyalog açıkken devre dışı; diyaloglar kendi Esc'lerini yönetir)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector(".overlay")) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (ctrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCreating(true);
      } else if (ctrl && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setOpenId(null);
        window.setTimeout(() => document.querySelector<HTMLInputElement>(".search")?.focus(), 0);
      } else if (e.key === "Escape" && !typing && openId) {
        setOpenId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  return (
    <div className="app">
      <Sidebar
        library={library}
        filter={filter}
        onFilter={(f) => {
          setFilter(f);
          setOpenId(null);
        }}
        theme={theme}
        onTheme={setTheme}
      />

      <main className="main">
        {!library.ready && !library.error ? null : openSong ? (
          <SongPage song={openSong} library={library} onBack={() => setOpenId(null)} />
        ) : (
          <SongLibrary library={library} filter={filter} onOpen={setOpenId} onNew={() => setCreating(true)} />
        )}
      </main>

      {creating && (
        <NewSongDialog
          defaultFolderId={filter.kind === "folder" ? filter.id : null}
          defaultTag={filter.kind === "tag" ? filter.tag : null}
          onClose={() => setCreating(false)}
          onCreate={async (fields) => {
            setCreating(false);
            const song = await library.createSong(fields);
            if (song) setOpenId(song.id);
          }}
        />
      )}

      {library.error && (
        <div className="toast" role="alert">
          <span>Bir sorun oldu: {library.error}</span>
          <button onClick={library.clearError} aria-label="Kapat">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
