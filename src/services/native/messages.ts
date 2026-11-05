import { invoke } from '@tauri-apps/api/core';
import type { Message } from '../../types';
import type { LocalMsgPayload, FtsResult } from './models';
import { isTauri } from './environment';
export async function tauriSaveMessage(msg: Message, chatId: string): Promise<void> {
    if (!isTauri())
        return;
    try {
        const payload: LocalMsgPayload = {
            id: String(msg.id),
            chat_id: chatId,
            sender_id: msg.sender_id,
            content: msg.content,
            reply_to: msg.reply_to ? String(msg.reply_to) : null,
            created_at: msg.created_at,
            status: msg.status || 'sent',
            pinned_at: msg.pinned_at || null,
            is_favorite: msg.is_favorite || false,
            reactions_json: msg.reactions ? JSON.stringify(msg.reactions) : null,
        };
        await invoke('save_local_message', { message: payload });
    }
    catch (err) {
        console.warn('[Tauri IPC] save_local_message error:', err);
    }
}
export async function tauriGetMessages(chatId: string, limit = 200, offset = 0): Promise<LocalMsgPayload[]> {
    if (!isTauri())
        return [];
    try {
        return await invoke<LocalMsgPayload[]>('get_local_messages', { chatId, limit, offset });
    }
    catch (err) {
        console.warn('[Tauri IPC] get_local_messages error:', err);
        return [];
    }
}
export async function tauriSearchFts(query: string, chatId?: string): Promise<FtsResult[]> {
    if (!isTauri())
        return [];
    try {
        return await invoke<FtsResult[]>('search_local_messages', { query, chatId: chatId || null });
    }
    catch (err) {
        console.warn('[Tauri IPC] search_local_messages error:', err);
        return [];
    }
}
export async function tauriClearChat(chatId: string): Promise<void> {
    if (!isTauri())
        return;
    try {
        await invoke('clear_local_chat', { chatId });
    }
    catch (err) {
        console.warn('[Tauri IPC] clear_local_chat error:', err);
    }
}
export async function tauriDeleteMessage(chatId: string, messageId: string | number): Promise<void> {
    if (!isTauri())
        return;
    await invoke('delete_local_message', { chatId, messageId: String(messageId) });
}
