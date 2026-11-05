export interface LocalMsgPayload {
    id: string;
    chat_id: string;
    sender_id: string;
    content: string;
    reply_to?: string | null;
    created_at: string;
    status?: string | null;
    pinned_at?: string | null;
    is_favorite?: boolean | null;
    reactions_json?: string | null;
}
export interface FtsResult {
    id: string;
    chat_id: string;
    sender_id: string;
    content: string;
    snippet: string;
}
