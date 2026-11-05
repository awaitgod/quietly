use super::{Database, FtsSearchResult};
use rusqlite::{Result, params};

impl Database {
    pub fn search_fts(&self, query: &str, chat_id: Option<&str>) -> Result<Vec<FtsSearchResult>> {
        let conn = self.conn.lock().unwrap();
        let mut results = Vec::new();

        // Sanitize search query for FTS5
        let sanitized = query.replace('"', "\"\"").replace('*', "");
        let fts_query = format!("\"{}\"*", sanitized);

        if let Some(cid) = chat_id {
            let mut stmt = conn.prepare(
                "SELECT id, chat_id, sender_id, content, snippet(messages_fts, 3, '<mark>', '</mark>', '...', 15)
                 FROM messages_fts
                 WHERE messages_fts MATCH ?1 AND chat_id = ?2
                 ORDER BY rank
                 LIMIT 50",
            )?;
            let rows = stmt.query_map(params![fts_query, cid], |row| {
                Ok(FtsSearchResult {
                    id: row.get(0)?,
                    chat_id: row.get(1)?,
                    sender_id: row.get(2)?,
                    content: row.get(3)?,
                    snippet: row.get(4)?,
                })
            })?;
            for r in rows {
                results.push(r?);
            }
        } else {
            let mut stmt = conn.prepare(
                "SELECT id, chat_id, sender_id, content, snippet(messages_fts, 3, '<mark>', '</mark>', '...', 15)
                 FROM messages_fts
                 WHERE messages_fts MATCH ?1
                 ORDER BY rank
                 LIMIT 50",
            )?;
            let rows = stmt.query_map(params![fts_query], |row| {
                Ok(FtsSearchResult {
                    id: row.get(0)?,
                    chat_id: row.get(1)?,
                    sender_id: row.get(2)?,
                    content: row.get(3)?,
                    snippet: row.get(4)?,
                })
            })?;
            for r in rows {
                results.push(r?);
            }
        }

        Ok(results)
    }
}
