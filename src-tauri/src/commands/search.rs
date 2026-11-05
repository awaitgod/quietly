use crate::db::{Database, FtsSearchResult};
use tauri::State;

#[tauri::command]
pub fn search_local_messages(
    db: State<'_, Database>,
    query: String,
    chat_id: Option<String>,
    account_prefix: Option<String>,
) -> Result<Vec<FtsSearchResult>, String> {
    db.search_fts_scoped(&query, chat_id.as_deref(), account_prefix.as_deref())
        .map_err(|e| e.to_string())
}
