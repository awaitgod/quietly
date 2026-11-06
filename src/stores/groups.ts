import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { supabase, tablesApi, rpcApi, realtimeApi } from '../services/supabase';
import { tauriSaveMessage, tauriNotify } from '../services/tauriIpc';
import type { Group, GroupMember, GroupMessage, Message, UserProfile } from '../types';
import { useAuthStore } from './auth';
export const useGroupsStore = defineStore('groups', () => {
    const authStore = useAuthStore();
    const groups = ref<Group[]>([]);
    const groupsLoaded = ref(false);
    const groupsLoadFailed = ref(false);
    const activeGroup = ref<Group | null>(null);
    const groupMessages = ref<Message[]>([]);
    const groupMembers = ref<GroupMember[]>([]);
    const groupProfiles = ref<Map<string, UserProfile>>(new Map());
    const isGroupLoading = ref(false);
    const pinnedGroupMessages = ref<Message[]>([]);
    const activeGroupPinIndex = ref(0);
    const newlyAddedId = ref<string | number | null>(null);
    let groupChannel: any = null;
    let groupListChannel: any = null;
    const totalGroupUnread = computed(() => {
        return groups.value.reduce((acc, g) => acc + (g.unread_count || 0), 0);
    });
    async function loadUserGroups() {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        try {
            const { data, error } = await tablesApi.groupMembers.getUserGroups(myId);
            if (error)
                throw error;
            const list: Group[] = (data || [])
                .map((row: any) => row.groups)
                .filter(Boolean);
            if (authStore.user?.id !== myId)
                return;
            const previous = new Map(groups.value.map(group => [String(group.id), group.last_message]));
            groups.value = list.map(group => ({ ...group, last_message: group.last_message || previous.get(String(group.id)) || null }));
            groupsLoadFailed.value = false;
            setupGroupListRealtime();
        }
        catch (err) {
            console.error('[Groups] loadUserGroups error:', err);
            if (authStore.user?.id === myId)
                groupsLoadFailed.value = true;
        }
        finally {
            if (authStore.user?.id === myId)
                groupsLoaded.value = true;
        }
    }
    function setupGroupListRealtime() {
        if (!authStore.user?.id || groupListChannel)
            return;
        const myId = authStore.user.id;
        groupListChannel = realtimeApi.channelGroupList(myId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, (payload) => {
            const message = payload.new as GroupMessage;
            const group = groups.value.find(item => String(item.id) === String(message.group_id));
            if (!group)
                return;
            const previousTime = group.last_message?.created_at ? Date.parse(group.last_message.created_at) : 0;
            if (!previousTime || Date.parse(message.created_at) >= previousTime)
                group.last_message = message;
        })
            .subscribe();
    }
    const memberCache = new Map<string, GroupMember[]>();
    const groupMessageCache = new Map<string, Message[]>();
    let memberAccount: string | undefined;
    let openSequence = 0;
    let groupLoadSeq = 0;
    watch(() => authStore.user?.id, id => {
        if (id !== memberAccount) {
            memberAccount = id;
            memberCache.clear();
            groupMessageCache.clear();
            openSequence++;
            groupLoadSeq++;
            activeGroup.value = null;
            groupMembers.value = [];
            groupMessages.value = [];
            groupProfiles.value.clear();
            groups.value = [];
            groupsLoaded.value = false;
            groupsLoadFailed.value = false;
        }
    }, { immediate: true, flush: 'sync' });
    watch(groupMembers, value => {
        if (activeGroup.value)
            memberCache.set(String(activeGroup.value.id), value.slice());
    }, { deep: true, flush: 'sync' });
    watch(groupMessages, value => {
        if (activeGroup.value) {
            const key = String(activeGroup.value.id);
            groupMessageCache.delete(key);
            groupMessageCache.set(key, value.slice());
            if (groupMessageCache.size > 30)
                groupMessageCache.delete(groupMessageCache.keys().next().value!);
        }
    }, { deep: true, flush: 'sync' });
    async function openGroup(group: Group) {
        const seq = ++openSequence;
        if (activeGroup.value) {
            memberCache.set(String(activeGroup.value.id), groupMembers.value.slice());
            groupMessageCache.set(String(activeGroup.value.id), groupMessages.value.slice());
        }
        activeGroup.value = group;
        groupMessages.value = groupMessageCache.get(String(group.id))?.slice() || [];
        groupMembers.value = memberCache.get(String(group.id))?.slice() || [];
        isGroupLoading.value = true;
        await Promise.all([
            loadGroupMembers(group.id),
            loadGroupMessages(group.id),
        ]);
        if (seq !== openSequence || String(activeGroup.value?.id) !== String(group.id))
            return;
        subscribeToGroupRealtime(group.id);
        isGroupLoading.value = false;
    }
    async function loadGroupMembers(groupId: string) {
        try {
            const { data, error } = await tablesApi.groupMembers.getGroupMembers(groupId);
            if (error)
                throw error;
            if (String(activeGroup.value?.id) !== String(groupId))
                return;
            if (data) {
                groupMembers.value = data as any;
                const uids = data.map((m: any) => m.user_id);
                if (uids.length > 0) {
                    const { data: profs } = await tablesApi.profiles.getByIds(uids);
                    profs?.forEach((p: any) => groupProfiles.value.set(p.id, p as UserProfile));
                }
            }
        }
        catch (err) {
            console.error('[Groups] loadGroupMembers error:', err);
        }
    }
    async function loadGroupMessages(groupId: string) {
        groupLoadSeq++;
        const seq = groupLoadSeq;
        const before = new Map(groupMessages.value.map(m => [String(m.id), m]));
        try {
            const { data, error } = await tablesApi.groupMessages.loadHistory(groupId, 300);
            if (seq !== groupLoadSeq || String(activeGroup.value?.id) !== String(groupId))
                return;
            if (error)
                throw error;
            if (data) {
                const merged = new Map((data as Message[]).map(m => [String(m.id), m]));
                for (const message of groupMessages.value) {
                    const key = String(message.id);
                    if (!before.has(key) || before.get(key) !== message || message.status === 'sending' || message.status === 'error')
                        merged.set(key, message);
                }
                groupMessages.value = [...merged.values()].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                await loadGroupReactions(groupId);
                if (seq !== groupLoadSeq)
                    return;
                refreshGroupPins();
                const missingUserIds = data
                    .map((m) => m.sender_id)
                    .filter((id) => !groupProfiles.value.has(id));
                if (missingUserIds.length > 0) {
                    const { data: profs } = await tablesApi.profiles.getByIds(Array.from(new Set(missingUserIds)));
                    if (seq !== groupLoadSeq)
                        return;
                    profs?.forEach((p: any) => groupProfiles.value.set(p.id, p as UserProfile));
                }
                data.forEach((m) => {
                    tauriSaveMessage(m as Message, `grp:${groupId}`);
                });
                if (authStore.user?.id) {
                    const myId = authStore.user.id;
                    const readRows = data.map((m) => ({
                        message_id: Number(m.id),
                        group_id: groupId,
                        user_id: myId,
                    }));
                    if (readRows.length > 0) {
                        tablesApi.groupReads.markRead(readRows);
                    }
                }
            }
        }
        catch (err) {
            console.error('[Groups] loadGroupMessages error:', err);
        }
    }
    function refreshGroupPins() {
        pinnedGroupMessages.value = groupMessages.value
            .filter((m) => !!m.pinned_at)
            .sort((a, b) => new Date(a.pinned_at!).getTime() - new Date(b.pinned_at!).getTime());
        activeGroupPinIndex.value = Math.max(0, pinnedGroupMessages.value.length - 1);
    }
    function subscribeToGroupRealtime(groupId: string) {
        if (groupChannel) {
            supabase.removeChannel(groupChannel);
        }
        groupChannel = realtimeApi.channelGroup(groupId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, async (payload) => {
            const newMsg = payload.new as Message;
            if (!groupProfiles.value.has(newMsg.sender_id)) {
                const { data } = await tablesApi.profiles.getById(newMsg.sender_id);
                if (data)
                    groupProfiles.value.set(data.id, data as UserProfile);
            }
            if (!groupMessages.value.some(m => String(m.id) === String(newMsg.id))) {
                if (newMsg.sender_id !== authStore.user?.id) {
                    newlyAddedId.value = newMsg.id;
                    setTimeout(() => { if (newlyAddedId.value === newMsg.id) newlyAddedId.value = null; }, 800);
                }
                groupMessages.value.push(newMsg);
            }
            tauriSaveMessage(newMsg, `grp:${groupId}`);
            if (newMsg.sender_id !== authStore.user?.id) {
                tauriNotify(activeGroup.value?.name || 'Группа', newMsg.content);
                if (authStore.user?.id) {
                    tablesApi.groupReads.markRead([{
                            message_id: Number(newMsg.id),
                            group_id: groupId,
                            user_id: authStore.user.id,
                        }]);
                }
            }
        })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, (payload) => {
            const updated = payload.new as Message;
            const idx = groupMessages.value.findIndex((m) => m.id === updated.id);
            if (idx !== -1) {
                groupMessages.value[idx] = updated;
                refreshGroupPins();
            }
        })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages' }, (payload) => {
            const deletedId = payload.old?.id;
            if (deletedId) {
                groupMessages.value = groupMessages.value.filter((m) => m.id !== deletedId);
                refreshGroupPins();
            }
        })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, () => {
            if (String(activeGroup.value?.id) === String(groupId))
                void loadGroupMembers(groupId);
        })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_reactions', filter: `group_id=eq.${groupId}` }, () => {
            if (String(activeGroup.value?.id) === String(groupId))
                void loadGroupReactions(groupId);
        })
            .subscribe();
    }
    async function sendGroupMessage(content: string, replyToId?: string | number | null) {
        if (!authStore.user?.id || !activeGroup.value)
            return;
        const myId = authStore.user.id;
        const groupId = activeGroup.value.id;
        const tempId = `temp_grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const optMsg: Message = {
            id: tempId,
            chat_id: `grp:${groupId}`,
            sender_id: myId,
            content,
            reply_to: replyToId || null,
            created_at: new Date().toISOString(),
            status: 'sending',
        };
        groupMessages.value = [...groupMessages.value, optMsg];
        newlyAddedId.value = tempId;
        setTimeout(() => {
            if (newlyAddedId.value === tempId)
                newlyAddedId.value = null;
        }, 800);
        try {
            const { data, error } = await tablesApi.groupMessages.insert({
                group_id: groupId,
                sender_id: myId,
                content,
                reply_to: replyToId ? Number(replyToId) : null,
            });
            if (error)
                throw error;
            if (data) {
                groupMessages.value = groupMessages.value.map((m) => m.id === tempId ? (data as Message) : m);
                tauriSaveMessage(data as Message, `grp:${groupId}`);
            }
        }
        catch (err) {
            console.error('[Groups] sendGroupMessage error:', err);
            groupMessages.value = groupMessages.value.map((m) => m.id === tempId ? { ...m, status: 'error' } : m);
        }
    }
    async function createGroup(name: string, photoBlob?: Blob, memberUserIds: string[] = []) {
        if (!authStore.user?.id)
            throw new Error('Необходимо войти в аккаунт');
        const myId = authStore.user.id;
        let avatarUrl: string | null = null;
        if (photoBlob) {
            const path = `${myId}/group_${Date.now()}.jpg`;
            const { error: upErr } = await supabase.storage.from('avatars').upload(path, photoBlob, {
                upsert: true,
                contentType: 'image/jpeg',
            });
            if (upErr)
                throw upErr;
            avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
        }
        const username = (name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 6) || 'group') + Math.random().toString(36).slice(2, 6);
        const { data: newGroup, error } = await tablesApi.groups.create({
            name,
            username,
            avatar_url: avatarUrl,
            owner_id: myId,
        });
        if (error)
            throw error;
        const allMembers = [...new Set([myId, ...memberUserIds])];
        const memberRows = allMembers.map((uid) => ({
            group_id: newGroup.id,
            user_id: uid,
            role: (uid === myId ? 'owner' : 'member') as 'owner' | 'admin' | 'member',
        }));
        const membersResult = await tablesApi.groupMembers.insertMembers(memberRows);
        if (membersResult.error) {
            groups.value.unshift(newGroup as Group);
            return { group: newGroup as Group, warning: 'Группа создана, но добавить участников не удалось. Проверьте права и состав группы.' };
        }
        await tablesApi.groupMessages.insert({
            group_id: newGroup.id,
            sender_id: myId,
            content: `svc::${JSON.stringify({ t: 'join' })}`,
        });
        groups.value.unshift(newGroup as Group);
        await openGroup(newGroup as Group);
        return { group: newGroup as Group, warning: '' };
    }
    async function pinGroupMessage(message: Message, pin: boolean) {
        try {
            await rpcApi.pinGroupMessage(Number(message.id), pin);
            const idx = groupMessages.value.findIndex((m) => m.id === message.id);
            if (idx !== -1) {
                groupMessages.value[idx].pinned_at = pin ? new Date().toISOString() : null;
            }
            refreshGroupPins();
        }
        catch (err) {
            console.error('[Groups] pinGroupMessage error:', err);
        }
    }
    async function clearGroupHistory(groupId: string | number) {
        try {
            await rpcApi.clearGroupHistory(groupId);
            if (activeGroup.value?.id === String(groupId)) {
                groupMessages.value = [];
                pinnedGroupMessages.value = [];
            }
        }
        catch (err) {
            console.error('[Groups] clearGroupHistory error:', err);
        }
    }
    async function loadGroupReactions(groupId: string) {
        const result = await tablesApi.groupReactions.loadReactions(groupId);
        if (result.error) {
            console.warn('[Groups] load reactions:', result.error);
            return;
        }
        if (String(activeGroup.value?.id) !== String(groupId))
            return;
        const byMessage = new Map<string, Record<string, string>>();
        for (const r of result.data || []) {
            const key = String(r.message_id);
            if (!byMessage.has(key))
                byMessage.set(key, {});
            byMessage.get(key)![r.user_id] = r.emoji;
        }
        for (const message of groupMessages.value)
            message.reactions = byMessage.get(String(message.id)) || {};
    }
    const pendingGroupReactions = new Set<string>();
    async function reactToGroupMessage(messageId: string | number, emoji: string) {
        const userId = authStore.user?.id, groupId = activeGroup.value?.id;
        const message = groupMessages.value.find(m => String(m.id) === String(messageId));
        const numericId = Number(messageId), key = String(messageId);
        if (!userId || !groupId || !message || !Number.isSafeInteger(numericId) || numericId <= 0)
            throw new Error('Дождитесь отправки сообщения');
        if (pendingGroupReactions.has(key))
            return;
        pendingGroupReactions.add(key);
        const previous = message.reactions;
        const values: Record<string, string> = Array.isArray(previous) ? Object.fromEntries(previous.map(r => [r.user_id, r.emoji])) : { ...(previous || {}) };
        const old = values[userId];
        if (old === emoji)
            delete values[userId];
        else
            values[userId] = emoji;
        message.reactions = values;
        try {
            if (old) {
                const removed = await tablesApi.groupReactions.removeReaction(numericId, userId);
                if (removed.error)
                    throw removed.error;
            }
            if (old !== emoji) {
                const added = await tablesApi.groupReactions.addReaction({ message_id: numericId, group_id: groupId, user_id: userId, emoji });
                if (added.error)
                    throw added.error;
            }
            await loadGroupReactions(groupId);
        }
        catch (err) {
            message.reactions = previous;
            await loadGroupReactions(groupId);
            throw err;
        }
        finally {
            pendingGroupReactions.delete(key);
        }
    }
    return {
        groups,
        groupsLoaded,
        groupsLoadFailed,
        activeGroup,
        groupMessages,
        groupMembers,
        groupProfiles,
        isGroupLoading,
        pinnedGroupMessages,
        activeGroupPinIndex,
        totalGroupUnread,
        newlyAddedId,
        loadUserGroups,
        openGroup,
        sendGroupMessage,
        createGroup,
        pinGroupMessage,
        clearGroupHistory,
        reactToGroupMessage,
    };
});
