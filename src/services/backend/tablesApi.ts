import { supabase } from '../supabase';
import type { UserProfile, GroupKeyEntry } from '../../types';
export const tablesApi = {
    profiles: {
        getById: (userId: string) => supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        getByIds: (userIds: string[]) => supabase.from('profiles').select('*').in('id', userIds),
        checkUsername: (username: string, excludeMyId?: string) => {
            let q = supabase.from('profiles').select('id').eq('username', username.toLowerCase());
            if (excludeMyId)
                q = q.neq('id', excludeMyId);
            return q.limit(1);
        },
        searchByUsername: (query: string, meId: string, limit = 20) => supabase
            .from('profiles')
            .select('*')
            .neq('id', meId)
            .ilike('username', `%${query.toLowerCase()}%`)
            .order('username')
            .limit(limit),
        upsertProfile: (data: Partial<UserProfile> & {
            id: string;
            name: string;
            username: string;
        }) => supabase.from('profiles').upsert(data),
        updateProfile: (meId: string, data: {
            name?: string;
            username?: string;
            avatar_url?: string | null;
            bio?: string | null;
        }) => supabase.from('profiles').update(data).eq('id', meId),
        updateOnlineVisibility: (meId: string, online_visibility: 'all' | 'contacts' | 'nobody') => supabase.from('profiles').update({ online_visibility }).eq('id', meId),
        updateLastSeen: (meId: string, last_seen = new Date().toISOString()) => supabase.from('profiles').update({ last_seen }).eq('id', meId),
        getQcoinBalance: (meId: string) => supabase.from('profiles').select('qcoin').eq('id', meId).maybeSingle(),
    },
    messages: {
        loadRecentDialogs: (meId: string, limit = 400) => supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`)
            .order('created_at', { ascending: false })
            .limit(limit),
        loadChat: (meId: string, partnerId: string, limit = 300) => supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${meId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${meId})`)
            .order('created_at', { ascending: false })
            .limit(limit),
        pollChatNew: (meId: string, partnerId: string, lastTs: string, limit = 50) => supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${meId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${meId})`)
            .gt('created_at', lastTs)
            .order('created_at', { ascending: true })
            .limit(limit),
        pollGlobalIncoming: (meId: string, globalTs: string, limit = 50) => supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`)
            .gt('created_at', globalTs)
            .order('created_at', { ascending: true })
            .limit(limit),
        insertMessage: (payload: {
            sender_id: string;
            receiver_id: string;
            content: string;
            reply_to?: string | number | null;
        }) => supabase.from('messages').insert(payload).select('*').single(),
        markAsRead: (idList: Array<string | number>, read_at = new Date().toISOString()) => supabase.from('messages').update({ read_at }).in('id', idList),
        loadChatForDeleteFallback: (meId: string, partnerId: string) => supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${meId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${meId})`)
            .order('created_at', { ascending: false })
            .limit(1000),
    },
    groups: {
        create: (data: {
            name: string;
            username: string;
            avatar_url?: string | null;
            owner_id: string;
        }) => supabase.from('groups').insert(data).select().single(),
        searchPublic: (query: string, limit = 10) => supabase
            .from('groups')
            .select('*')
            .eq('is_public', true)
            .ilike('username', `%${query.toLowerCase()}%`)
            .limit(limit),
        checkUsername: (username: string, excludeGroupId?: string) => {
            let q = supabase.from('groups').select('id').eq('is_public', true).ilike('username', username);
            if (excludeGroupId)
                q = q.neq('id', excludeGroupId);
            return q.limit(1);
        },
        updateMeta: (groupId: string, data: {
            name?: string;
            avatar_url?: string | null;
        }) => supabase.from('groups').update(data).eq('id', groupId).select().maybeSingle(),
        updateSettings: (groupId: string, data: {
            is_public?: boolean;
            no_forward?: boolean;
            username?: string;
        }) => supabase.from('groups').update(data).eq('id', groupId).select().maybeSingle(),
        updateHistoryVisible: (groupId: string, history_visible: boolean) => supabase.from('groups').update({ history_visible }).eq('id', groupId).select().maybeSingle(),
        updateAllowedReactions: (groupId: string, allowed_reactions: string[] | null) => supabase.from('groups').update({ allowed_reactions }).eq('id', groupId).select().maybeSingle(),
        deleteGroup: (groupId: string) => supabase.from('groups').delete().eq('id', groupId),
    },
    groupMembers: {
        getUserGroups: (meId: string) => supabase.from('group_members').select('groups(*)').eq('user_id', meId),
        getGroupMembers: (groupId: string) => supabase.from('group_members').select('user_id, role').eq('group_id', groupId),
        getJoinDate: (groupId: string, meId: string) => supabase.from('group_members').select('created_at').eq('group_id', groupId).eq('user_id', meId).maybeSingle(),
        getMembership: (groupId: string, meId: string) => supabase.from('group_members').select('user_id').eq('group_id', groupId).eq('user_id', meId).limit(1),
        insertMembers: (rows: Array<{
            group_id: string;
            user_id: string;
            role: 'owner' | 'admin' | 'member';
        }>) => supabase.from('group_members').insert(rows),
        leaveOrRemove: (groupId: string, userId: string) => supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId),
        cascadeDeleteGroupMembers: (groupId: string) => supabase.from('group_members').delete().eq('group_id', groupId),
    },
    groupMessages: {
        loadRecentForChatsList: (groupIds: string[], limit = 200) => supabase
            .from('group_messages')
            .select('*')
            .in('group_id', groupIds)
            .order('created_at', { ascending: false })
            .limit(limit),
        loadUnreadCounters: (groupIds: string[], limit = 1500) => supabase
            .from('group_messages')
            .select('id, group_id, sender_id')
            .in('group_id', groupIds)
            .order('id', { ascending: false })
            .limit(limit),
        loadHistory: (groupId: string, limit = 300) => supabase
            .from('group_messages')
            .select('*')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true })
            .limit(limit),
        pollNew: (groupId: string, lastId: number, limit = 50) => supabase
            .from('group_messages')
            .select('*')
            .eq('group_id', groupId)
            .gt('id', lastId)
            .order('id', { ascending: true })
            .limit(limit),
        insert: (data: {
            group_id: string;
            sender_id: string;
            content: string;
            reply_to?: number | string | null;
        }) => supabase.from('group_messages').insert(data).select().single(),
        edit: (messageId: number, content: string, edited_at = new Date().toISOString()) => supabase.from('group_messages').update({ content, edited_at }).eq('id', messageId).select().single(),
        delete: (messageId: number) => supabase.from('group_messages').delete().eq('id', messageId),
        deleteBatch: (ids: number[]) => supabase.from('group_messages').delete().in('id', ids),
        deleteAllForGroup: (groupId: string) => supabase.from('group_messages').delete().eq('group_id', groupId),
    },
    groupReads: {
        loadReads: (groupId: string, limit = 10000) => supabase.from('group_reads').select('message_id, user_id').eq('group_id', groupId).limit(limit),
        markRead: (rows: Array<{
            message_id: number;
            group_id: string;
            user_id: string;
        }>) => supabase.from('group_reads').upsert(rows, { onConflict: 'message_id,user_id', ignoreDuplicates: true }),
        clearForGroup: (groupId: string) => supabase.from('group_reads').delete().eq('group_id', groupId),
    },
    groupReactions: {
        loadReactions: (groupId: string, limit = 10000) => supabase.from('group_reactions').select('message_id, user_id, emoji').eq('group_id', groupId).limit(limit),
        addReaction: (data: {
            message_id: number;
            group_id: string;
            user_id: string;
            emoji: string;
        }) => supabase.from('group_reactions').insert(data),
        removeReaction: (messageId: number, userId: string) => supabase.from('group_reactions').delete().eq('message_id', messageId).eq('user_id', userId),
        clearForGroup: (groupId: string) => supabase.from('group_reactions').delete().eq('group_id', groupId),
    },
    userContacts: {
        loadContacts: (meId: string) => supabase.from('user_contacts').select('contact_id, alias_name, alias_avatar').eq('owner_id', meId),
        upsertContact: (data: {
            owner_id: string;
            contact_id: string;
            alias_name: string;
            alias_avatar?: string | null;
        }) => supabase.from('user_contacts').upsert(data, { onConflict: 'owner_id,contact_id' }),
        deleteContact: (meId: string, contactId: string) => supabase.from('user_contacts').delete().eq('owner_id', meId).eq('contact_id', contactId),
    },
    blockedUsers: {
        loadBlocked: (meId: string) => supabase.from('blocked_users').select('blocked_id').eq('blocker_id', meId),
        block: (meId: string, blockedId: string) => supabase.from('blocked_users').upsert({ blocker_id: meId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' }),
        unblock: (meId: string, blockedId: string) => supabase.from('blocked_users').delete().eq('blocker_id', meId).eq('blocked_id', blockedId),
    },
    userDevices: {
        loadDeviceIds: (meId: string) => supabase.from('user_devices').select('device_id').eq('user_id', meId),
        upsertDevice: (device: {
            user_id: string;
            device_id: string;
            name: string;
            kind: string;
            ua: string;
            ip: string;
            last_seen: string;
            session_id?: string | null;
        }) => supabase.from('user_devices').upsert(device, { onConflict: 'user_id,device_id' }),
        updateLastSeen: (meId: string, deviceId: string, last_seen = new Date().toISOString()) => supabase.from('user_devices').update({ last_seen }).eq('user_id', meId).eq('device_id', deviceId),
        checkRevoked: (meId: string, deviceId: string) => supabase.from('user_devices').select('revoked_at').eq('user_id', meId).eq('device_id', deviceId).maybeSingle(),
        deleteCurrent: (meId: string, deviceId: string) => supabase.from('user_devices').delete().eq('user_id', meId).eq('device_id', deviceId),
        terminateOthers: (meId: string, currentDeviceId: string) => supabase.from('user_devices').delete().eq('user_id', meId).neq('device_id', currentDeviceId),
        loadAllActive: (meId: string) => supabase.from('user_devices').select('*').eq('user_id', meId).order('last_seen', { ascending: false }),
    },
    reports: {
        createReport: (data: {
            reporter_id: string;
            reported_id: string;
            reason: string;
            details?: string;
        }) => supabase.from('reports').insert(data),
    },
    stickerPacks: {
        loadUserPacks: (meId: string) => supabase.from('sticker_packs').select('*').eq('owner_id', meId).order('created_at', { ascending: true }),
        findPackByStickerUrl: (url: string) => supabase.from('sticker_packs').select('*').contains('items', JSON.stringify([url])).limit(1),
        createPack: (data: {
            owner_id: string;
            title: string;
            items: string[];
            is_copy?: boolean;
        }) => supabase.from('sticker_packs').insert(data).select('*').single(),
        updatePackItems: (packId: string | number, meId: string, items: string[]) => supabase.from('sticker_packs').update({ items }).eq('id', packId).eq('owner_id', meId).select('*').single(),
        deletePack: (packId: string | number, meId: string) => supabase.from('sticker_packs').delete().eq('id', packId).eq('owner_id', meId).select('id'),
    },
    userGifts: {
        loadUserGifts: (userId: string, limit = 200, offset = 0) => supabase
            .from('user_gifts')
            .select('*')
            .eq('owner_id', userId)
            .eq('status', 'owned')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1),
    },
    coinTx: {
        loadHistory: (meId: string, limit = 100) => supabase
            .from('coin_tx')
            .select('*')
            .eq('user_id', meId)
            .order('created_at', { ascending: false })
            .limit(limit),
    },
    payments: {
        checkPaymentStatus: (paymentId: string) => supabase.from('payments').select('status, qcoin').eq('id', paymentId).maybeSingle(),
    },
    systemMessages: {
        load: (meId: string, limit = 100) => supabase
            .from('system_messages')
            .select('*')
            .eq('user_id', meId)
            .order('created_at', { ascending: false })
            .limit(limit),
        insert: (data: {
            user_id: string;
            kind: string;
            body: string;
        }) => supabase.from('system_messages').insert(data).select('*').single(),
        deleteById: (dbId: string | number) => supabase.from('system_messages').delete().eq('id', dbId),
        clearAll: (meId: string) => supabase.from('system_messages').delete().eq('user_id', meId),
        markAsRead: (ids: Array<string | number>, read_at = new Date().toISOString()) => supabase.from('system_messages').update({ read_at }).in('id', ids),
    },
    quietlyFavoriteMessages: {
        syncLocalToServer: (payload: {
            user_id: string;
            client_id: string;
            content: string;
            created_at: string;
            original_sender_id?: string | null;
            original_message_id?: string | null;
        }) => supabase
            .from('quietly_favorite_messages')
            .upsert(payload, { onConflict: 'user_id,client_id', ignoreDuplicates: true }),
        loadFromServer: (meId: string, limit = 5000) => supabase
            .from('quietly_favorite_messages')
            .select('*')
            .eq('user_id', meId)
            .order('created_at', { ascending: true })
            .limit(limit),
    },
    publicKeys: {
        publishMyKeys: (keys: Array<{
            user_id: string;
            kid: string;
            public_key: string;
        }>) => supabase.from('public_keys').upsert(keys, { onConflict: 'user_id,kid', ignoreDuplicates: true }),
        getKeysByUserIds: (userIds: string[]) => supabase.from('public_keys').select('user_id, kid, public_key, created_at').in('user_id', userIds),
    },
    userKeyBackup: {
        getBackup: (uid: string) => supabase.from('user_key_backup').select('*').eq('user_id', uid).maybeSingle(),
        checkUpdatedAt: (meId: string) => supabase.from('user_key_backup').select('updated_at').eq('user_id', meId).maybeSingle(),
        saveBackup: (payload: {
            user_id: string;
            salt: string;
            iv: string;
            data: string;
            updated_at: string;
        }) => supabase.from('user_key_backup').upsert(payload, { onConflict: 'user_id' }),
    },
    groupKeys: {
        loadWrappedKeys: (groupId: string | number, meId: string) => supabase.from('group_keys').select('*').eq('group_id', groupId).eq('user_id', meId),
        checkExistingWraps: (groupId: string | number) => supabase.from('group_keys').select('user_id, key_id').eq('group_id', groupId),
        publishWrappedKeys: (keys: GroupKeyEntry[]) => supabase.from('group_keys').upsert(keys, { onConflict: 'group_id,user_id,key_id', ignoreDuplicates: true }),
    },
    userChatArchiveState: {
        loadArchive: (meId: string) => supabase.from('user_chat_archive_state').select('archived_ids').eq('user_id', meId).maybeSingle(),
        syncArchive: (meId: string, archived_ids: string[], updated_at = new Date().toISOString()) => supabase.from('user_chat_archive_state').upsert({ user_id: meId, archived_ids, updated_at }, { onConflict: 'user_id' }),
    },
    userTracks: {
        loadMyTracks: (meId: string) => supabase.from('user_tracks').select('*').eq('user_id', meId).order('created_at', { ascending: true }),
        loadFavoriteTrack: (targetUserId: string) => supabase.from('user_tracks').select('*').eq('user_id', targetUserId).eq('is_favorite', true).limit(1),
        addTrack: (track: {
            id: string;
            user_id: string;
            title: string;
            artist: string;
            duration: number;
            audio_path: string;
            audio_url: string;
            cover_path?: string | null;
            cover_url?: string | null;
            src_id?: string | null;
        }) => supabase.from('user_tracks').insert(track).select().single(),
        deleteTrack: (trackId: string) => supabase.from('user_tracks').delete().eq('id', trackId),
        setFavorite: async (meId: string, trackId: string) => {
            const cleared = await supabase.from('user_tracks').update({ is_favorite: false }).eq('user_id', meId).eq('is_favorite', true);
            if (cleared.error) return cleared;
            return supabase.from('user_tracks').update({ is_favorite: true }).eq('id', trackId).eq('user_id', meId).select().single();
        },
        clearFavorite: (meId: string, trackId: string) => supabase.from('user_tracks').update({ is_favorite: false }).eq('id', trackId).eq('user_id', meId).select().single(),
    },
};
