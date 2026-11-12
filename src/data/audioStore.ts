import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./repo";

/**
 * Ses dosyalarının kendisini saklar.
 * Masaüstünde uygulama verisi klasöründeki "recordings" klasörü, tarayıcı önizlemesinde IndexedDB kullanılır.
 */
export interface AudioStore {
  save(fileName: string, data: Uint8Array): Promise<void>;
  load(fileName: string): Promise<Uint8Array>;
  remove(fileName: string): Promise<void>;
}

const tauriStore: AudioStore = {
  async save(fileName, data) {
    await invoke("save_recording", data, { headers: { "x-file-name": fileName } });
  },
  async load(fileName) {
    const buf = await invoke<ArrayBuffer>("read_recording", { name: fileName });
    return new Uint8Array(buf);
  },
  async remove(fileName) {
    await invoke("delete_recording", { name: fileName });
  },
};

const DB_NAME = "bestele-audio";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const browserStore: AudioStore = {
  async save(fileName, data) {
    await tx("readwrite", (s) => s.put(data, fileName));
  },
  async load(fileName) {
    const data = await tx<Uint8Array | undefined>("readonly", (s) => s.get(fileName));
    if (!data) throw new Error("Ses dosyası bulunamadı");
    return data;
  },
  async remove(fileName) {
    await tx("readwrite", (s) => s.delete(fileName));
  },
};

export function getAudioStore(): AudioStore {
  return isTauri() ? tauriStore : browserStore;
}

/** MIME türünden dosya uzantısı */
export function extensionFor(mime: string, fallbackName = ""): string {
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(fallbackName)?.[1];
  if (fromName) return fromName.toLowerCase();
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("flac")) return "flac";
  return "bin";
}
