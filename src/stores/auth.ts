import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase, authApi, rpcApi, tablesApi, externalApi } from '../services/supabase';
import type { UserProfile, UserDevice } from '../types';
import { activeAccountSlot, pendingAuthKey, rememberAccount, removeAccount } from '../services/accountStorage';
import { setLocalCacheAccount } from '../services/native/messages';
export function friendlyAuthError(e: any): string {
    const t = e?.message || '';
    const n = t.match(/after (\d+) seconds?/i);
    if (n)
        return `Подождите ${n[1]} сек. перед повторной отправкой кода.`;
    if (/security purposes/i.test(t))
        return 'Подождите минуту перед повторной отправкой кода.';
    if (/rate limit|too many/i.test(t))
        return 'Слишком много попыток. Подождите пару минут и попробуйте снова.';
    if (/failed to fetch|network|load failed/i.test(t))
        return 'Нет соединения с сервером. Проверьте интернет и попробуйте снова.';
    if (/banned/i.test(t))
        return 'Аккаунт заблокирован или удален.';
    if (/invalid/i.test(t) && /email/i.test(t))
        return 'Проверьте введённый email.';
    if (/invalid login credentials|invalid credentials/i.test(t))
        return 'Неверный пароль.';
    return t || 'Произошла ошибка при отправке запроса.';
}
export function getOrCreateDeviceId(): string {
    let devId = localStorage.getItem('quietly_device_id');
    if (!devId) {
        devId = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem('quietly_device_id', devId);
    }
    return devId;
}
export const useAuthStore = defineStore('auth', () => {
    const user = ref<any>(null);
    const profile = ref<UserProfile | null>(null);
    const isAdminUser = ref(false);
    const activeDevices = ref<UserDevice[]>([]);
    const isLoading = ref(true);
    const authScreen = ref<'boot' | 'email' | 'otp' | 'profile_setup' | 'password_set' | 'password_login' | 'forgot' | 'logged_in'>('boot');
    const emailDraft = ref('');
    const isExisting = ref(false);
    const otpDraft = ref('');
    const otpCountdown = ref(0);
    const authNotice = ref('');
    const profileDraft = ref<{
        name: string;
        username: string;
        avatar: Blob;
    } | null>(null);
    const recoveryRequested = ref(false);
    let timer: any = null;
    let heartbeatTimer: any = null;
    async function initAuth() {
        isLoading.value = true;
        try {
            const { data: { session }, error } = await authApi.getSession();
            if (error)
                throw error;
            if (session?.user) {
                user.value = session.user;
                emailDraft.value = session.user.email || '';
                await loadProfile(session.user.id);
                if (localStorage.getItem(pendingAuthKey()) === '1') {
                    if (profile.value) {
                        isExisting.value = true;
                        authScreen.value = 'password_login';
                    }
                    else {
                        await rpcApi.deleteIncompleteAccount();
                        await authApi.signOut({ scope: 'local' });
                        user.value = null;
                        localStorage.removeItem(pendingAuthKey());
                        authNotice.value = 'Регистрация не была завершена. Начните заново.';
                        authScreen.value = 'email';
                    }
                }
                else if (profile.value?.username) {
                    await routeAuthenticated(session);
                }
                else {
                    authScreen.value = 'profile_setup';
                }
            }
            else {
                localStorage.removeItem(pendingAuthKey());
                authScreen.value = 'email';
            }
        }
        catch (err) {
            console.error('[Auth] Init error:', err);
            authNotice.value = 'Не удалось проверить аккаунт. Проверьте соединение и попробуйте снова.';
            authScreen.value = 'email';
        }
        finally {
            isLoading.value = false;
        }
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                user.value = null;
                profile.value = null;
                isAdminUser.value = false;
                stopHeartbeat();
                authScreen.value = 'email';
            }
            else if (session?.user) {
                user.value = session.user;
            }
        });
    }
    async function loadProfile(userId: string) {
        const { data, error } = await tablesApi.profiles.getById(userId);
        if (error)
            throw error;
        profile.value = (data as UserProfile | null) ?? null;
    }
    async function routeAuthenticated(session?: any, notification?: 'welcome' | 'new_login') {
        if (!user.value?.id)
            throw new Error('Сессия не найдена. Войдите снова.');
        await loadProfile(user.value.id);
        if (!profile.value?.username)
            throw new Error('Профиль не найден.');
        if (profile.value.deleted_at || profile.value.banned_at) {
            authNotice.value = 'Аккаунт заблокирован или удален.';
            await authApi.signOut({ scope: 'local' });
            throw new Error(authNotice.value);
        }
        await syncDeviceSession(session);
        if (!user.value)
            throw new Error('Ваш сеанс был завершён на другом устройстве.');
        await checkAdminRole();
        if (notification) {
            try {
                const body = notification === 'welcome'
                    ? `Добро пожаловать в Quietly! ${user.value.email || ''}`.trim()
                    : 'Новый вход в аккаунт с устройства Quietly Desktop (Windows).';
                const { error } = await tablesApi.systemMessages.insert({ user_id: user.value.id, kind: notification, body });
                if (error)
                    console.warn('[Auth] system message:', error);
            }
            catch (error) {
                console.warn('[Auth] system message:', error);
            }
        }
        rememberAccount(profile.value, user.value.email || '');
        setLocalCacheAccount(user.value.id);
        localStorage.removeItem(pendingAuthKey());
        recoveryRequested.value = false;
        startHeartbeat();
        authScreen.value = 'logged_in';
    }
    async function syncDeviceSession(session?: any) {
        if (!user.value?.id)
            return;
        const myId = user.value.id;
        const devId = getOrCreateDeviceId();
        try {
            const { data: revokedCheck } = await tablesApi.userDevices.checkRevoked(myId, devId);
            if (revokedCheck?.revoked_at) {
                await logout();
                alert('Ваш сеанс был завершён на другом устройстве.');
                return;
            }
            const ip = await externalApi.fetchExternalIp();
            await tablesApi.userDevices.upsertDevice({
                user_id: myId,
                device_id: devId,
                name: 'Quietly Desktop (Windows)',
                kind: 'Компьютер',
                ua: navigator.userAgent || 'Quietly Desktop Windows 11',
                ip,
                session_id: session?.access_token?.slice(0, 36) || null,
                last_seen: new Date().toISOString(),
            });
        }
        catch (err) {
            console.warn('[Auth] syncDeviceSession error:', err);
        }
    }
    function startHeartbeat() {
        stopHeartbeat();
        heartbeatTimer = setInterval(async () => {
            if (!user.value?.id)
                return;
            const myId = user.value.id;
            const now = new Date().toISOString();
            try {
                await tablesApi.userDevices.updateLastSeen(myId, getOrCreateDeviceId(), now);
            }
            catch (e) {
            }
        }, 60000);
    }
    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }
    async function checkAdminRole(): Promise<boolean> {
        try {
            const adm = await rpcApi.isAdmin();
            isAdminUser.value = adm;
            return adm;
        }
        catch {
            isAdminUser.value = false;
            return false;
        }
    }
    async function setMyBadge(badge: string) {
        await rpcApi.setMyBadge(badge);
        if (profile.value) {
            profile.value.badge = badge as any;
        }
    }
    async function setOnlineVisibility(visibility: 'all' | 'contacts' | 'nobody') {
        if (!user.value?.id)
            return;
        const { error } = await tablesApi.profiles.updateOnlineVisibility(user.value.id, visibility);
        if (error)
            throw error;
        if (profile.value) {
            profile.value.online_visibility = visibility;
        }
    }
    async function loadDevices() {
        if (!user.value?.id)
            return;
        try {
            const { data, error } = await tablesApi.userDevices.loadAllActive(user.value.id);
            if (error)
                throw error;
            activeDevices.value = (data as UserDevice[]) || [];
        }
        catch (err) {
            console.error('[Auth] loadDevices error:', err);
        }
    }
    async function revokeDevice(deviceId: string) {
        try {
            await rpcApi.revokeDeviceSession(deviceId);
            await loadDevices();
        }
        catch (err) {
            console.error('[Auth] revokeDevice error:', err);
        }
    }
    async function terminateOtherSessions() {
        if (!user.value?.id)
            return;
        const devId = getOrCreateDeviceId();
        try {
            await tablesApi.userDevices.terminateOthers(user.value.id, devId);
            await loadDevices();
        }
        catch (err) {
            console.error('[Auth] terminateOtherSessions error:', err);
        }
    }
    function startOtpTimer(seconds = 60) {
        otpCountdown.value = seconds;
        clearInterval(timer);
        timer = setInterval(() => {
            if (otpCountdown.value > 0) {
                otpCountdown.value--;
            }
            else {
                clearInterval(timer);
            }
        }, 1000);
    }
    async function checkEmailExists(email: string): Promise<boolean> {
        const exists = await rpcApi.emailExists(email);
        isExisting.value = exists;
        return exists;
    }
    async function sendOtp(email: string) {
        emailDraft.value = email.trim().toLowerCase();
        const { error } = await authApi.signInWithOtp(emailDraft.value, true);
        if (error)
            throw error;
        startOtpTimer();
        authScreen.value = 'otp';
    }
    async function changeEmail() {
        if (localStorage.getItem(pendingAuthKey()) === '1') {
            const { error } = await authApi.signOut({ scope: 'local' });
            if (error)
                throw error;
            localStorage.removeItem(pendingAuthKey());
            user.value = null;
            profile.value = null;
        }
        profileDraft.value = null;
        clearInterval(timer);
        otpCountdown.value = 0;
        recoveryRequested.value = false;
        authScreen.value = 'email';
    }
    async function beginRecovery() {
        if (localStorage.getItem(pendingAuthKey()) === '1' && user.value?.id && user.value.email?.toLowerCase() === emailDraft.value.toLowerCase()) {
            authScreen.value = 'forgot';
            return;
        }
        recoveryRequested.value = true;
        try {
            await sendOtp(emailDraft.value);
        }
        catch (error) {
            recoveryRequested.value = false;
            throw error;
        }
    }
    async function verifyOtp(token: string) {
        if (!/^\d{6}$/.test(token))
            throw new Error('Введите шестизначный код.');
        localStorage.setItem(pendingAuthKey(), '1');
        const { data, error } = await authApi.verifyOtp(emailDraft.value, token);
        if (error) {
            localStorage.removeItem(pendingAuthKey());
            throw error;
        }
        if (!data.user)
            throw new Error('Сессия не найдена. Попробуйте ещё раз.');
        user.value = data.user;
        await loadProfile(data.user.id);
        isExisting.value = !!profile.value;
        authScreen.value = profile.value ? (recoveryRequested.value ? 'forgot' : 'password_login') : 'profile_setup';
    }
    async function loginWithPassword(password: string) {
        const { data, error } = await authApi.signInWithPassword(emailDraft.value, password);
        if (error)
            throw error;
        if (!data.user)
            throw new Error('Не удалось войти в аккаунт.');
        user.value = data.user;
        await routeAuthenticated(data.session, 'new_login');
    }
    async function checkUsernameAvailable(username: string) {
        const [profiles, groups] = await Promise.all([
            tablesApi.profiles.checkUsername(username, user.value?.id),
            tablesApi.groups.checkUsername(username),
        ]);
        if (profiles.error)
            throw profiles.error;
        if (groups.error)
            throw groups.error;
        return !(profiles.data?.length || groups.data?.length);
    }
    async function saveProfileSetup(name: string, username: string, avatarBlob?: Blob) {
        if (!user.value?.id)
            throw new Error('Сессия не найдена. Войдите снова.');
        if (!avatarBlob)
            throw new Error('Выберите аватар.');
        if (!await checkUsernameAvailable(username))
            throw new Error('Этот юзернейм уже занят.');
        profileDraft.value = { name, username: username.toLowerCase(), avatar: avatarBlob };
        authScreen.value = 'password_set';
    }
    async function setInitialPassword(password: string) {
        if (!user.value?.id || !profileDraft.value)
            throw new Error('Данные профиля не найдены. Вернитесь к настройке профиля.');
        const draft = profileDraft.value;
        const { error } = await authApi.updatePassword(password);
        if (error)
            throw error;
        const path = `${user.value.id}/avatar_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, draft.avatar, { upsert: true, contentType: 'image/jpeg' });
        if (uploadError)
            throw uploadError;
        const avatar_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
        const { error: profileError } = await tablesApi.profiles.upsertProfile({ id: user.value.id, name: draft.name, username: draft.username, avatar_url });
        if (profileError)
            throw profileError;
        const { data: { session } } = await authApi.getSession();
        await routeAuthenticated(session, 'welcome');
        profileDraft.value = null;
    }
    async function resetPassword(password: string) {
        if (localStorage.getItem(pendingAuthKey()) !== '1' || !user.value?.id || !profile.value)
            throw new Error('Сначала подтвердите почту кодом.');
        const { error } = await authApi.updatePassword(password);
        if (error)
            throw error;
        const { data: { session } } = await authApi.getSession();
        await routeAuthenticated(session, 'new_login');
    }
    async function deleteIncompleteAccount() {
        await rpcApi.deleteIncompleteAccount();
        await logout();
    }
    async function deleteMyAccount() {
        await rpcApi.deleteMyAccount();
        await logout();
    }
    async function logout() {
        clearInterval(timer);
        localStorage.removeItem(pendingAuthKey());
        profileDraft.value = null;
        recoveryRequested.value = false;
        stopHeartbeat();
        if (user.value?.id) {
            try {
                await tablesApi.userDevices.deleteCurrent(user.value.id, getOrCreateDeviceId());
            }
            catch (e) {
            }
        }
        const { error } = await authApi.signOut({ scope: 'local' });
        if (error)
            throw error;
        removeAccount(activeAccountSlot());
        setLocalCacheAccount(null);
        user.value = null;
        profile.value = null;
        isAdminUser.value = false;
        authScreen.value = 'email';
    }
    return {
        user,
        profile,
        isAdminUser,
        activeDevices,
        isLoading,
        authScreen,
        emailDraft,
        isExisting,
        otpDraft,
        otpCountdown,
        authNotice,
        profileDraft,
        initAuth,
        loadProfile,
        checkEmailExists,
        sendOtp,
        verifyOtp,
        beginRecovery,
        resetPassword,
        changeEmail,
        checkUsernameAvailable,
        loginWithPassword,
        saveProfileSetup,
        setInitialPassword,
        setMyBadge,
        setOnlineVisibility,
        loadDevices,
        revokeDevice,
        terminateOtherSessions,
        deleteIncompleteAccount,
        deleteMyAccount,
        logout,
        startOtpTimer,
    };
});
