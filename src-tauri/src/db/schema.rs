use super::Database;
use rusqlite::Result;

impl Database {
    pub(super) fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 1. Messages table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                sender_id TEXT NOT NULL,
                content TEXT NOT NULL,
                reply_to TEXT,
                created_at TEXT NOT NULL,
                status TEXT DEFAULT 'sent',
                pinned_at TEXT,
                is_favorite INTEGER DEFAULT 0,
                reactions_json TEXT
            )",
            [],
        )?;

        // 2. Index on chat_id and created_at
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages (chat_id, created_at)",
            [],
        )?;

        // 3. FTS5 table for lightning-fast sub-millisecond full-text search
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
                id UNINDEXED,
                chat_id UNINDEXED,
                sender_id UNINDEXED,
                content
            )",
            [],
        )?;

        // 4. Triggers to keep FTS in sync
        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS trg_msg_ai AFTER INSERT ON messages BEGIN
                INSERT INTO messages_fts(id, chat_id, sender_id, content)
                VALUES (new.id, new.chat_id, new.sender_id, new.content);
            END",
            [],
        )?;

        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS trg_msg_ad AFTER DELETE ON messages BEGIN
                DELETE FROM messages_fts WHERE id = old.id;
            END",
            [],
        )?;

        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS trg_msg_au AFTER UPDATE ON messages BEGIN
                DELETE FROM messages_fts WHERE id = old.id;
                INSERT INTO messages_fts(id, chat_id, sender_id, content)
                VALUES (new.id, new.chat_id, new.sender_id, new.content);
            END",
            [],
        )?;

        // 5. Chats table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                avatar_url TEXT,
                is_group INTEGER DEFAULT 0,
                unread_count INTEGER DEFAULT 0,
                last_message_at TEXT,
                last_message_snippet TEXT
            )",
            [],
        )?;

        // 6. Key-Value Storage (Token, offline secrets, credentials)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS kv_store (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        Ok(())
    }
}
