import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { tablesApi, storageApi } from '../services/supabase';
import type { AudioTrack } from '../types';
import { useAuthStore } from './auth';
export const useAudioStore = defineStore('audio', () => {
    const authStore = useAuthStore();
    const tracks = ref<AudioTrack[]>([]);
    const currentTrackIndex = ref<number>(-1);
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const isPlayerModalOpen = ref(false);
    const isUploadModalOpen = ref(false);
    const isNowPlayingStripVisible = ref(false);
    const audio = new Audio();
    audio.preload = 'metadata';
    const currentTrack = computed(() => {
        if (currentTrackIndex.value >= 0 && currentTrackIndex.value < tracks.value.length) {
            return tracks.value[currentTrackIndex.value];
        }
        return null;
    });
    const currentTrackIsFavorite = computed(() => !!currentTrack.value && tracks.value.some(track => !track.transient && track.audio_url === currentTrack.value?.audio_url && track.is_favorite));
    watch(() => authStore.user?.id, (id, previous) => {
        if (id === previous) return;
        audio.pause();
        audio.removeAttribute('src');
        tracks.value = [];
        currentTrackIndex.value = -1;
        isNowPlayingStripVisible.value = false;
        currentTime.value = 0;
        duration.value = 0;
    });
    function formatTime(s: number): string {
        const secs = Math.max(0, Math.floor(s || 0));
        const m = Math.floor(secs / 60);
        const rem = secs % 60;
        return `${m}:${rem.toString().padStart(2, '0')}`;
    }
    audio.addEventListener('play', () => {
        isPlaying.value = true;
        isNowPlayingStripVisible.value = true;
    });
    audio.addEventListener('pause', () => {
        isPlaying.value = false;
    });
    audio.addEventListener('timeupdate', () => {
        currentTime.value = audio.currentTime || 0;
    });
    audio.addEventListener('loadedmetadata', () => {
        duration.value = audio.duration || 0;
    });
    audio.addEventListener('ended', () => {
        nextTrack();
    });
    async function loadTracks() {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        try {
            const { data, error } = await tablesApi.userTracks.loadMyTracks(myId);
            if (error)
                throw error;
            if (data) {
                if (authStore.user?.id !== myId) return;
                const current = currentTrack.value;
                const saved = data as AudioTrack[];
                const temporary = tracks.value.filter(track => track.transient && !saved.some(item => item.audio_url === track.audio_url));
                tracks.value = [...saved, ...temporary];
                currentTrackIndex.value = current ? tracks.value.findIndex(track => track.audio_url === current.audio_url) : -1;
            }
        }
        catch (err) {
            console.error('[Audio] loadTracks error:', err);
        }
    }
    async function loadUserFavoriteTrack(targetUserId: string): Promise<AudioTrack | null> {
        try {
            const { data, error } = await tablesApi.userTracks.loadFavoriteTrack(targetUserId);
            if (error)
                throw error;
            return (data?.[0] as AudioTrack) || null;
        }
        catch (err) {
            console.warn('[Audio] loadUserFavoriteTrack error:', err);
            return null;
        }
    }
    function playTrack(item: number | AudioTrack) {
        let index: number;
        if (typeof item === 'number') {
            index = item;
        }
        else {
            index = tracks.value.findIndex((t) => t.id === item.id);
        }
        if (index < 0 || index >= tracks.value.length)
            return;
        currentTrackIndex.value = index;
        const track = tracks.value[index];
        audio.src = track.audio_url;
        audio.play().catch((err) => console.warn('[Audio] play error:', err));
        isNowPlayingStripVisible.value = true;
    }
    function togglePlay() {
        if (!currentTrack.value) {
            if (tracks.value.length > 0) {
                playTrack(0);
            }
            return;
        }
        if (isPlaying.value) {
            audio.pause();
        }
        else {
            audio.play().catch((err) => console.warn('[Audio] resume error:', err));
        }
    }
    function seek(seconds: number) {
        audio.currentTime = seconds;
        currentTime.value = seconds;
    }
    function nextTrack() {
        if (tracks.value.length === 0)
            return;
        const nextIdx = (currentTrackIndex.value + 1) % tracks.value.length;
        playTrack(nextIdx);
    }
    function prevTrack() {
        if (tracks.value.length === 0)
            return;
        const prevIdx = (currentTrackIndex.value - 1 + tracks.value.length) % tracks.value.length;
        playTrack(prevIdx);
    }
    function stopNowPlaying() {
        audio.pause();
        audio.currentTime = 0;
        isNowPlayingStripVisible.value = false;
    }
    async function toggleFavoriteTrack(track: AudioTrack) {
        if (!authStore.user?.id)
            throw new Error('Войдите в аккаунт');
        const myId = authStore.user.id;
        const url = track.audio_url;
        try {
            let saved = tracks.value.find(item => !item.transient && item.user_id === myId && item.audio_url === url);
            if (!saved) {
                const { data, error } = await tablesApi.userTracks.addTrack({
                    id: crypto.randomUUID(), user_id: myId, title: track.title, artist: track.artist,
                    duration: track.duration || 0, audio_path: '', audio_url: url,
                    cover_path: null, cover_url: track.cover_url || null,
                });
                if (error) throw error;
                if (!data) throw new Error('Не удалось сохранить аудиозапись');
                saved = data as AudioTrack;
            }
            if (authStore.user?.id !== myId) throw new Error('Аккаунт изменился');
            const result = saved.is_favorite
                ? await tablesApi.userTracks.clearFavorite(myId, saved.id)
                : await tablesApi.userTracks.setFavorite(myId, saved.id);
            if (result.error) throw result.error;
            if (!result.data) throw new Error('Сервер не подтвердил изменение');
            if (authStore.user?.id !== myId) return;
            const currentUrl = currentTrack.value?.audio_url;
            const updated = result.data as AudioTrack;
            tracks.value = tracks.value
                .filter(item => item.id !== updated.id && !(item.transient && item.audio_url === updated.audio_url))
                .map(item => updated.is_favorite ? { ...item, is_favorite: false } : item);
            tracks.value.push(updated);
            currentTrackIndex.value = currentUrl ? tracks.value.findIndex(item => item.audio_url === currentUrl) : -1;
            await loadTracks();
        }
        catch (err) {
            console.error('[Audio] toggleFavoriteTrack error:', err);
            await loadTracks();
            throw err;
        }
    }
    async function uploadTrack(title: string, artist: string, audioFile: File, coverFile?: File) {
        if (!authStore.user?.id)
            throw new Error('No user');
        const myId = authStore.user.id;
        const trackId = crypto.randomUUID();
        const ext = audioFile.name.split('.').pop() || 'mp3';
        const audioPath = `${myId}/${trackId}.${ext}`;
        let coverPath: string | null = null;
        let coverUrl: string | null = null;
        const { error: aErr } = await storageApi.tracks.uploadAudio(myId, trackId, audioFile, ext, audioFile.type || 'audio/mpeg');
        if (aErr)
            throw aErr;
        const audioUrl = storageApi.tracks.getPublicUrl(audioPath);
        if (coverFile) {
            coverPath = `${myId}/${trackId}.jpg`;
            const { error: cErr } = await storageApi.tracks.uploadCover(myId, trackId, coverFile);
            if (!cErr) {
                coverUrl = storageApi.tracks.getPublicUrl(coverPath);
            }
        }
        const { data, error } = await tablesApi.userTracks.addTrack({
            id: trackId,
            user_id: myId,
            title,
            artist,
            duration: duration.value || 0,
            audio_path: audioPath,
            audio_url: audioUrl,
            cover_path: coverPath,
            cover_url: coverUrl,
        });
        if (error)
            throw error;
        if (data) {
            tracks.value.push(data as unknown as AudioTrack);
        }
        else {
            await loadTracks();
        }
    }
    async function deleteTrack(track: AudioTrack) {
        try {
            await tablesApi.userTracks.deleteTrack(track.id);
            const toRemove = track.audio_path ? [track.audio_path] : [];
            if (track.cover_path)
                toRemove.push(track.cover_path);
            if (toRemove.length) await storageApi.tracks.removeFiles(toRemove);
            tracks.value = tracks.value.filter((t) => t.id !== track.id);
        }
        catch (err) {
            console.error('[Audio] deleteTrack error:', err);
        }
    }
    async function copyTrack(sourceTrack: AudioTrack) {
        if (!authStore.user?.id)
            return;
        const myId = authStore.user.id;
        const newId = crypto.randomUUID();
        const ext = sourceTrack.audio_path.split('.').pop() || 'mp3';
        const destAudioPath = `${myId}/${newId}.${ext}`;
        try {
            await storageApi.tracks.copyTrack(sourceTrack.audio_path, destAudioPath);
            const destAudioUrl = storageApi.tracks.getPublicUrl(destAudioPath);
            let destCoverPath: string | null = null;
            let destCoverUrl: string | null = null;
            if (sourceTrack.cover_path) {
                destCoverPath = `${myId}/${newId}.jpg`;
                await storageApi.tracks.copyTrack(sourceTrack.cover_path, destCoverPath);
                destCoverUrl = storageApi.tracks.getPublicUrl(destCoverPath);
            }
            await tablesApi.userTracks.addTrack({
                id: newId,
                user_id: myId,
                title: sourceTrack.title,
                artist: sourceTrack.artist,
                duration: sourceTrack.duration,
                audio_path: destAudioPath,
                audio_url: destAudioUrl,
                cover_path: destCoverPath,
                cover_url: destCoverUrl,
                src_id: sourceTrack.id,
            });
            await loadTracks();
        }
        catch (err) {
            console.error('[Audio] copyTrack error:', err);
        }
    }
    return {
        tracks,
        currentTrackIndex,
        currentTrack,
        currentTrackIsFavorite,
        isPlaying,
        currentTime,
        duration,
        isPlayerModalOpen,
        isUploadModalOpen,
        isNowPlayingStripVisible,
        formatTime,
        loadTracks,
        loadUserFavoriteTrack,
        playTrack,
        togglePlay,
        seek,
        nextTrack,
        prevTrack,
        stopNowPlaying,
        toggleFavoriteTrack,
        uploadTrack,
        deleteTrack,
        copyTrack,
    };
});
