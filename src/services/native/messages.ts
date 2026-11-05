import { invoke } from '@tauri-apps/api/core';
import type { Message } from '../../types';
import type { LocalMsgPayload, FtsResult } from './models';
import { isTauri } from './environment';
let cacheAccount: string | null = null;
export function setLocalCacheAccount(id: string | null): void { cacheAccount = id; }
function prefix(): string | null { return cacheAccount ? `${cacheAccount}:` : null; }
function unpack(value: string, namespace: string): string { return value.startsWith(namespace) ? value.slice(namespace.length) : value; }
export async function tauriSaveMessage(msg: Message, chatId: string): Promise<void> {
    const namespace = prefix();
    if (!isTauri() || !namespace)
        return;
    try {
        const payload: LocalMsgPayload = {
            id: namespace + String(msg.id),
            chat_id: namespace + chatId,
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
    const namespace = prefix();
    if (!isTauri() || !namespace)
        return [];
    try {
        const messages = await invoke<LocalMsgPayload[]>('get_local_messages', { chatId: namespace + chatId, limit, offset });
        return messages.map(message => ({ ...message, id: unpack(message.id, namespace), chat_id: unpack(message.chat_id, namespace) }));
    }
    catch (err) {
        console.warn('[Tauri IPC] get_local_messages error:', err);
        return [];
    }
}
export async function tauriSearchFts(query: string, chatId?: string): Promise<FtsResult[]> {
    const namespace = prefix();
    if (!isTauri() || !namespace)
        return [];
    try {
        const results = await invoke<FtsResult[]>('search_local_messages', { query, chatId: chatId ? namespace + chatId : null, accountPrefix: namespace });
        return results.map(result => ({ ...result, id: unpack(result.id, namespace), chat_id: unpack(result.chat_id, namespace) }));
    }
    catch (err) {
        console.warn('[Tauri IPC] search_local_messages error:', err);
        return [];
    }
}
export async function tauriClearChat(chatId: string): Promise<void> {
    const namespace = prefix();
    if (!isTauri() || !namespace)
        return;
    try {
        await invoke('clear_local_chat', { chatId: namespace + chatId });
    }
    catch (err) {
        console.warn('[Tauri IPC] clear_local_chat error:', err);
    }
}
export async function tauriDeleteMessage(chatId: string, messageId: string | number): Promise<void> {
    const namespace = prefix();
    if (!isTauri() || !namespace)
        return;
    await invoke('delete_local_message', { chatId: namespace + chatId, messageId: namespace + String(messageId) });
}
