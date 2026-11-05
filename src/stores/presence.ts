import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, rpcApi, tablesApi } from '../services/supabase';
import { useAuthStore } from './auth';
import { useContactsStore } from './contacts';
import { resolvePresence } from '../utils/presence';
interface StatusRecord {
    last_seen: string | null;
    deleted_at: string | null;
    visible: boolean;
}
export const usePresenceStore = defineStore('presence', () => {
    const auth = useAuthStore();
    const contacts = useContactsStore();
    const onlineIds = ref(new Set<string>());
    const pairOnlineIds = ref(new Set<string>());
    const records = ref<Record<string, StatusRecord>>({});
    const now = ref(Date.now());
    let globalChannel: RealtimeChannel | null = null;
    let pairChannel: RealtimeChannel | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let accountId: string | null = null;
    let generation = 0;
    const watched = new Map<string, number>();
    const requests = new Map<string, number>();
    const blockedReady = ref(false);
    const profileChannels = new Map<string, RealtimeChannel>();
    function statusFor(id: string) {
        const record = records.value[id];
        return resolvePresence({ id, deleted: !!record?.deleted_at, blocked: !blockedReady.value || contacts.blockedIds.has(id), visible: !!record?.visible, online: onlineIds.value.has(id) || pairOnlineIds.value.has(id), lastSeen: record?.last_seen, now: now.value });
    }
    async function refresh(id: string) {
        if (!accountId || !id || id.startsWith('sys:') || id === 'quietly_saved_notes_favorite')
            return;
        const epoch = generation;
        const request = (requests.get(id) || 0) + 1;
        requests.set(id, request);
        try {
            const { data, error } = await supabase.from('profiles').select('last_seen, online_visibility, deleted_at').eq('id', id).maybeSingle();
            if (error || !data)
                throw error || new Error('Profile not found');
            const visibility = data.online_visibility || 'all';
            const visible = visibility === 'all' || (visibility === 'contacts' && await rpcApi.inContactsOf(id));
            if (epoch !== generation || requests.get(id) !== request)
                return;
            records.value[id] = { last_seen: data.last_seen, deleted_at: data.deleted_at, visible };
        }
        catch (error) {
            if (epoch === generation && requests.get(id) === request)
                delete records.value[id];
            console.warn('[Presence] status lookup failed:', error);
        }
    }
    function watchUser(id: string) {
        watched.set(id, (watched.get(id) || 0) + 1);
        if (accountId && watched.get(id) === 1 && !id.startsWith('sys:') && id !== 'quietly_saved_notes_favorite') {
            const channel = supabase.channel(`profile-status-${id}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${id}` }, () => {
                delete records.value[id];
                void refresh(id);
            }).subscribe();
            profileChannels.set(id, channel);
        }
        void refresh(id);
    }
    function unwatchUser(id: string) {
        const count = watched.get(id) || 0;
        if (count <= 1) {
            watched.delete(id);
            const channel = profileChannels.get(id);
            if (channel)
                void supabase.removeChannel(channel);
            profileChannels.delete(id);
        }
        else
            watched.set(id, count - 1);
    }
    async function updateOwnPresence() {
        const channels = [globalChannel, pairChannel].filter((channel): channel is RealtimeChannel => !!channel);
        await Promise.allSettled(channels.map(channel => auth.profile?.online_visibility === 'nobody' ? channel.untrack() : channel.track({ online_at: new Date().toISOString() })));
    }
    async function writeLastSeen() {
        if (!accountId || auth.authScreen !== 'logged_in')
            return;
        const id = accountId;
        const timestamp = new Date().toISOString();
        try {
            const { error } = await tablesApi.profiles.updateLastSeen(id, timestamp);
            if (error)
                console.warn('[Presence] last seen:', error);
        }
        catch (error) {
            console.warn('[Presence] last seen:', error);
        }
    }
    function onVisibilityChange() { void writeLastSeen(); }
    function setPairChannel(channel: RealtimeChannel | null) {
        pairChannel = channel;
        pairOnlineIds.value = new Set();
    }
    function syncPair(channel: RealtimeChannel) {
        if (channel !== pairChannel)
            return;
        pairOnlineIds.value = new Set(Object.keys(channel.presenceState()));
        for (const id of watched.keys())
            void refresh(id);
    }
    function stop() {
        generation++;
        if (interval)
            clearInterval(interval);
        interval = null;
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('pagehide', onVisibilityChange);
        if (globalChannel)
            void supabase.removeChannel(globalChannel);
        for (const channel of profileChannels.values())
            void supabase.removeChannel(channel);
        profileChannels.clear();
        globalChannel = null;
        pairChannel = null;
        accountId = null;
        blockedReady.value = false;
        onlineIds.value = new Set();
        pairOnlineIds.value = new Set();
        records.value = {};
        watched.clear();
        requests.clear();
    }
    async function refreshBlocked(id: string, epoch: number) {
        try {
            const { data, error } = await tablesApi.blockedUsers.loadBlocked(id);
            if (error)
                throw error;
            if (epoch !== generation)
                return;
            contacts.blockedIds = new Set((data || []).map((row: {
                blocked_id: string;
            }) => row.blocked_id));
            blockedReady.value = true;
        }
        catch (error) {
            if (epoch === generation)
                blockedReady.value = false;
            console.warn('[Presence] blocked users:', error);
        }
    }
    async function start(id: string) {
        if (accountId === id)
            return;
        stop();
        accountId = id;
        const epoch = generation;
        await refreshBlocked(id, epoch);
        if (epoch !== generation)
            return;
        const channel = supabase.channel('online-users', { config: { presence: { key: id } } });
        globalChannel = channel;
        channel.on('presence', { event: 'sync' }, () => {
            if (channel !== globalChannel)
                return;
            onlineIds.value = new Set(Object.keys(channel.presenceState()));
            for (const watchedId of watched.keys())
                void refresh(watchedId);
        }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${id}` }, (event) => {
            const visibility = event.new.online_visibility;
            if (auth.profile && (visibility === 'all' || visibility === 'contacts' || visibility === 'nobody'))
                auth.profile.online_visibility = visibility;
        }).subscribe(status => {
            if (status === 'SUBSCRIBED' && channel === globalChannel && auth.profile?.online_visibility !== 'nobody')
                void channel.track({ online_at: new Date().toISOString() });
            if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && channel === globalChannel)
                onlineIds.value = new Set();
        });
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('pagehide', onVisibilityChange);
        void writeLastSeen();
        interval = setInterval(() => {
            now.value = Date.now();
            void refreshBlocked(id, epoch);
            void writeLastSeen();
            for (const watchedId of watched.keys())
                void refresh(watchedId);
        }, 30000);
    }
    return { onlineIds, pairOnlineIds, statusFor, watchUser, unwatchUser, refresh, start, stop, updateOwnPresence, writeLastSeen, setPairChannel, syncPair };
});
