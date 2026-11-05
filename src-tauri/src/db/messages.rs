use super::{Database, LocalMessage};
use rusqlite::{Result, params};

impl Database {
    pub fn upsert_message(&self, msg: &LocalMessage) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO messages (id, chat_id, sender_id, content, reply_to, created_at, status, pinned_at, is_favorite, reactions_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
                content = excluded.content,
                pinned_at = excluded.pinned_at,
                reactions_json = excluded.reactions_json,
                status = excluded.status",
            params![
                msg.id,
                msg.chat_id,
                msg.sender_id,
                msg.content,
                msg.reply_to,
                msg.created_at,
                msg.status.as_deref().unwrap_or("sent"),
                msg.pinned_at,
                msg.is_favorite.unwrap_or(false) as i32,
                msg.reactions_json,
            ],
        )?;
        Ok(())
    }

    pub fn get_messages(
        &self,
        chat_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<LocalMessage>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, chat_id, sender_id, content, reply_to, created_at, status, pinned_at, is_favorite, reactions_json
             FROM messages
             WHERE chat_id = ?1
             ORDER BY created_at ASC
             LIMIT ?2 OFFSET ?3",
        )?;

        let rows = stmt.query_map(params![chat_id, limit, offset], |row| {
            Ok(LocalMessage {
                id: row.get(0)?,
                chat_id: row.get(1)?,
                sender_id: row.get(2)?,
                content: row.get(3)?,
                reply_to: row.get(4)?,
                created_at: row.get(5)?,
                status: row.get(6)?,
                pinned_at: row.get(7)?,
                is_favorite: Some(row.get::<_, i32>(8)? != 0),
                reactions_json: row.get(9)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn delete_message(&self, chat_id: &str, message_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM messages WHERE chat_id = ?1 AND id = ?2",
            params![chat_id, message_id],
        )?;
        Ok(())
    }

    pub fn delete_chat_messages(&self, chat_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM messages WHERE chat_id = ?1", params![chat_id])?;
        Ok(())
    }
}
