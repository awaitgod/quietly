use crate::db::{Database, LocalMessage};
use tauri::State;

#[tauri::command]
pub fn save_local_message(db: State<'_, Database>, message: LocalMessage) -> Result<(), String> {
    db.upsert_message(&message).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_local_messages(
    db: State<'_, Database>,
    chat_id: String,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<LocalMessage>, String> {
    db.get_messages(&chat_id, limit.unwrap_or(200), offset.unwrap_or(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_local_chat(db: State<'_, Database>, chat_id: String) -> Result<(), String> {
    db.delete_chat_messages(&chat_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_local_message(
    db: State<'_, Database>,
    chat_id: String,
    message_id: String,
) -> Result<(), String> {
    db.delete_message(&chat_id, &message_id)
        .map_err(|e| e.to_string())
}
