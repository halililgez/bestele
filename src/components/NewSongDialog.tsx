import { useState, type FormEvent } from "react";
import { Dialog } from "./Dialog";
import { MUSICAL_KEYS, emptySong, type SongFields } from "../types";

interface Props {
  defaultFolderId: string | null;
  defaultTag: string | null;
  onCreate: (fields: SongFields) => void;
  onClose: () => void;
}

export function NewSongDialog({ defaultFolderId, defaultTag, onCreate, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [musicalKey, setKey] = useState("");
  const [tempo, setTempo] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const bpm = parseInt(tempo, 10);
    onCreate({
      ...emptySong(title.trim() || "Adsız şarkı"),
      musicalKey,
      tempo: Number.isFinite(bpm) && bpm > 0 ? bpm : null,
      folderId: defaultFolderId,
      tags: defaultTag ? [defaultTag] : [],
    });
  }

  return (
    <Dialog title="Yeni şarkı" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="fields">
          <label className="field wide">
            <span>Şarkının adı</span>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Çalışma adı da olur" />
          </label>
          <label className="field">
            <span>Ton</span>
            <select value={musicalKey} onChange={(e) => setKey(e.target.value)}>
              <option value="">Belirsiz</option>
              {MUSICAL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Tempo (BPM)</span>
            <input type="number" min={20} max={300} value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder="ör. 92" />
          </label>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn-primary">
            Oluştur
          </button>
        </div>
      </form>
    </Dialog>
  );
}
