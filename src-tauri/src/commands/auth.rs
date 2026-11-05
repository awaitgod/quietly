use crate::db::Database;
use tauri::State;

#[tauri::command]
pub fn save_session_token(db: State<'_, Database>, token: String) -> Result<(), String> {
    db.set_kv("session_token", &token)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_session_token(db: State<'_, Database>) -> Result<Option<String>, String> {
    db.get_kv("session_token").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_session_token(db: State<'_, Database>) -> Result<(), String> {
    db.delete_kv("session_token").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_secure_pref(db: State<'_, Database>, key: String, value: String) -> Result<(), String> {
    db.set_kv(&format!("pref_{}", key), &value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_secure_pref(db: State<'_, Database>, key: String) -> Result<Option<String>, String> {
    db.get_kv(&format!("pref_{}", key))
        .map_err(|e| e.to_string())
}
