import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase, tablesApi, rpcApi } from '../services/supabase';
import type { UserContact, UserProfile, Group } from '../types';
import { useAuthStore } from './auth';
export const useContactsStore = defineStore('contacts', () => {
    const authStore = useAuthStore();
    const contacts = ref<UserContact[]>([]);
    const frequentContacts = ref<UserProfile[]>([]);
    const blockedIds = ref<Set<string>>(new Set());
    const recentSearches = ref<any[]>([]);
    const isSearching = ref(false);
    const searchResultsUsers = ref<UserProfile[]>([]);
    const searchResultsGroups = ref<Group[]>([]);
    async function loadContacts() {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        try {
            const { data, error } = await tablesApi.userContacts.loadContacts(myId);
            if (error)
                throw error;
            if (data && data.length > 0) {
                const contactIds = data.map((c: any) => c.contact_id);
                const { data: profs } = await tablesApi.profiles.getByIds(contactIds);
                const profMap = new Map<string, UserProfile>();
                profs?.forEach((p: any) => profMap.set(p.id, p as UserProfile));
                contacts.value = data.map((row: any) => ({
                    owner_id: row.owner_id || myId,
                    contact_id: row.contact_id,
                    alias_name: row.alias_name,
                    alias_avatar: row.alias_avatar,
                    name: row.alias_name,
                    custom_avatar_url: row.alias_avatar,
                    id: row.contact_id,
                    user_id: myId,
                    profile: profMap.get(row.contact_id),
                }));
            }
            else {
                contacts.value = [];
            }
        }
        catch (err) {
            console.error('[Contacts] loadContacts error:', err);
        }
    }
    async function saveContact(contactId: string, aliasName: string, aliasAvatar?: string | null) {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        const { error } = await tablesApi.userContacts.upsertContact({
            owner_id: myId,
            contact_id: contactId,
            alias_name: aliasName,
            alias_avatar: aliasAvatar || null,
        });
        if (error)
            throw error;
        await loadContacts();
    }
    async function deleteContact(contactId: string) {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        const { error } = await tablesApi.userContacts.deleteContact(myId, contactId);
        if (error)
            throw error;
        contacts.value = contacts.value.filter((c) => c.contact_id !== contactId);
    }
    async function checkInContactsOf(ownerId: string): Promise<boolean> {
        try {
            return await rpcApi.inContactsOf(ownerId);
        }
        catch (err) {
            console.warn('[Contacts] checkInContactsOf error:', err);
            return false;
        }
    }
    async function loadBlockedUsers() {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        try {
            const { data, error } = await tablesApi.blockedUsers.loadBlocked(myId);
            if (error)
                throw error;
            blockedIds.value = new Set(data?.map((r: any) => r.blocked_id) || []);
        }
        catch (err) {
            console.error('[Contacts] loadBlockedUsers error:', err);
        }
    }
    async function blockUser(blockedId: string) {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        const { error } = await tablesApi.blockedUsers.block(myId, blockedId);
        if (error)
            throw error;
        blockedIds.value.add(blockedId);
    }
    async function unblockUser(blockedId: string) {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        const { error } = await tablesApi.blockedUsers.unblock(myId, blockedId);
        if (error)
            throw error;
        blockedIds.value.delete(blockedId);
    }
    async function loadFrequentContacts() {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        try {
            const { data } = await supabase
                .from('messages')
                .select('receiver_id, sender_id')
                .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
                .order('created_at', { ascending: false })
                .limit(100);
            if (data) {
                const counts: Record<string, number> = {};
                data.forEach((m) => {
                    const partner = m.sender_id === myId ? m.receiver_id : m.sender_id;
                    if (partner) {
                        counts[partner] = (counts[partner] || 0) + 1;
                    }
                });
                const sortedIds = Object.keys(counts)
                    .sort((a, b) => counts[b] - counts[a])
                    .slice(0, 8);
                if (sortedIds.length > 0) {
                    const { data: profs } = await tablesApi.profiles.getByIds(sortedIds);
                    if (profs) {
                        frequentContacts.value = profs as UserProfile[];
                    }
                }
            }
        }
        catch (err) {
            console.error('[Contacts] loadFrequentContacts error:', err);
        }
    }
    let searchSequence = 0;
    async function search(query: string) {
        const seq = ++searchSequence;
        const q = query.trim().toLowerCase().replace(/^@/, '');
        if (!q) {
            searchResultsUsers.value = [];
            searchResultsGroups.value = [];
            isSearching.value = false;
            return;
        }
        isSearching.value = true;
        try {
            const myId = authStore.user?.id || '';
            const { data: users } = await tablesApi.profiles.searchByUsername(q, myId, 15);
            const { data: groupsData } = await tablesApi.groups.searchPublic(q, 10);
            if (seq !== searchSequence)
                return;
            searchResultsUsers.value = (users as UserProfile[]) || [];
            searchResultsGroups.value = (groupsData as Group[]) || [];
        }
        catch (err) {
            console.error('[Contacts] search error:', err);
        }
        finally {
            if (seq === searchSequence)
                isSearching.value = false;
        }
    }
    function addRecentSearch(item: any) {
        recentSearches.value = [item, ...recentSearches.value.filter((x) => x.id !== item.id)].slice(0, 10);
    }
    function removeRecentSearch(id: string) {
        recentSearches.value = recentSearches.value.filter((x) => x.id !== id);
    }
    function clearRecentSearches() {
        recentSearches.value = [];
    }
    return {
        contacts,
        frequentContacts,
        blockedIds,
        recentSearches,
        isSearching,
        searchResultsUsers,
        searchResultsGroups,
        loadContacts,
        saveContact,
        deleteContact,
        checkInContactsOf,
        loadBlockedUsers,
        blockUser,
        unblockUser,
        loadFrequentContacts,
        search,
        addRecentSearch,
        removeRecentSearch,
        clearRecentSearches,
    };
});
