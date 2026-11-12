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

export type SectionKind = "giris" | "kita" | "onnakarat" | "nakarat" | "kopru" | "solo" | "ara" | "final" | "diger";

export interface Section {
  id: string;
  songId: string;
  kind: SectionKind;
  /** Boşsa tür adından otomatik üretilir (ör. "Kıta 2") */
  label: string;
  /** Söz + satır içi akor: "[Am]Gece ya[F]rısı" */
  content: string;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export type SectionFields = Pick<Section, "kind" | "label" | "content">;

export const SECTION_LABELS: Record<SectionKind, string> = {
  giris: "Giriş",
  kita: "Kıta",
  onnakarat: "Ön nakarat",
  nakarat: "Nakarat",
  kopru: "Köprü",
  solo: "Solo",
  ara: "Ara müzik",
  final: "Final",
  diger: "Bölüm",
};

export const SECTION_ORDER: SectionKind[] = ["giris", "kita", "onnakarat", "nakarat", "kopru", "solo", "ara", "final", "diger"];

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
