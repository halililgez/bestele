export type SongStatus = "fikir" | "taslak" | "demo" | "tamam";

export interface Song {
  id: string;
  title: string;
  /** Söz / müzik yazanı */
  writer: string;
  musicalKey: string;
  tempo: number | null;
  timeSignature: string;
  /** Gitarda capo perdesi (0 = capo yok). Ses değişmez, yalnızca çalınan akor şekilleri değişir. */
  capo: number;
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

export interface Recording {
  id: string;
  songId: string;
  /** Kayıt belirli bir bölüme aitse o bölüm; değilse bütün şarkı */
  sectionId: string | null;
  title: string;
  note: string;
  /** Ses dosyasının depodaki adı (ör. "<uuid>.webm") */
  fileName: string;
  mimeType: string;
  durationMs: number | null;
  sizeBytes: number;
  /** "kayit" = uygulamada kaydedildi, "dosya" = dışarıdan yüklendi */
  source: "kayit" | "dosya";
  createdAt: number;
}

export type RecordingFields = Omit<Recording, "id" | "createdAt">;
export type RecordingPatch = Partial<Pick<Recording, "title" | "note" | "sectionId">>;

/** Bir versiyon kaydedildiği andaki şarkının donmuş hâli */
export interface VersionSnapshot {
  title: string;
  musicalKey: string;
  tempo: number | null;
  timeSignature: string;
  /** Capo eklenmeden önce kaydedilmiş versiyonlarda yoktur. */
  capo?: number;
  sections: SectionFields[];
}

export interface Version {
  id: string;
  songId: string;
  name: string;
  note: string;
  /** Kaydedildiği andaki aşama */
  stage: SongStatus;
  snapshot: VersionSnapshot;
  /** Bu versiyonu temsil eden kayıtlar */
  recordingIds: string[];
  createdAt: number;
}

export type VersionFields = Omit<Version, "id" | "createdAt">;
export type VersionPatch = Partial<Pick<Version, "name" | "note" | "stage" | "recordingIds">>;

/** Yedek dosyasının içeriği (ses dosyaları base64 olarak ayrıca `audio` alanında) */
export interface BackupRecords {
  folders: Folder[];
  songs: Song[];
  sections: Section[];
  recordings: Recording[];
  versions: Version[];
}

export interface BackupFile extends BackupRecords {
  app: "bestele";
  format: 1;
  exportedAt: number;
  audio: Record<string, string>;
}

export const SECTION_ORDER: SectionKind[] = ["giris", "kita", "onnakarat", "nakarat", "kopru", "solo", "ara", "final", "diger"];

export const STATUS_ORDER: SongStatus[] = ["fikir", "taslak", "demo", "tamam"];

const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const MUSICAL_KEYS: string[] = [...NOTES, ...NOTES.map((n) => n + "m")];

export const MAX_CAPO = 9;

/** Eski kayıtlarda/yedeklerde olmayan ya da bozuk capo değerini 0-9 aralığına çeker. */
export function normalizeCapo(v: unknown): number {
  const n = typeof v === "number" ? Math.round(v) : parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_CAPO, n)) : 0;
}

export const TIME_SIGNATURES = ["4/4", "3/4", "2/4", "6/8", "5/8", "7/8", "9/8", "12/8"];

export function emptySong(title: string): SongFields {
  return {
    title,
    writer: "",
    musicalKey: "",
    tempo: null,
    timeSignature: "4/4",
    capo: 0,
    status: "fikir",
    notes: "",
    folderId: null,
    tags: [],
  };
}
