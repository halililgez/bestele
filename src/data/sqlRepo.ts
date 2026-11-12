import Database from "@tauri-apps/plugin-sql";
import type { Folder, Song, SongFields, SongStatus } from "../types";
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
];

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
  };
}
