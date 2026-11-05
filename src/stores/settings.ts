import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { UserProfile } from '../types';
export type NavPane = 'dm' | 'search' | 'contacts' | 'settings' | 'profile' | 'user' | 'edit-profile';
export type SettingsView = 'main' | 'security' | 'devices' | 'look' | 'badges' | 'admin' | 'about';
export const useSettingsStore = defineStore('settings', () => {
    const currentPane = ref<NavPane>('dm');
    const settingsSubView = ref<SettingsView>('main');
    const isDesktopMenuOpen = ref(false);
    const theme = ref<'dark' | 'light'>('dark');
    const viewedUser = ref<UserProfile | null>(null);
    const doubleTapEmoji = ref('❤️');
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
        initTheme,
        toggleTheme,
        setTheme,
        setPane,
        openUserProfile,
        openGroupInfo,
        setDoubleTapEmoji,
    };
});
