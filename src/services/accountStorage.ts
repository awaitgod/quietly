import type { UserProfile } from '../types';
const ACTIVE_KEY = 'quietly_active_account_slot';
const ACCOUNTS_KEY = 'quietly_accounts';
const DEFAULT_STORAGE_KEY = 'sb-csgpzwbqcguhzkklhguo-auth-token';
export interface SavedAccount {
    slot: string;
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    email: string;
}
export function activeAccountSlot(): string { return localStorage.getItem(ACTIVE_KEY) || 'default'; }
export function accountSessionKey(slot = activeAccountSlot()): string { return slot === 'default' ? DEFAULT_STORAGE_KEY : `${DEFAULT_STORAGE_KEY}-${slot}`; }
export function pendingAuthKey(): string { const slot = activeAccountSlot(); return slot === 'default' ? 'auth_flow_pending' : `auth_flow_pending_${slot}`; }
export function savedAccounts(): SavedAccount[] {
    try {
        const data = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
        return Array.isArray(data) ? data.filter(a => a && typeof a.slot === 'string' && typeof a.id === 'string' && typeof a.name === 'string' && typeof a.email === 'string') : [];
    }
    catch {
        return [];
    }
}
export function rememberAccount(profile: UserProfile, email: string) {
    const slot = activeAccountSlot();
    const entry: SavedAccount = { slot, id: profile.id, name: profile.name, username: profile.username, avatarUrl: profile.avatar_url || null, email };
    const accounts = savedAccounts().filter(a => a.slot !== slot && a.id !== entry.id);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, entry]));
}
export function removeAccount(slot: string) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(savedAccounts().filter(account => account.slot !== slot)));
    localStorage.removeItem(accountSessionKey(slot));
    localStorage.removeItem(`${accountSessionKey(slot)}-code-verifier`);
    localStorage.removeItem(slot === 'default' ? 'auth_flow_pending' : `auth_flow_pending_${slot}`);
}
export function selectAccountSlot(slot: string) { localStorage.setItem(ACTIVE_KEY, slot); }
export function newAccountSlot(): string { return crypto.randomUUID(); }
