export type SongStatus = "fikir" | "taslak" | "demo" | "tamam";

export interface Song {
  id: string;
  title: string;
  /** Söz / müzik yazanı */
  writer: string;
  musicalKey: string;
  tempo: number | null;
  timeSignature: string;
  status: SongStatus;
  notes: string;
  folderId: string | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/** Yeni şarkı oluştururken ya da güncellerken gönderilen alanlar */
export type SongFields = Omit<Song, "id" | "createdAt" | "updatedAt">;

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export const STATUS_LABELS: Record<SongStatus, string> = {
  fikir: "Fikir",
  taslak: "Taslak",
  demo: "Demo",
  tamam: "Tamamlandı",
};

export const STATUS_ORDER: SongStatus[] = ["fikir", "taslak", "demo", "tamam"];

const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const MUSICAL_KEYS: string[] = [...NOTES, ...NOTES.map((n) => n + "m")];

export const TIME_SIGNATURES = ["4/4", "3/4", "2/4", "6/8", "5/8", "7/8", "9/8", "12/8"];

export function emptySong(title: string): SongFields {
  return {
    title,
    writer: "",
    musicalKey: "",
    tempo: null,
    timeSignature: "4/4",
    status: "fikir",
    notes: "",
    folderId: null,
    tags: [],
  };
}
