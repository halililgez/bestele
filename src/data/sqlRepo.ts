import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import { normalizeCapo, type Folder, type Recording, type Section, type SectionKind, type Song, type SongFields, type SongStatus, type Version } from "../types";
import { newId, type Repo } from "./repo";
import { t } from "../i18n";

interface SongRow {
  id: string;
  title: string;
  writer: string;
  musical_key: string;
  tempo: number | null;
  time_signature: string;
  capo: number | null;
  status: string;
  notes: string;
  folder_id: string | null;
  tags: string;
  created_at: number;
  updated_at: number;
}

interface FolderRow {
  id: string;
  name: string;
  created_at: number;
}

/** Her yeni şema değişikliği bu listenin sonuna eklenir; sırası asla değişmez. */
const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS folders (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE IF NOT EXISTS songs (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     writer TEXT NOT NULL DEFAULT '',
     musical_key TEXT NOT NULL DEFAULT '',
     tempo INTEGER,
     time_signature TEXT NOT NULL DEFAULT '4/4',
     status TEXT NOT NULL DEFAULT 'fikir',
     notes TEXT NOT NULL DEFAULT '',
     folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
     tags TEXT NOT NULL DEFAULT '[]',
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );`,
  // 2: Beste sayfası bölümleri
  `CREATE TABLE IF NOT EXISTS sections (
     id TEXT PRIMARY KEY,
     song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
     kind TEXT NOT NULL DEFAULT 'kita',
     label TEXT NOT NULL DEFAULT '',
     content TEXT NOT NULL DEFAULT '',
     position INTEGER NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_sections_song ON sections(song_id, position);`,
  // 3: Ses kayıtları (dosyanın kendisi diskte, recordings klasöründe)
  `CREATE TABLE IF NOT EXISTS recordings (
     id TEXT PRIMARY KEY,
     song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
     section_id TEXT REFERENCES sections(id) ON DELETE SET NULL,
     title TEXT NOT NULL DEFAULT '',
     note TEXT NOT NULL DEFAULT '',
     file_name TEXT NOT NULL,
     mime_type TEXT NOT NULL DEFAULT '',
     duration_ms INTEGER,
     size_bytes INTEGER NOT NULL DEFAULT 0,
     source TEXT NOT NULL DEFAULT 'kayit',
     created_at INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_recordings_song ON recordings(song_id, created_at);`,
  // 4: Versiyonlar (şarkının anlık görüntüleri)
  `CREATE TABLE IF NOT EXISTS versions (
     id TEXT PRIMARY KEY,
     song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
     name TEXT NOT NULL DEFAULT '',
     note TEXT NOT NULL DEFAULT '',
     stage TEXT NOT NULL DEFAULT 'fikir',
     snapshot TEXT NOT NULL,
     recording_ids TEXT NOT NULL DEFAULT '[]',
     created_at INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_versions_song ON versions(song_id, created_at);`,
  // 5: Gitar capo perdesi
  `ALTER TABLE songs ADD COLUMN capo INTEGER NOT NULL DEFAULT 0`,
];

interface VersionRow {
  id: string;
  song_id: string;
  name: string;
  note: string;
  stage: string;
  snapshot: string;
  recording_ids: string;
  created_at: number;
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toVersion(r: VersionRow): Version {
  return {
    id: r.id,
    songId: r.song_id,
    name: r.name,
    note: r.note,
    stage: r.stage as SongStatus,
    snapshot: parseJson(r.snapshot, { title: "", musicalKey: "", tempo: null, timeSignature: "4/4", sections: [] }),
    recordingIds: parseJson<string[]>(r.recording_ids, []),
    createdAt: r.created_at,
  };
}

interface RecordingRow {
  id: string;
  song_id: string;
  section_id: string | null;
  title: string;
  note: string;
  file_name: string;
  mime_type: string;
  duration_ms: number | null;
  size_bytes: number;
  source: string;
  created_at: number;
}

function toRecording(r: RecordingRow): Recording {
  return {
    id: r.id,
    songId: r.song_id,
    sectionId: r.section_id,
    title: r.title,
    note: r.note,
    fileName: r.file_name,
    mimeType: r.mime_type,
    durationMs: r.duration_ms,
    sizeBytes: r.size_bytes,
    source: r.source === "dosya" ? "dosya" : "kayit",
    createdAt: r.created_at,
  };
}

interface SectionRow {
  id: string;
  song_id: string;
  kind: string;
  label: string;
  content: string;
  position: number;
  created_at: number;
  updated_at: number;
}

function toSection(r: SectionRow): Section {
  return {
    id: r.id,
    songId: r.song_id,
    kind: r.kind as SectionKind,
    label: r.label,
    content: r.content,
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface Statement {
  sql: string;
  values?: unknown[];
}

/**
 * Birden çok yazmayı tek bir transaction'da çalıştırır (Rust tarafındaki `sql_batch`): ya hepsi yazılır ya hiçbiri.
 * tauri-plugin-sql bir bağlantı havuzu kullandığından BEGIN/COMMIT'i ayrı `execute` çağrılarıyla göndermek güvenli değildir.
 * Her komutun etkilediği satır sayısını döner.
 */
async function batch(db: Database, statements: Statement[]): Promise<number[]> {
  if (statements.length === 0) return [];
  return invoke<number[]>("sql_batch", {
    db: db.path,
    statements: statements.map((s) => ({ sql: s.sql, values: (s.values ?? []).map((v) => (v === undefined ? null : v)) })),
  });
}

async function migrate(db: Database) {
  const rows = await db.select<{ user_version: number }[]>("PRAGMA user_version");
  let version = rows[0]?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    // Migration ve sürüm numarası birlikte yazılır: yarıda kesilirse ikisi de geri alınır,
    // bir sonraki açılışta migration baştan ve temiz çalışır.
    const stmts: Statement[] = MIGRATIONS[version]
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((sql) => ({ sql }));
    version += 1;
    stmts.push({ sql: `PRAGMA user_version = ${version}` });
    await batch(db, stmts);
  }
}

function toSong(r: SongRow): Song {
  let tags: string[] = [];
  try {
    tags = JSON.parse(r.tags);
  } catch {
    tags = [];
  }
  return {
    id: r.id,
    title: r.title,
    writer: r.writer,
    musicalKey: r.musical_key,
    tempo: r.tempo,
    timeSignature: r.time_signature,
    capo: normalizeCapo(r.capo),
    status: r.status as SongStatus,
    notes: r.notes,
    folderId: r.folder_id,
    tags,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const COLUMNS: Record<keyof SongFields, string> = {
  title: "title",
  writer: "writer",
  musicalKey: "musical_key",
  tempo: "tempo",
  timeSignature: "time_signature",
  capo: "capo",
  status: "status",
  notes: "notes",
  folderId: "folder_id",
  tags: "tags",
};

function toDbValue(key: keyof SongFields, value: unknown) {
  if (key === "tags") return JSON.stringify(value ?? []);
  if (key === "capo") return normalizeCapo(value);
  return value;
}

export async function createSqlRepo(): Promise<Repo> {
  const db = await Database.load("sqlite:bestele.db");
  await db.execute("PRAGMA foreign_keys = ON");
  await migrate(db);

  async function getSong(id: string): Promise<Song> {
    const rows = await db.select<SongRow[]>("SELECT * FROM songs WHERE id = $1", [id]);
    if (!rows[0]) throw new Error(t().errors.songNotFound);
    return toSong(rows[0]);
  }

  return {
    kind: "sqlite",

    async listSongs() {
      const rows = await db.select<SongRow[]>("SELECT * FROM songs ORDER BY updated_at DESC");
      return rows.map(toSong);
    },

    async createSong(fields) {
      const id = newId();
      const now = Date.now();
      const keys = Object.keys(COLUMNS) as (keyof SongFields)[];
      const cols = ["id", ...keys.map((k) => COLUMNS[k]), "created_at", "updated_at"];
      const values = [id, ...keys.map((k) => toDbValue(k, fields[k])), now, now];
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      await db.execute(`INSERT INTO songs (${cols.join(", ")}) VALUES (${placeholders})`, values);
      return getSong(id);
    },

    async updateSong(id, patch) {
      const keys = (Object.keys(patch) as (keyof SongFields)[]).filter((k) => k in COLUMNS);
      const sets = keys.map((k, i) => `${COLUMNS[k]} = $${i + 1}`);
      const values: unknown[] = keys.map((k) => toDbValue(k, patch[k]));
      sets.push(`updated_at = $${values.length + 1}`);
      values.push(Date.now());
      values.push(id);
      await db.execute(`UPDATE songs SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
      return getSong(id);
    },

    async deleteSong(id) {
      await batch(db, [
        { sql: "DELETE FROM versions WHERE song_id = $1", values: [id] },
        { sql: "DELETE FROM recordings WHERE song_id = $1", values: [id] },
        { sql: "DELETE FROM sections WHERE song_id = $1", values: [id] },
        { sql: "DELETE FROM songs WHERE id = $1", values: [id] },
      ]);
    },

    async listFolders() {
      const rows = await db.select<FolderRow[]>("SELECT * FROM folders ORDER BY name COLLATE NOCASE");
      return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
    },

    async createFolder(name) {
      const folder: Folder = { id: newId(), name, createdAt: Date.now() };
      await db.execute("INSERT INTO folders (id, name, created_at) VALUES ($1, $2, $3)", [
        folder.id,
        folder.name,
        folder.createdAt,
      ]);
      return folder;
    },

    async renameFolder(id, name) {
      await db.execute("UPDATE folders SET name = $1 WHERE id = $2", [name, id]);
    },

    async deleteFolder(id) {
      await batch(db, [
        { sql: "UPDATE songs SET folder_id = NULL WHERE folder_id = $1", values: [id] },
        { sql: "DELETE FROM folders WHERE id = $1", values: [id] },
      ]);
    },

    async listSections(songId) {
      const rows = await db.select<SectionRow[]>("SELECT * FROM sections WHERE song_id = $1 ORDER BY position", [songId]);
      return rows.map(toSection);
    },

    async createSection(songId, fields, index) {
      const existing = await db.select<SectionRow[]>("SELECT * FROM sections WHERE song_id = $1 ORDER BY position", [songId]);
      const at = index === undefined ? existing.length : Math.max(0, Math.min(index, existing.length));
      const id = newId();
      const now = Date.now();
      // Sonraki bölümleri kaydırma, ekleme ve şarkının zamanı tek seferde yazılır
      await batch(db, [
        ...existing.slice(at).map((s, k) => ({ sql: "UPDATE sections SET position = $1 WHERE id = $2", values: [at + k + 1, s.id] })),
        {
          sql: "INSERT INTO sections (id, song_id, kind, label, content, position, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
          values: [id, songId, fields.kind, fields.label, fields.content, at, now, now],
        },
        touchStmt(songId, now),
      ]);
      return getSection(id);
    },

    async updateSection(id, patch) {
      const now = Date.now();
      const cols: Record<keyof typeof patch, string> = { kind: "kind", label: "label", content: "content" };
      const keys = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => k in cols);
      const sets = keys.map((k, i) => `${cols[k]} = $${i + 1}`);
      const values: unknown[] = keys.map((k) => patch[k]);
      sets.push(`updated_at = $${values.length + 1}`);
      values.push(now, id);
      await db.execute(`UPDATE sections SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
      const section = await getSection(id);
      await touchSong(section.songId, now);
      return section;
    },

    async deleteSection(id) {
      const section = await getSection(id);
      const rest = (
        await db.select<SectionRow[]>("SELECT * FROM sections WHERE song_id = $1 ORDER BY position", [section.songId])
      ).filter((r) => r.id !== id);
      await batch(db, [
        { sql: "UPDATE recordings SET section_id = NULL WHERE section_id = $1", values: [id] },
        { sql: "DELETE FROM sections WHERE id = $1", values: [id] },
        ...rest.flatMap((r, i) => (r.position !== i ? [{ sql: "UPDATE sections SET position = $1 WHERE id = $2", values: [i, r.id] }] : [])),
        touchStmt(section.songId, Date.now()),
      ]);
    },

    async reorderSections(songId, orderedIds) {
      await batch(db, [
        ...orderedIds.map((sid, i) => ({ sql: "UPDATE sections SET position = $1 WHERE id = $2 AND song_id = $3", values: [i, sid, songId] })),
        touchStmt(songId, Date.now()),
      ]);
    },

    async listRecordings(songId) {
      const rows = await db.select<RecordingRow[]>(
        "SELECT * FROM recordings WHERE song_id = $1 ORDER BY created_at DESC",
        [songId],
      );
      return rows.map(toRecording);
    },

    async createRecording(f) {
      const id = newId();
      const now = Date.now();
      await db.execute(
        `INSERT INTO recordings (id, song_id, section_id, title, note, file_name, mime_type, duration_ms, size_bytes, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, f.songId, f.sectionId, f.title, f.note, f.fileName, f.mimeType, f.durationMs, f.sizeBytes, f.source, now],
      );
      await touchSong(f.songId, now);
      return getRecording(id);
    },

    async updateRecording(id, patch) {
      const cols: Record<keyof typeof patch, string> = { title: "title", note: "note", sectionId: "section_id" };
      const keys = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => k in cols);
      if (keys.length) {
        const sets = keys.map((k, i) => `${cols[k]} = $${i + 1}`);
        const values: unknown[] = keys.map((k) => patch[k]);
        values.push(id);
        await db.execute(`UPDATE recordings SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
      }
      return getRecording(id);
    },

    async deleteRecording(id) {
      await db.execute("DELETE FROM recordings WHERE id = $1", [id]);
    },

    async listVersions(songId) {
      const rows = await db.select<VersionRow[]>("SELECT * FROM versions WHERE song_id = $1 ORDER BY created_at DESC", [songId]);
      return rows.map(toVersion);
    },

    async createVersion(f) {
      const id = newId();
      const now = Date.now();
      await db.execute(
        `INSERT INTO versions (id, song_id, name, note, stage, snapshot, recording_ids, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, f.songId, f.name, f.note, f.stage, JSON.stringify(f.snapshot), JSON.stringify(f.recordingIds), now],
      );
      await touchSong(f.songId, now);
      return getVersion(id);
    },

    async updateVersion(id, patch) {
      const sets: string[] = [];
      const values: unknown[] = [];
      const add = (col: string, v: unknown) => {
        values.push(v);
        sets.push(`${col} = $${values.length}`);
      };
      if (patch.name !== undefined) add("name", patch.name);
      if (patch.note !== undefined) add("note", patch.note);
      if (patch.stage !== undefined) add("stage", patch.stage);
      if (patch.recordingIds !== undefined) add("recording_ids", JSON.stringify(patch.recordingIds));
      if (sets.length) {
        values.push(id);
        await db.execute(`UPDATE versions SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
      }
      return getVersion(id);
    },

    async deleteVersion(id) {
      await db.execute("DELETE FROM versions WHERE id = $1", [id]);
    },

    async replaceSections(songId, sections) {
      // Aynı sıradaki bölümler yerinde güncellenir ki kayıtların bölüm bağlantıları korunsun
      const old = await db.select<SectionRow[]>("SELECT * FROM sections WHERE song_id = $1 ORDER BY position", [songId]);
      const now = Date.now();
      const stmts: Statement[] = sections.map((s, i) =>
        old[i]
          ? {
              sql: "UPDATE sections SET kind = $1, label = $2, content = $3, position = $4, updated_at = $5 WHERE id = $6",
              values: [s.kind, s.label, s.content, i, now, old[i].id],
            }
          : {
              sql: "INSERT INTO sections (id, song_id, kind, label, content, position, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
              values: [newId(), songId, s.kind, s.label, s.content, i, now, now],
            },
      );
      for (const s of old.slice(sections.length)) {
        stmts.push({ sql: "UPDATE recordings SET section_id = NULL WHERE section_id = $1", values: [s.id] });
        stmts.push({ sql: "DELETE FROM sections WHERE id = $1", values: [s.id] });
      }
      stmts.push(touchStmt(songId, now));
      // Ya bütün bölümler versiyondaki hâline döner ya da hiçbiri değişmez
      await batch(db, stmts);
      const rows = await db.select<SectionRow[]>("SELECT * FROM sections WHERE song_id = $1 ORDER BY position", [songId]);
      return rows.map(toSection);
    },

    async lyricsIndex() {
      const rows = await db.select<{ song_id: string; content: string }[]>(
        "SELECT song_id, content FROM sections WHERE content <> '' ORDER BY song_id, position",
      );
      const index: Record<string, string> = {};
      for (const r of rows) index[r.song_id] = index[r.song_id] ? `${index[r.song_id]}\n${r.content}` : r.content;
      return index;
    },

    async importRecords(data) {
      // Yedeğin tamamı tek transaction'da eklenir: yarıda kalırsa defter yükleme öncesindeki hâlinde kalır
      const stmts: Statement[] = [];
      const ins = (sql: string, values: unknown[]) => stmts.push({ sql, values });
      for (const f of data.folders) {
        ins("INSERT OR IGNORE INTO folders (id, name, created_at) VALUES ($1, $2, $3)", [f.id, f.name, f.createdAt]);
      }
      const firstSong = stmts.length;
      for (const s of data.songs) {
        ins(
          `INSERT OR IGNORE INTO songs (id, title, writer, musical_key, tempo, time_signature, capo, status, notes, folder_id, tags, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [s.id, s.title, s.writer, s.musicalKey, s.tempo, s.timeSignature, normalizeCapo(s.capo), s.status, s.notes, s.folderId, JSON.stringify(s.tags), s.createdAt, s.updatedAt],
        );
      }
      for (const s of data.sections) {
        ins(
          `INSERT OR IGNORE INTO sections (id, song_id, kind, label, content, position, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [s.id, s.songId, s.kind, s.label, s.content, s.position, s.createdAt, s.updatedAt],
        );
      }
      for (const r of data.recordings) {
        ins(
          `INSERT OR IGNORE INTO recordings (id, song_id, section_id, title, note, file_name, mime_type, duration_ms, size_bytes, source, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [r.id, r.songId, r.sectionId, r.title, r.note, r.fileName, r.mimeType, r.durationMs, r.sizeBytes, r.source, r.createdAt],
        );
      }
      for (const v of data.versions) {
        ins(
          `INSERT OR IGNORE INTO versions (id, song_id, name, note, stage, snapshot, recording_ids, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [v.id, v.songId, v.name, v.note, v.stage, JSON.stringify(v.snapshot), JSON.stringify(v.recordingIds), v.createdAt],
        );
      }
      const affected = await batch(db, stmts);
      // Gerçekten eklenen (zaten var olmadığı için atlanmayan) şarkı sayısı
      return affected.slice(firstSong, firstSong + data.songs.length).reduce((a, b) => a + b, 0);
    },
  };

  async function getVersion(id: string): Promise<Version> {
    const rows = await db.select<VersionRow[]>("SELECT * FROM versions WHERE id = $1", [id]);
    if (!rows[0]) throw new Error(t().errors.versionNotFound);
    return toVersion(rows[0]);
  }

  async function getRecording(id: string): Promise<Recording> {
    const rows = await db.select<RecordingRow[]>("SELECT * FROM recordings WHERE id = $1", [id]);
    if (!rows[0]) throw new Error(t().errors.recordingNotFound);
    return toRecording(rows[0]);
  }

  async function getSection(id: string): Promise<Section> {
    const rows = await db.select<SectionRow[]>("SELECT * FROM sections WHERE id = $1", [id]);
    if (!rows[0]) throw new Error(t().errors.sectionNotFound);
    return toSection(rows[0]);
  }

  async function touchSong(songId: string, now: number) {
    await db.execute("UPDATE songs SET updated_at = $1 WHERE id = $2", [now, songId]);
  }

  function touchStmt(songId: string, now: number): Statement {
    return { sql: "UPDATE songs SET updated_at = $1 WHERE id = $2", values: [now, songId] };
  }
}
