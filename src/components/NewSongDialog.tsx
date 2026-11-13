import { useState, type FormEvent } from "react";
import { Dialog } from "./Dialog";
import { MUSICAL_KEYS, emptySong, type SongFields } from "../types";
import { useT } from "../i18n";

interface Props {
  defaultFolderId: string | null;
  defaultTag: string | null;
  onCreate: (fields: SongFields) => void;
  onClose: () => void;
}

export function NewSongDialog({ defaultFolderId, defaultTag, onCreate, onClose }: Props) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [musicalKey, setKey] = useState("");
  const [tempo, setTempo] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const bpm = parseInt(tempo, 10);
    onCreate({
      ...emptySong(title.trim() || t.common.untitledSong),
      musicalKey,
      tempo: Number.isFinite(bpm) && bpm > 0 ? bpm : null,
      folderId: defaultFolderId,
      tags: defaultTag ? [defaultTag] : [],
    });
  }

  return (
    <Dialog title={t.newSong.title} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="fields">
          <label className="field wide">
            <span>{t.newSong.name}</span>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.newSong.namePlaceholder} />
          </label>
          <label className="field">
            <span>{t.common.key}</span>
            <select value={musicalKey} onChange={(e) => setKey(e.target.value)}>
              <option value="">{t.common.keyUnset}</option>
              {MUSICAL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t.common.tempoBpm}</span>
            <input type="number" min={20} max={300} value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder={t.newSong.tempoPlaceholder} />
          </label>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary">
            {t.newSong.create}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
