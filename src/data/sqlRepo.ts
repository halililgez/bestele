import Database from "@tauri-apps/plugin-sql";
import type { Folder, Section, SectionKind, Song, SongFields, SongStatus } from "../types";
import { newId, type Repo } from "./repo";

interface SongRow {
  id: string;
  title: string;
  writer: string;
  musical_key: string;
  tempo: number | null;
  time_signature: string;
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
];

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

async function migrate(db: Database) {
  const rows = await db.select<{ user_version: number }[]>("PRAGMA user_version");
  let version = rows[0]?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    for (const stmt of MIGRATIONS[version].split(";").map((s) => s.trim()).filter(Boolean)) {
      await db.execute(stmt);
    }
    version += 1;
    await db.execute(`PRAGMA user_version = ${version}`);
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
  status: "status",
  notes: "notes",
  folderId: "folder_id",
  tags: "tags",
};

function toDbValue(key: keyof SongFields, value: unknown) {
  return key === "tags" ? JSON.stringify(value ?? []) : value;
}

export async function createSqlRepo(): Promise<Repo> {
  const db = await Database.load("sqlite:bestele.db");
  await db.execute("PRAGMA foreign_keys = ON");
  await migrate(db);

  async function getSong(id: string): Promise<Song> {
    const rows = await db.select<SongRow[]>("SELECT * FROM songs WHERE id = $1", [id]);
    if (!rows[0]) throw new Error("Şarkı bulunamadı");
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
      await db.execute("DELETE FROM sections WHERE song_id = $1", [id]);
      await db.execute("DELETE FROM songs WHERE id = $1", [id]);
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
      await db.execute("UPDATE songs SET folder_id = NULL WHERE folder_id = $1", [id]);
      await db.execute("DELETE FROM folders WHERE id = $1", [id]);
    },

    async listSections(songId) {
      const rows = await db.select<SectionRow[]>("SELECT * FROM sections WHERE song_id = $1 ORDER BY position", [songId]);
      return rows.map(toSection);
    },

    async createSection(songId, fields, index) {
      const existing = await db.select<SectionRow[]>("SELECT * FROM sections WHERE song_id = $1 ORDER BY position", [songId]);
      const at = index === undefined ? existing.length : Math.max(0, Math.min(index, existing.length));
      // Araya ekleniyorsa sonrakileri bir kaydır
      for (let i = existing.length - 1; i >= at; i--) {
        await db.execute("UPDATE sections SET position = $1 WHERE id = $2", [i + 1, existing[i].id]);
      }
      const id = newId();
      const now = Date.now();
      await db.execute(
        "INSERT INTO sections (id, song_id, kind, label, content, position, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [id, songId, fields.kind, fields.label, fields.content, at, now, now],
      );
      await touchSong(songId, now);
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
      await db.execute("DELETE FROM sections WHERE id = $1", [id]);
      const rest = await db.select<SectionRow[]>("SELECT * FROM sections WHERE song_id = $1 ORDER BY position", [section.songId]);
      for (let i = 0; i < rest.length; i++) {
        if (rest[i].position !== i) await db.execute("UPDATE sections SET position = $1 WHERE id = $2", [i, rest[i].id]);
      }
      await touchSong(section.songId, Date.now());
    },

    async reorderSections(songId, orderedIds) {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.execute("UPDATE sections SET position = $1 WHERE id = $2 AND song_id = $3", [i, orderedIds[i], songId]);
      }
      await touchSong(songId, Date.now());
    },
  };

  async function getSection(id: string): Promise<Section> {
    const rows = await db.select<SectionRow[]>("SELECT * FROM sections WHERE id = $1", [id]);
    if (!rows[0]) throw new Error("Bölüm bulunamadı");
    return toSection(rows[0]);
  }

  async function touchSong(songId: string, now: number) {
    await db.execute("UPDATE songs SET updated_at = $1 WHERE id = $2", [now, songId]);
  }
}
