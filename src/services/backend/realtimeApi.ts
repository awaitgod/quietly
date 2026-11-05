import { supabase } from '../supabase';
export const realtimeApi = {
    channelMessages: (userId: string) => supabase.channel(`messages-${userId}`),
    channelFavorites: (userId: string) => supabase.channel(`quietly-favorites-${userId}`),
    channelOnlineUsers: () => supabase.channel('online-users'),
    channelPairPresence: (userIdA: string, userIdB: string) => {
        const [minId, maxId] = [userIdA, userIdB].sort();
        return supabase.channel(`presence-${minId}-${maxId}`, { config: { presence: { key: userIdA } } });
    },
    channelTypingInbox: (userId: string) => supabase.channel(`typing-inbox-${userId}`),
    channelMeLive: (userId: string) => supabase.channel(`me-live-${userId}`),
    channelGroup: (groupId: string | number) => supabase.channel(`grp:${groupId}`),
    channelGroupList: (userId: string) => supabase.channel(`grp-list-${userId}`),
};
