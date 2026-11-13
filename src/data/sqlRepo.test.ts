/**
 * Masaüstündeki SQLite deposunu gerçek bir SQLite üzerinde (node:sqlite, bellekte) çalıştırır.
 * tauri-plugin-sql yalnızca uygulama içinde çalıştığı için onun yerine aynı arayüzü sunan küçük bir adaptör kullanılır.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { emptySong } from "../types";

let current: DatabaseSync;

/** tauri-plugin-sql'in `$1, $2…` yer tutucularını SQLite'ın konumsal bağlamasıyla eşler. */
function bindValues(values: unknown[]) {
  // "$1" → values[0] … (node:sqlite adlandırılmış parametreleri nesneyle bağlar)
  return [Object.fromEntries(values.map((v, i) => [`$${i + 1}`, v === undefined ? null : v]))] as never[];
}

/** Rust'taki `sql_batch` komutunun karşılığı: hepsi tek transaction'da, hata olursa geri alınır. */
let failBatchAt: string | null = null;
function fakeInvoke(cmd: string, args: { statements: { sql: string; values: unknown[] }[] }) {
  if (cmd !== "sql_batch") throw new Error(`beklenmeyen komut: ${cmd}`);
  current.exec("BEGIN");
  try {
    const affected = args.statements.map(({ sql, values }) => {
      if (failBatchAt && sql.includes(failBatchAt)) throw new Error("yapay hata");
      const st = current.prepare(sql);
      return Number((values.length ? st.run(...bindValues(values)) : st.run()).changes);
    });
    current.exec("COMMIT");
    return Promise.resolve(affected);
  } catch (e) {
    current.exec("ROLLBACK");
    return Promise.reject(e);
  }
}

vi.mock("@tauri-apps/api/core", () => ({ invoke: fakeInvoke }));

class FakeDatabase {
  path = "sqlite:bestele.db";
  constructor(private db: DatabaseSync) {}
  static async load() {
    return new FakeDatabase(current);
  }
  private bind(values: unknown[]) {
    // "$1" → values[0] … (node:sqlite adlandırılmış parametreleri nesneyle bağlar)
    return [Object.fromEntries(values.map((v, i) => [`$${i + 1}`, v === undefined ? null : v]))] as never[];
  }
  async execute(sql: string, values: unknown[] = []) {
    const st = this.db.prepare(sql);
    const r = values.length ? st.run(...this.bind(values)) : st.run();
    return { rowsAffected: Number(r.changes), lastInsertId: Number(r.lastInsertRowid) };
  }
  async select<T>(sql: string, values: unknown[] = []): Promise<T> {
    const st = this.db.prepare(sql);
    return (values.length ? st.all(...this.bind(values)) : st.all()) as T;
  }
}

vi.mock("@tauri-apps/plugin-sql", () => ({ default: FakeDatabase }));

const { createSqlRepo } = await import("./sqlRepo");

beforeEach(() => {
  current = new DatabaseSync(":memory:");
});

describe("SQLite deposu", () => {
  it("migration'ları çalıştırır ve sürümü yazar", async () => {
    await createSqlRepo();
    const v = current.prepare("PRAGMA user_version").get() as { user_version: number };
    expect(v.user_version).toBe(5);
    const tables = (current.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]).map(
      (t) => t.name,
    );
    expect(tables).toEqual(["folders", "recordings", "sections", "songs", "versions"]);
    // İkinci açılışta migration tekrar çalışmamalı
    await createSqlRepo();
  });

  it("migration 5: eski şarkılara capo = 0 eklenir", async () => {
    // Faz 8 sonundaki (user_version 4) bir veritabanını taklit et
    current.exec(`CREATE TABLE songs (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, writer TEXT NOT NULL DEFAULT '', musical_key TEXT NOT NULL DEFAULT '',
      tempo INTEGER, time_signature TEXT NOT NULL DEFAULT '4/4', status TEXT NOT NULL DEFAULT 'fikir',
      notes TEXT NOT NULL DEFAULT '', folder_id TEXT, tags TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      INSERT INTO songs (id, title, created_at, updated_at) VALUES ('eski', 'Eski şarkı', 1, 1);
      PRAGMA user_version = 4;`);
    const repo = await createSqlRepo();
    const [old] = await repo.listSongs();
    expect(old.capo).toBe(0);
    expect((await repo.updateSong("eski", { capo: 3 })).capo).toBe(3);
    expect((await repo.updateSong("eski", { capo: 42 })).capo).toBe(9);
  });

  it("capo: oluşturma, güncelleme ve yedekten içe aktarma", async () => {
    const repo = await createSqlRepo();
    const song = await repo.createSong({ ...emptySong("Capolu"), capo: 2 });
    expect(song.capo).toBe(2);
    expect((await repo.updateSong(song.id, { capo: 0 })).capo).toBe(0);
    // Capo alanı olmayan eski bir yedek
    const { capo: _ignored, ...legacy } = { ...song, id: "eski-yedek" };
    void _ignored;
    const data = { folders: [], songs: [legacy as typeof song], sections: [], recordings: [], versions: [] };
    expect(await repo.importRecords(data)).toBe(1);
    expect((await repo.listSongs()).find((s) => s.id === "eski-yedek")?.capo).toBe(0);
  });

  it("şarkı ve klasör işlemleri", async () => {
    const repo = await createSqlRepo();
    const folder = await repo.createFolder("Albüm");
    const song = await repo.createSong({ ...emptySong("Gece"), tags: ["akustik", "aşk"], folderId: folder.id, tempo: 92 });
    expect(song.tags).toEqual(["akustik", "aşk"]);
    expect(song.tempo).toBe(92);

    const updated = await repo.updateSong(song.id, { title: "Gece Treni", musicalKey: "Am", tempo: null });
    expect(updated.title).toBe("Gece Treni");
    expect(updated.musicalKey).toBe("Am");
    expect(updated.tempo).toBeNull();
    expect(updated.updatedAt).toBeGreaterThanOrEqual(song.updatedAt);

    await repo.renameFolder(folder.id, "İlk albüm");
    expect((await repo.listFolders())[0].name).toBe("İlk albüm");

    await repo.deleteFolder(folder.id);
    expect((await repo.listSongs())[0].folderId).toBeNull();
  });

  it("bölümler: ekleme, araya ekleme, sıralama, silme", async () => {
    const repo = await createSqlRepo();
    const song = await repo.createSong(emptySong("Şarkı"));
    const a = await repo.createSection(song.id, { kind: "kita", label: "", content: "[Am]a" });
    const c = await repo.createSection(song.id, { kind: "nakarat", label: "", content: "c" });
    const b = await repo.createSection(song.id, { kind: "kopru", label: "", content: "b" }, 1);
    expect((await repo.listSections(song.id)).map((s) => s.id)).toEqual([a.id, b.id, c.id]);

    const upd = await repo.updateSection(b.id, { content: "[F]b2", label: "Köprü!" });
    expect(upd.content).toBe("[F]b2");
    expect(upd.label).toBe("Köprü!");

    await repo.reorderSections(song.id, [c.id, a.id, b.id]);
    expect((await repo.listSections(song.id)).map((s) => s.id)).toEqual([c.id, a.id, b.id]);

    await repo.deleteSection(a.id);
    const rest = await repo.listSections(song.id);
    expect(rest.map((s) => [s.id, s.position])).toEqual([
      [c.id, 0],
      [b.id, 1],
    ]);

    expect(await repo.lyricsIndex()).toEqual({ [song.id]: "c\n[F]b2" });
  });

  it("kayıtlar: bölüm silinince bağlantı kalkar", async () => {
    const repo = await createSqlRepo();
    const song = await repo.createSong(emptySong("Şarkı"));
    const sec = await repo.createSection(song.id, { kind: "kita", label: "", content: "" });
    const rec = await repo.createRecording({
      songId: song.id,
      sectionId: sec.id,
      title: "Deneme",
      note: "",
      fileName: "x.webm",
      mimeType: "audio/webm",
      durationMs: 1500,
      sizeBytes: 1000,
      source: "kayit",
    });
    expect(rec.durationMs).toBe(1500);
    expect((await repo.updateRecording(rec.id, { title: "Riff", note: "gitar" })).title).toBe("Riff");
    await repo.deleteSection(sec.id);
    expect((await repo.listRecordings(song.id))[0].sectionId).toBeNull();
    await repo.deleteRecording(rec.id);
    expect(await repo.listRecordings(song.id)).toEqual([]);
  });

  it("versiyonlar ve geri dönme (bölüm kimlikleri korunur)", async () => {
    const repo = await createSqlRepo();
    const song = await repo.createSong(emptySong("Şarkı"));
    const s1 = await repo.createSection(song.id, { kind: "kita", label: "", content: "eski" });
    const s2 = await repo.createSection(song.id, { kind: "nakarat", label: "", content: "nakarat" });
    const v = await repo.createVersion({
      songId: song.id,
      name: "İlk",
      note: "",
      stage: "taslak",
      recordingIds: ["r1"],
      snapshot: { title: "Şarkı", musicalKey: "Am", tempo: 90, timeSignature: "4/4", sections: [{ kind: "kita", label: "", content: "eski" }] },
    });
    expect(v.snapshot.sections).toHaveLength(1);
    expect(v.recordingIds).toEqual(["r1"]);
    expect((await repo.updateVersion(v.id, { name: "İlk taslak", recordingIds: [] })).recordingIds).toEqual([]);

    await repo.updateSection(s1.id, { content: "yeni" });
    const restored = await repo.replaceSections(song.id, v.snapshot.sections);
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(s1.id);
    expect(restored[0].content).toBe("eski");
    expect((await repo.listSections(song.id)).some((s) => s.id === s2.id)).toBe(false);

    await repo.deleteVersion(v.id);
    expect(await repo.listVersions(song.id)).toEqual([]);
  });

  it("şarkı silinince bağlı her şey silinir", async () => {
    const repo = await createSqlRepo();
    const song = await repo.createSong(emptySong("Şarkı"));
    await repo.createSection(song.id, { kind: "kita", label: "", content: "x" });
    await repo.createVersion({
      songId: song.id,
      name: "v",
      note: "",
      stage: "fikir",
      recordingIds: [],
      snapshot: { title: "", musicalKey: "", tempo: null, timeSignature: "4/4", sections: [] },
    });
    await repo.deleteSong(song.id);
    for (const t of ["songs", "sections", "versions", "recordings"]) {
      expect((current.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n).toBe(0);
    }
  });

  it("yedekten içe aktarma var olanları atlar", async () => {
    const repo = await createSqlRepo();
    const song = await repo.createSong(emptySong("Var olan"));
    const data = {
      folders: [],
      songs: [song, { ...song, id: "yeni-1", title: "Yeni" }],
      sections: [{ id: "sec-1", songId: "yeni-1", kind: "kita" as const, label: "", content: "x", position: 0, createdAt: 1, updatedAt: 1 }],
      recordings: [],
      versions: [],
    };
    expect(await repo.importRecords(data)).toBe(1);
    expect((await repo.listSongs()).map((s) => s.title).sort()).toEqual(["Var olan", "Yeni"]);
    expect(await repo.listSections("yeni-1")).toHaveLength(1);
    expect(await repo.importRecords(data)).toBe(0);
  });

  it("yarıda kalan migration geri alınır, sonraki açılışta temiz çalışır", async () => {
    failBatchAt = "ALTER TABLE songs ADD COLUMN capo";
    await expect(createSqlRepo()).rejects.toThrow();
    const v = current.prepare("PRAGMA user_version").get() as { user_version: number };
    expect(v.user_version).toBe(4);
    failBatchAt = null;
    await createSqlRepo();
    expect((current.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(5);
  });

  it("çok adımlı yazmalar bölünmez: hata olursa hiçbiri yazılmaz", async () => {
    const repo = await createSqlRepo();
    const song = await repo.createSong(emptySong("Bütün"));
    await repo.createSection(song.id, { kind: "kita", label: "", content: "eski 1" });
    await repo.createSection(song.id, { kind: "nakarat", label: "", content: "eski 2" });

    // Versiyona dönme: sona doğru bir adım başarısız olursa ilk bölümler de değişmemeli
    failBatchAt = "DELETE FROM sections";
    await expect(repo.replaceSections(song.id, [{ kind: "kita", label: "", content: "yeni" }])).rejects.toThrow();
    expect((await repo.listSections(song.id)).map((s) => s.content)).toEqual(["eski 1", "eski 2"]);

    // Şarkı silme yarıda kalırsa bölümleri de yerinde kalmalı
    failBatchAt = "DELETE FROM songs";
    await expect(repo.deleteSong(song.id)).rejects.toThrow();
    expect(await repo.listSections(song.id)).toHaveLength(2);

    // Yedek yükleme yarıda kalırsa hiçbir şarkı eklenmemeli
    failBatchAt = "INSERT OR IGNORE INTO versions";
    const data = {
      folders: [],
      songs: [{ ...song, id: "yedek-1" }],
      sections: [],
      recordings: [],
      versions: [{ id: "v1", songId: "yedek-1", name: "", note: "", stage: "fikir" as const, recordingIds: [], createdAt: 1,
        snapshot: { title: "", musicalKey: "", tempo: null, timeSignature: "4/4", sections: [] } }],
    };
    await expect(repo.importRecords(data)).rejects.toThrow();
    expect(await repo.listSongs()).toHaveLength(1);
  });
});
