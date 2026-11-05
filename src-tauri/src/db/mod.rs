use rusqlite::{Connection, Result};
mod messages;
mod models;
mod preferences;
mod schema;
mod search;
pub use models::{FtsSearchResult, LocalChat, LocalMessage};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn message_search_tracks_updates_and_deletion() {
        let db = Database::new(":memory:".into()).unwrap();
        let mut message = LocalMessage {
            id: "1".into(),
            chat_id: "chat".into(),
            sender_id: "sender".into(),
            content: "first message".into(),
            reply_to: None,
            created_at: "2026-01-01".into(),
            status: None,
            pinned_at: None,
            is_favorite: None,
            reactions_json: None,
        };
        db.upsert_message(&message).unwrap();
        assert_eq!(db.get_messages("chat", 10, 0).unwrap().len(), 1);
        assert_eq!(db.search_fts("first", Some("chat")).unwrap().len(), 1);
        message.content = "second message".into();
        db.upsert_message(&message).unwrap();
        assert!(db.search_fts("first", Some("chat")).unwrap().is_empty());
        assert_eq!(db.search_fts("second", Some("chat")).unwrap().len(), 1);
        db.delete_message("chat", "1").unwrap();
        assert!(db.search_fts("second", Some("chat")).unwrap().is_empty());
    }

    #[test]
    fn key_value_round_trip() {
        let db = Database::new(":memory:".into()).unwrap();
        db.set_kv("key", "value").unwrap();
        assert_eq!(db.get_kv("key").unwrap().as_deref(), Some("value"));
        db.delete_kv("key").unwrap();
        assert_eq!(db.get_kv("key").unwrap(), None);
    }
}
