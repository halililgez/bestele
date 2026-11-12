use std::{fs, path::PathBuf};

use tauri::{
    ipc::{InvokeBody, Request, Response},
    AppHandle, Manager,
};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            save_recording,
            read_recording,
            delete_recording
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
