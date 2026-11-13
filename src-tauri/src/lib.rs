use std::{fs, path::PathBuf, sync::Mutex};

use serde::Deserialize;
use serde_json::Value as JsonValue;
use sqlx::Executor;
use tauri::{
    ipc::{InvokeBody, Request, Response},
    AppHandle, Manager, State,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_sql::{DbInstances, DbPool};

/// Ses kayıtlarının tutulduğu klasör: <uygulama verisi>/recordings
fn recordings_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Yalnızca "uuid.uzantı" biçimindeki güvenli dosya adlarına izin verir.
fn safe_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let ok = !name.is_empty()
        && name.len() <= 100
        && !name.contains("..")
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.');
    if !ok {
        return Err(format!("geçersiz dosya adı: {name}"));
    }
    Ok(recordings_dir(app)?.join(name))
}

#[tauri::command]
async fn save_recording(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .ok_or("dosya adı eksik")?
        .to_string();
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("ses verisi bekleniyordu".into());
    };
    fs::write(safe_path(&app, &name)?, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
async fn read_recording(app: AppHandle, name: String) -> Result<Response, String> {
    let bytes = fs::read(safe_path(&app, &name)?).map_err(|e| e.to_string())?;
    Ok(Response::new(bytes))
}

#[tauri::command]
async fn delete_recording(app: AppHandle, name: String) -> Result<(), String> {
    let path = safe_path(&app, &name)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Deserialize)]
struct Statement {
    sql: String,
    #[serde(default)]
    values: Vec<JsonValue>,
}

/// Birden çok yazma komutunu tek bir transaction içinde çalıştırır: ya hepsi yazılır ya hiçbiri.
/// tauri-plugin-sql bağlantı havuzu kullandığı için BEGIN/COMMIT'i ayrı çağrılarla göndermek güvenli değildir;
/// burada transaction tek bir bağlantıda açılır ve hata olursa otomatik geri alınır.
#[tauri::command]
async fn sql_batch(
    instances: State<'_, DbInstances>,
    db: String,
    statements: Vec<Statement>,
) -> Result<Vec<u64>, String> {
    let pools = instances.0.read().await;
    let DbPool::Sqlite(pool) = pools.get(&db).ok_or("veritabanı açık değil")?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let mut affected = Vec::with_capacity(statements.len());
    for st in &statements {
        let mut query = sqlx::query(&st.sql);
        for value in &st.values {
            query = match value {
                JsonValue::Null => query.bind(None::<String>),
                JsonValue::Bool(b) => query.bind(*b),
                JsonValue::String(s) => query.bind(s.clone()),
                JsonValue::Number(n) => match n.as_i64() {
                    Some(i) => query.bind(i),
                    None => query.bind(n.as_f64().unwrap_or_default()),
                },
                other => query.bind(other.to_string()),
            };
        }
        let result = tx.execute(query).await.map_err(|e| e.to_string())?;
        affected.push(result.rows_affected());
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(affected)
}

/// Kullanıcının "Farklı kaydet" penceresinde seçtiği, henüz yazılmamış dosya yolu.
/// Yol JavaScript'e hiç verilmez; yalnızca kullanıcının seçtiği yere yazılabilir.
#[derive(Default)]
struct PendingExport(Mutex<Option<PathBuf>>);

/// "Farklı kaydet" penceresini açar. Kullanıcı vazgeçerse `None` döner.
#[tauri::command]
async fn pick_export_path(
    app: AppHandle,
    pending: State<'_, PendingExport>,
    file_name: String,
    filter_name: String,
    extension: String,
) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_file_name(&file_name)
        .add_filter(&filter_name, &[extension.as_str()])
        .blocking_save_file();
    let path = match picked {
        Some(p) => p.into_path().map_err(|e| e.to_string())?,
        None => return Ok(None),
    };
    let shown = path.display().to_string();
    *pending.0.lock().map_err(|e| e.to_string())? = Some(path);
    Ok(Some(shown))
}

/// Seçilen yola dosyanın içeriğini (ham bayt olarak) yazar.
#[tauri::command]
async fn write_export(pending: State<'_, PendingExport>, request: Request<'_>) -> Result<(), String> {
    let path = pending
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or("kaydedilecek yer seçilmedi")?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("dosya içeriği bekleniyordu".into());
    };
    fs::write(path, bytes).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(PendingExport::default())
        .invoke_handler(tauri::generate_handler![
            save_recording,
            read_recording,
            delete_recording,
            sql_batch,
            pick_export_path,
            write_export
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
