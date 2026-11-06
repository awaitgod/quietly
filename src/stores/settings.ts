import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { UserProfile } from '../types';
export type NavPane = 'dm' | 'search' | 'contacts' | 'settings' | 'profile' | 'user' | 'edit-profile';
export type SettingsView = 'main' | 'security' | 'devices' | 'look' | 'badges' | 'admin' | 'about' | 'features';
export const useSettingsStore = defineStore('settings', () => {
    const currentPane = ref<NavPane>('dm');
    const settingsSubView = ref<SettingsView>('main');
    const isDesktopMenuOpen = ref(false);
    const theme = ref<'dark' | 'light'>('dark');
    const viewedUser = ref<UserProfile | null>(null);
    const doubleTapEmoji = ref('❤️');

    // Killer Feature: Шифрование сообщений по секретному ключу
    const encryptionEnabled = ref(false);
    const encryptionKey = ref('');

    // Предпросмотрщик изображений (аватарки, фото и т.д.)
    const previewImageSrc = ref<string | null>(null);
    const previewImageTitle = ref<string>('');

    function openImagePreview(src: string, title: string = '') {
        previewImageSrc.value = src;
        previewImageTitle.value = title;
    }

    function closeImagePreview() {
        previewImageSrc.value = null;
        previewImageTitle.value = '';
    }

    function initTheme() {
        const saved = localStorage.getItem('quietly_theme') as 'dark' | 'light' | null;
        if (saved === 'light' || saved === 'dark') {
            theme.value = saved;
        }
        else {
            theme.value = 'dark';
        }
        document.documentElement.setAttribute('data-theme', theme.value);
        const savedEmoji = localStorage.getItem('quietly_dt_emoji');
        if (savedEmoji !== null) {
            doubleTapEmoji.value = savedEmoji;
        }

        const savedEncEnabled = localStorage.getItem('quietly_encryption_enabled');
        if (savedEncEnabled !== null) {
            encryptionEnabled.value = savedEncEnabled === 'true';
        }
        const savedEncKey = localStorage.getItem('quietly_encryption_key');
        if (savedEncKey !== null) {
            encryptionKey.value = savedEncKey;
        }
    }

    function setEncryptionEnabled(enabled: boolean) {
        encryptionEnabled.value = enabled;
        localStorage.setItem('quietly_encryption_enabled', String(enabled));
    }

    function setEncryptionKey(key: string) {
        encryptionKey.value = key;
        localStorage.setItem('quietly_encryption_key', key);
    }
    function setDoubleTapEmoji(emoji: string | null) {
        doubleTapEmoji.value = emoji || '';
        if (emoji) {
            localStorage.setItem('quietly_dt_emoji', emoji);
        }
        else {
            localStorage.removeItem('quietly_dt_emoji');
        }
    }
    function setTheme(value: 'dark' | 'light') {
        theme.value = value;
        localStorage.setItem('quietly_theme', theme.value);
        document.documentElement.setAttribute('data-theme', theme.value);
    }
    function toggleTheme() { setTheme(theme.value === 'dark' ? 'light' : 'dark'); }
    function setPane(pane: NavPane) {
        currentPane.value = pane;
        isDesktopMenuOpen.value = false;
        if (pane === 'settings') {
            settingsSubView.value = 'main';
        }
    }
    function openUserProfile(user: UserProfile) {
        viewedUser.value = user;
        currentPane.value = 'user';
    }
    function openGroupInfo() {
        viewedUser.value = null;
        currentPane.value = 'user';
    }
    return {
        currentPane,
        settingsSubView,
        isDesktopMenuOpen,
        theme,
        viewedUser,
        doubleTapEmoji,
        encryptionEnabled,
        encryptionKey,
        previewImageSrc,
        previewImageTitle,
        openImagePreview,
        closeImagePreview,
        initTheme,
        toggleTheme,
        setTheme,
        setPane,
        openUserProfile,
        openGroupInfo,
        setDoubleTapEmoji,
        setEncryptionEnabled,
        setEncryptionKey,
    };
});
