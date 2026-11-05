use crate::db::{Database, FtsSearchResult};
use tauri::State;

#[tauri::command]
pub fn search_local_messages(
    db: State<'_, Database>,
    query: String,
    chat_id: Option<String>,
) -> Result<Vec<FtsSearchResult>, String> {
    db.search_fts(&query, chat_id.as_deref())
        .map_err(|e| e.to_string())
}
