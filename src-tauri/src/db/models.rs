use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalMessage {
    pub id: String,
    pub chat_id: String,
    pub sender_id: String,
    pub content: String,
    pub reply_to: Option<String>,
    pub created_at: String,
    pub status: Option<String>,
    pub pinned_at: Option<String>,
    pub is_favorite: Option<bool>,
    pub reactions_json: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FtsSearchResult {
    pub id: String,
    pub chat_id: String,
    pub sender_id: String,
    pub content: String,
    pub snippet: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalChat {
    pub id: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub is_group: bool,
    pub unread_count: u32,
    pub last_message_at: Option<String>,
    pub last_message_snippet: Option<String>,
}
