import { useEconomyStore } from './economy';
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { supabase, FAV_ID, FAV_PROFILE, tablesApi, rpcApi, realtimeApi } from '../services/supabase';
import { tauriSaveMessage, tauriGetMessages, tauriNotify } from '../services/tauriIpc';
import type { Message, UserProfile } from '../types';
import { useAuthStore } from './auth';
import { usePresenceStore } from './presence';
export interface ConversationItem {
    id: string;
    profile: UserProfile;
    lastMessage?: Message | null;
    unreadCount: number;
    isGroup?: boolean;
}
export const useChatStore = defineStore('chat', () => {
    const authStore = useAuthStore();
    const presenceStore = usePresenceStore();
    const conversations = ref<Map<string, ConversationItem>>(new Map());
    const conversationsLoaded = ref(false);
    const conversationsLoadFailed = ref(false);
    const activeChat = ref<UserProfile | null>(null);
    const messages = ref<Message[]>([]);
    const isMessagesLoading = ref(false);
    const typingUsers = ref<Map<string, string>>(new Map());
    const replyContext = ref<Message | null>(null);
    const editContext = ref<Message | null>(null);
    const selectedMessageIds = ref<Set<string | number>>(new Set());
    const isSelectionMode = ref(false);
    const archivedChatIds = ref<Set<string>>(new Set());
    const isArchiveView = ref(false);
    const pinnedMessages = ref<Message[]>([]);
    const activePinIndex = ref(0);
    const searchQuery = ref('');
    const isSearchOpen = ref(false);
    const newlyAddedId = ref<string | number | null>(null);
    let globalMessageChannel: any = null;
    let favoritesChannel: any = null;
    let pairPresenceChannel: any = null;
    let typingInboxChannel: any = null;
    let meLiveChannel: any = null;
    let typingTimeout: any = null;
    const totalUnreadCount = computed(() => {
        let count = 0;
        conversations.value.forEach((item) => {
            if (!archivedChatIds.value.has(item.id)) {
                count += item.unreadCount || 0;
            }
        });
        return count;
    });
    const conversationList = computed(() => {
        const list = Array.from(conversations.value.values()).filter((item) => {
            const isArch = archivedChatIds.value.has(item.id);
            return isArchiveView.value ? isArch : !isArch;
        });
        return list.sort((a, b) => {
            const timeA = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : 0;
            const timeB = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : 0;
            return timeB - timeA;
        });
    });
    async function loadArchiveState() {
        if (!authStore.user?.id)
            return;
        try {
            const { data } = await tablesApi.userChatArchiveState.loadArchive(authStore.user.id);
            if (data?.archived_ids && Array.isArray(data.archived_ids)) {
                archivedChatIds.value = new Set(data.archived_ids);
            }
        }
        catch (e) {
            console.warn('[Chat] loadArchiveState error:', e);
        }
    }
    async function syncArchiveState() {
        if (!authStore.user?.id)
            return;
        try {
            await tablesApi.userChatArchiveState.syncArchive(authStore.user.id, Array.from(archivedChatIds.value));
        }
        catch (e) {
            console.warn('[Chat] syncArchiveState error:', e);
        }
    }
    function toggleArchiveChat(chatId: string) {
        if (archivedChatIds.value.has(chatId)) {
            archivedChatIds.value.delete(chatId);
        }
        else {
            archivedChatIds.value.add(chatId);
        }
        syncArchiveState();
    }
    async function loadConversations() {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        try {
            await loadArchiveState();
            const { data: recentMsgs, error } = await tablesApi.messages.loadRecentDialogs(myId, 400);
            if (error)
                throw error;
            const partnerIds = new Set<string>();
            recentMsgs?.forEach((m) => {
                const partner = m.sender_id === myId ? m.receiver_id : m.sender_id;
                if (partner)
                    partnerIds.add(partner);
            });
            conversations.value.set(FAV_ID, {
                ...conversations.value.get(FAV_ID),
                id: FAV_ID,
                profile: FAV_PROFILE as UserProfile,
                unreadCount: 0,
                isGroup: false,
            });
            if (partnerIds.size > 0) {
                const { data: profilesData } = await tablesApi.profiles.getByIds(Array.from(partnerIds));
                const profMap = new Map<string, UserProfile>();
                profilesData?.forEach((p) => profMap.set(p.id, p as UserProfile));
                const lastMsgMap = new Map<string, Message>();
                const unreadMap = new Map<string, number>();
                recentMsgs?.forEach((m) => {
                    const partner = m.sender_id === myId ? m.receiver_id : m.sender_id;
                    if (!partner)
                        return;
                    if (!lastMsgMap.has(partner)) {
                        lastMsgMap.set(partner, m as Message);
                    }
                    if (m.receiver_id === myId && !m.read_at && !m.is_read) {
                        unreadMap.set(partner, (unreadMap.get(partner) || 0) + 1);
                    }
                });
                partnerIds.forEach((pid) => {
                    const p = profMap.get(pid) || { id: pid, name: 'Пользователь', username: 'user' };
                    conversations.value.set(pid, {
                        id: pid,
                        profile: p,
                        lastMessage: lastMsgMap.get(pid) || null,
                        unreadCount: unreadMap.get(pid) || 0,
                        isGroup: false,
                    });
                });
            }
            setupGlobalRealtime();
            conversationsLoadFailed.value = false;
        }
        catch (err) {
            console.error('[Chat] loadConversations error:', err);
            if (authStore.user?.id === myId)
                conversationsLoadFailed.value = true;
        }
        finally {
            if (authStore.user?.id === myId)
                conversationsLoaded.value = true;
        }
    }
    function setupGlobalRealtime() {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        if (!globalMessageChannel) {
            globalMessageChannel = realtimeApi.channelMessages(myId)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                const newMsg = payload.new as Message;
                if (!newMsg)
                    return;
                handleIncomingMessage(newMsg);
            })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
                const updated = payload.new as Message;
                if (!updated)
                    return;
                handleUpdatedMessage(updated);
            })
                .subscribe();
        }
        if (!favoritesChannel) {
            favoritesChannel = realtimeApi.channelFavorites(myId)
                .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'quietly_favorite_messages',
                filter: `user_id=eq.${myId}`,
            }, (payload) => {
                const r = payload.new as any;
                if (!r)
                    return;
                handleIncomingFavorite(r);
            })
                .subscribe();
        }
        if (!typingInboxChannel) {
            typingInboxChannel = realtimeApi.channelTypingInbox(myId)
                .on('broadcast', { event: 'typing' }, (event) => {
                const fromId = event.payload?.from;
                if (fromId) {
                    const name = conversations.value.get(fromId)?.profile.name || 'Собеседник';
                    typingUsers.value.set(fromId, name);
                    clearTimeout(typingTimeout);
                    typingTimeout = setTimeout(() => {
                        typingUsers.value.delete(fromId);
                    }, 3500);
                }
            })
                .subscribe();
        }
        if (!meLiveChannel) {
            meLiveChannel = realtimeApi.channelMeLive(myId)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${myId}` }, (payload) => {
                if (payload.new && authStore.profile) {
                    Object.assign(authStore.profile, payload.new);
                }
            })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'user_gifts', filter: `owner_id=eq.${myId}` }, () => {
                void useEconomyStore().loadUserGifts(myId);
            })
                .subscribe();
        }
    }
    function handleIncomingMessage(newMsg: Message) {
        const myId = authStore.user?.id;
        if (!myId)
            return;
        const partnerId = newMsg.sender_id === myId ? newMsg.receiver_id : newMsg.sender_id;
        if (!partnerId)
            return;
        const conv = conversations.value.get(partnerId);
        if (conv) {
            conv.lastMessage = newMsg;
            if (newMsg.sender_id !== myId && activeChat.value?.id !== partnerId) {
                conv.unreadCount = (conv.unreadCount || 0) + 1;
            }
        }
        if (activeChat.value?.id === partnerId) {
            const exists = messages.value.some((m) => m.id === newMsg.id);
            if (!exists) {
                messages.value.push(newMsg);
                tauriSaveMessage(newMsg, partnerId);
            }
            if (newMsg.sender_id !== myId) {
                tauriNotify(activeChat.value.name, newMsg.content);
                tablesApi.messages.markAsRead([newMsg.id]);
            }
        }
    }
    function handleUpdatedMessage(updated: Message) {
        const idx = messages.value.findIndex((m) => m.id === updated.id);
        if (idx !== -1) {
            messages.value[idx] = updated;
            refreshPinnedMessages();
        }
    }
    function handleIncomingFavorite(r: any) {
        const myId = authStore.user?.id;
        if (!myId)
            return;
        const cid = r.client_id || String(r.id);
        const exists = messages.value.some((m) => m.id === cid || m.id === r.id);
        if (!exists) {
            const newMsg: Message = {
                id: cid,
                chat_id: FAV_ID,
                sender_id: myId,
                receiver_id: FAV_ID,
                content: r.content || '',
                reply_to: r.original_message_id || null,
                created_at: r.created_at,
                status: 'sent',
                is_favorite: true,
                reactions: {},
            };
            if (activeChat.value?.id === FAV_ID) {
                messages.value.push(newMsg);
            }
            tauriSaveMessage(newMsg, FAV_ID);
        }
    }
    let chatLoadSeq = 0;
    const messageCache = new Map<string, Message[]>();
    let cachedAccount: string | undefined;
    watch(() => authStore.user?.id, id => {
        if (id !== cachedAccount) {
            cachedAccount = id;
            chatLoadSeq++;
            messageCache.clear();
            conversations.value.clear();
            conversationsLoaded.value = false;
            conversationsLoadFailed.value = false;
            messages.value = [];
            activeChat.value = null;
        }
    }, { immediate: true, flush: 'sync' });
    watch(messages, value => {
        const id = activeChat.value?.id;
        if (id)
            messageCache.set(id, value.slice());
    }, { deep: true, flush: 'sync' });
    function mergeLoaded(server: Message[], before: Map<string, Message>): Message[] {
        const result = new Map(server.map(m => [String(m.id), m]));
        for (const message of messages.value) {
            const key = String(message.id);
            if (!before.has(key) || before.get(key) !== message || message.status === 'sending' || message.status === 'error') {
                result.set(key, message);
            }
        }
        return [...result.values()].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    async function openChat(partner: UserProfile) {
        if (activeChat.value?.id !== partner.id) {
            if (activeChat.value)
                messageCache.set(activeChat.value.id, messages.value.slice());
            activeChat.value = partner;
            messages.value = messageCache.get(partner.id)?.slice() || [];
        }
        else {
            activeChat.value = partner;
        }
        replyContext.value = null;
        editContext.value = null;
        exitSelectionMode();
        isSearchOpen.value = false;
        searchQuery.value = '';
        if (!conversations.value.has(partner.id)) {
            conversations.value.set(partner.id, {
                id: partner.id,
                profile: partner,
                unreadCount: 0,
                isGroup: false,
            });
        }
        else {
            const conv = conversations.value.get(partner.id);
            if (conv) {
                conv.unreadCount = 0;
            }
        }
        await loadMessages(partner.id);
    }
    function subscribeToPartnerPresence(partnerId: string | null) {
        if (pairPresenceChannel) {
            void supabase.removeChannel(pairPresenceChannel);
            pairPresenceChannel = null;
        }
        presenceStore.setPairChannel(null);
        if (!authStore.user?.id || !partnerId || partnerId === FAV_ID || partnerId.startsWith('sys:'))
            return;
        const channel = realtimeApi.channelPairPresence(authStore.user.id, partnerId);
        pairPresenceChannel = channel;
        presenceStore.setPairChannel(channel);
        channel.on('presence', { event: 'sync' }, () => presenceStore.syncPair(channel))
            .on('broadcast', { event: 'typing' }, (event) => {
            if (event.payload?.from === partnerId) {
                typingUsers.value.set(partnerId, activeChat.value?.name || '');
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => typingUsers.value.delete(partnerId), 3500);
            }
        })
            .subscribe((status) => {
            if (status === 'SUBSCRIBED' && pairPresenceChannel === channel) {
                presenceStore.setPairChannel(channel);
                if (authStore.profile?.online_visibility !== 'nobody')
                    void channel.track({ online_at: new Date().toISOString() });
            }
            if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && pairPresenceChannel === channel)
                presenceStore.setPairChannel(null);
        });
    }
    watch(() => [activeChat.value?.id, authStore.authScreen, authStore.user?.id], () => {
        subscribeToPartnerPresence(authStore.authScreen === 'logged_in' ? activeChat.value?.id || null : null);
    });
    function sendTyping() {
        if (!authStore.user?.id || !activeChat.value || activeChat.value.id === FAV_ID)
            return;
        const myId = authStore.user.id;
        const partnerId = activeChat.value.id;
        if (pairPresenceChannel) {
            pairPresenceChannel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { from: myId, on: true },
            });
        }
        const inbox = realtimeApi.channelTypingInbox(partnerId);
        inbox.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                inbox.send({
                    type: 'broadcast',
                    event: 'typing',
                    payload: { from: myId, on: true },
                });
            }
        });
    }
    async function loadMessages(partnerId: string) {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        isMessagesLoading.value = true;
        chatLoadSeq++;
        const seq = chatLoadSeq;
        const local = await tauriGetMessages(partnerId, 200);
        if (seq !== chatLoadSeq)
            return;
        if (local.length > 0 && messages.value.length === 0) {
            messages.value = local.map((m) => ({
                id: m.id,
                chat_id: m.chat_id,
                sender_id: m.sender_id,
                content: m.content,
                reply_to: m.reply_to || null,
                created_at: m.created_at,
                status: (m.status as any) || 'sent',
                pinned_at: m.pinned_at || null,
                is_favorite: m.is_favorite || false,
                reactions: m.reactions_json ? JSON.parse(m.reactions_json) : {},
            }));
            refreshPinnedMessages();
        }
        const before = new Map(messages.value.map(m => [String(m.id), m]));
        try {
            if (partnerId === FAV_ID) {
                const { data: favData, error: favErr } = await tablesApi.quietlyFavoriteMessages.loadFromServer(myId, 1000);
                if (seq !== chatLoadSeq)
                    return;
                if (favErr)
                    throw favErr;
                if (favData) {
                    messages.value = mergeLoaded(favData.map((r: any) => ({
                        id: r.client_id || String(r.id),
                        chat_id: FAV_ID,
                        sender_id: myId,
                        receiver_id: FAV_ID,
                        content: r.content || '',
                        reply_to: r.original_message_id || null,
                        created_at: r.created_at,
                        status: 'sent',
                        pinned_at: null,
                        is_favorite: true,
                        reactions: {},
                    })), before);
                    refreshPinnedMessages();
                    favData.forEach((r: any) => {
                        tauriSaveMessage({
                            id: r.client_id || String(r.id),
                            chat_id: FAV_ID,
                            sender_id: myId,
                            content: r.content || '',
                            created_at: r.created_at,
                        }, FAV_ID);
                    });
                }
            }
            else {
                const { data, error } = await tablesApi.messages.loadChat(myId, partnerId, 300);
                if (seq !== chatLoadSeq)
                    return;
                if (error)
                    throw error;
                if (data) {
                    const sorted = [...data].reverse();
                    messages.value = mergeLoaded(sorted as Message[], before);
                    refreshPinnedMessages();
                    sorted.forEach((m) => {
                        tauriSaveMessage(m as Message, partnerId);
                    });
                    const unreadIds = sorted
                        .filter((m) => m.receiver_id === myId && !m.read_at && !m.is_read)
                        .map((m) => m.id);
                    if (unreadIds.length > 0) {
                        await tablesApi.messages.markAsRead(unreadIds);
                    }
                }
            }
        }
        catch (err) {
            console.warn('[Chat] loadMessages server fetch failed, showing local:', err);
        }
        finally {
            if (seq === chatLoadSeq) {
                isMessagesLoading.value = false;
            }
        }
    }
    function refreshPinnedMessages() {
        pinnedMessages.value = messages.value
            .filter((m) => !!m.pinned_at)
            .sort((a, b) => new Date(a.pinned_at!).getTime() - new Date(b.pinned_at!).getTime());
        activePinIndex.value = Math.max(0, pinnedMessages.value.length - 1);
    }
    async function sendMessage(content: string, replyToId?: string | number | null) {
        if (!authStore.user?.id || !activeChat.value)
            return;
        const myId = authStore.user.id;
        const partnerId = activeChat.value.id;
        const isFav = partnerId === FAV_ID;
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const optMsg: Message = {
            id: tempId,
            chat_id: partnerId,
            sender_id: myId,
            receiver_id: isFav ? FAV_ID : partnerId,
            content,
            reply_to: replyToId || null,
            created_at: new Date().toISOString(),
            status: 'sending',
        };
        messages.value = [...messages.value, optMsg];
        newlyAddedId.value = tempId;
        setTimeout(() => {
            if (newlyAddedId.value === tempId)
                newlyAddedId.value = null;
        }, 800);
        const conv = conversations.value.get(partnerId);
        if (conv) {
            conv.lastMessage = optMsg;
        }
        try {
            if (isFav) {
                optMsg.status = 'sent';
                await tauriSaveMessage(optMsg, FAV_ID);
                await tablesApi.quietlyFavoriteMessages.syncLocalToServer({
                    user_id: myId,
                    client_id: tempId,
                    content,
                    created_at: optMsg.created_at,
                    original_sender_id: myId,
                    original_message_id: replyToId ? String(replyToId) : null,
                });
                messages.value = messages.value.map((m) => (m.id === tempId ? { ...m, status: 'sent' } : m));
            }
            else {
                const { data, error } = await tablesApi.messages.insertMessage({
                    sender_id: myId,
                    receiver_id: partnerId,
                    content,
                    reply_to: replyToId ? String(replyToId) : null,
                });
                if (error)
                    throw error;
                if (data) {
                    messages.value = messages.value.map((m) => (m.id === tempId ? (data as Message) : m));
                    tauriSaveMessage(data as Message, partnerId);
                    if (conv) {
                        conv.lastMessage = data as Message;
                    }
                }
            }
        }
        catch (err) {
            console.error('[Chat] sendMessage error:', err);
            messages.value = messages.value.map((m) => m.id === tempId ? { ...m, status: 'error' } : m);
        }
    }
    async function editMessage(messageId: string | number, newContent: string) {
        let updated: Message | null = null;
        try {
            updated = await rpcApi.editMessage(String(messageId), newContent);
        }
        catch {
            const result = await supabase.from('messages').update({ content: newContent, edited_at: new Date().toISOString() }).eq('id', messageId).select().single();
            if (result.error)
                throw result.error;
            updated = result.data as Message;
        }
        if (!updated)
            throw new Error('Не удалось сохранить сообщение');
        const idx = messages.value.findIndex(m => String(m.id) === String(messageId));
        if (idx !== -1)
            messages.value[idx] = updated;
    }
    async function togglePinMessage(message: Message) {
        const isPinning = !message.pinned_at;
        try {
            const data = await rpcApi.pinMessage(String(message.id), isPinning);
            const idx = messages.value.findIndex((m) => m.id === message.id);
            if (idx !== -1 && data) {
                messages.value[idx] = data;
            }
            refreshPinnedMessages();
        }
        catch (err) {
            console.warn('[Chat] pinMessage RPC error, fallback to direct update:', err);
            const pinned_at = isPinning ? new Date().toISOString() : null;
            await supabase.from('messages').update({ pinned_at }).eq('id', message.id);
            message.pinned_at = pinned_at;
            refreshPinnedMessages();
        }
    }
    async function deleteMessage(messageId: string | number, deleteForAll = true) {
        try {
            await rpcApi.deleteMessage(String(messageId), deleteForAll);
            messages.value = messages.value.filter((m) => m.id !== messageId);
            refreshPinnedMessages();
        }
        catch (err) {
            console.warn('[Chat] deleteMessage RPC error, fallback to direct delete:', err);
            await supabase.from('messages').delete().eq('id', messageId);
            messages.value = messages.value.filter((m) => m.id !== messageId);
            refreshPinnedMessages();
        }
    }
    async function deleteWholeChat(partnerId: string, deleteForAll = false) {
        try {
            await rpcApi.deleteChat(partnerId, deleteForAll);
            conversations.value.delete(partnerId);
            if (activeChat.value?.id === partnerId) {
                activeChat.value = null;
                messages.value = [];
            }
        }
        catch (err) {
            console.error('[Chat] deleteChat RPC error:', err);
        }
    }
    const pendingReactions = new Set<string>();
    async function reactToMessage(messageId: string | number, emoji: string) {
        const userId = authStore.user?.id;
        const message = messages.value.find(m => String(m.id) === String(messageId));
        const key = String(messageId);
        if (!userId || !message || message.status === 'sending' || key.startsWith('temp_') || activeChat.value?.id === FAV_ID)
            throw new Error('Реакция для этого сообщения недоступна');
        if (pendingReactions.has(key))
            return;
        pendingReactions.add(key);
        const previous = message.reactions;
        const current: Record<string, string> = Array.isArray(previous) ? Object.fromEntries(previous.map(r => [r.user_id, r.emoji])) : { ...(previous || {}) };
        if (current[userId] === emoji)
            delete current[userId];
        else
            current[userId] = emoji;
        message.reactions = current;
        try {
            const result = await rpcApi.reactMessage(key, emoji);
            if (result && result.reactions && typeof result.reactions === 'object')
                message.reactions = result.reactions;
            const refreshed = await supabase.from('messages').select('reactions').eq('id', key).maybeSingle();
            if (!refreshed.error && refreshed.data)
                message.reactions = refreshed.data.reactions || {};
        }
        catch (err) {
            message.reactions = previous;
            throw err;
        }
        finally {
            pendingReactions.delete(key);
        }
    }
    function startSelection(messageId: string | number) {
        isSelectionMode.value = true;
        selectedMessageIds.value = new Set([messageId]);
    }
    function toggleSelection(messageId: string | number) {
        if (selectedMessageIds.value.has(messageId)) {
            selectedMessageIds.value.delete(messageId);
            if (selectedMessageIds.value.size === 0) {
                exitSelectionMode();
            }
        }
        else {
            selectedMessageIds.value.add(messageId);
        }
    }
    function exitSelectionMode() {
        isSelectionMode.value = false;
        selectedMessageIds.value.clear();
    }
    return {
        conversations,
        conversationsLoaded,
        conversationsLoadFailed,
        activeChat,
        messages,
        isMessagesLoading,
        typingUsers,
        replyContext,
        editContext,
        selectedMessageIds,
        isSelectionMode,
        archivedChatIds,
        isArchiveView,
        pinnedMessages,
        activePinIndex,
        searchQuery,
        isSearchOpen,
        newlyAddedId,
        totalUnreadCount,
        conversationList,
        loadConversations,
        openChat,
        loadMessages,
        sendMessage,
        editMessage,
        togglePinMessage,
        reactToMessage,
        deleteMessage,
        deleteWholeChat,
        toggleArchiveChat,
        sendTyping,
        startSelection,
        toggleSelection,
        exitSelectionMode,
        refreshPinnedMessages,
    };
});
