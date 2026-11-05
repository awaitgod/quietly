import { createClient } from '@supabase/supabase-js';
import { accountSessionKey } from './accountStorage';
export const SUPABASE_URL = 'https://csgpzwbqcguhzkklhguo.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_1KaF6XrktOXtDOMVfs5RyA_L2uFqmtM';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: localStorage,
        storageKey: accountSessionKey(),
    },
});
export const FAV_ID = 'quietly_saved_notes_favorite';
export const FAV_PROFILE = {
    id: FAV_ID,
    name: 'Избранное',
    username: 'saved',
    avatar_url: null,
};
export const OFFICIAL_PACKS = [
    { id: 'welcome', title: 'Эмоджи', items: Array.from({ length: 6 }, (_, i) => `stickers/emoji_${i + 1}.webp`) },
    { id: 'frog', title: 'Лягушка', items: ['stickers/fromg_agadbdmaaqo18uk.webp', 'stickers/fromg_agadmzeaahnrus.webp', 'stickers/fromg_agadptmaagh6oeo.webp', 'stickers/fromg_agadujsaaol82us.webp', 'stickers/fromg_agadvteaakpl2eo.webp'] },
    { id: 'banana', title: 'Бананчик', items: ['stickers/bananafun_agad5giaarvx2gy.webp', 'stickers/bananafun_agad6qiaarvx2gy.webp', 'stickers/bananafun_agad8aiaarvx2gy.webp', 'stickers/bananafun_agad9wiaarvx2gy.webp'] },
];
export const EMOJI_CATEGORIES = [
    {
        title: 'Смайлы и эмоции',
        icon: '😀',
        list: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '🥹', '☺️', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😮‍💨', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🫣', '🤗', '🫡', '🤔', '🫢', '🤫', '🤥', '😶', '😐', '😑', '😬', '🫨', '🫠', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕']
    },
    {
        title: 'Жесты и люди',
        icon: '👋',
        list: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️', '🫰', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🫀', '🫁', '🧠', '🫱‍🫲']
    },
    {
        title: 'Сердца и символы',
        icon: '❤️',
        list: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '🔥', '✨', '🌟', '💫', '💥', '💢', '💯', '💤', '💭', '💬', '🗨️']
    }
];
export const REACTIONS = ['👍', '👎', '❤️', '🔥', '🎉', '😢', '😂', '😮'];
export const MORE_REACTIONS = ['👏', '🥰', '🤔', '🤯', '😱', '🤬', '🤮', '💩', '🙏', '👌', '🤝', '💯', '✨', '⚡', '💔', '🕊️'];
export * from './backendApi';
