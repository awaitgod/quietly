import { supabase } from '../supabase';
export const storageApi = {
    avatars: {
        uploadUserAvatar: (userId: string, blob: Blob) => {
            const path = `${userId}/avatar_${Date.now()}.jpg`;
            return supabase.storage.from('avatars').upload(path, blob, {
                upsert: true,
                contentType: 'image/jpeg',
            });
        },
        uploadContactAvatar: (userId: string, blob: Blob) => {
            const path = `${userId}/contact_${Date.now()}.jpg`;
            return supabase.storage.from('avatars').upload(path, blob, {
                upsert: true,
                contentType: 'image/jpeg',
            });
        },
        uploadGroupAvatar: (userId: string, blob: Blob) => {
            const path = `${userId}/group_${Date.now()}.jpg`;
            return supabase.storage.from('avatars').upload(path, blob, {
                upsert: true,
                contentType: 'image/jpeg',
            });
        },
        getPublicUrl: (path: string) => supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl,
    },
    stickers: {
        uploadSticker: (userId: string, file: Blob | File, ext = 'webp', mimeType = 'image/webp') => {
            const rand = Math.random().toString(36).slice(2, 8);
            const path = `${userId}/${Date.now()}_0_${rand}.${ext}`;
            return supabase.storage.from('stickers').upload(path, file, {
                contentType: mimeType,
                cacheControl: '31536000',
            });
        },
        getPublicUrl: (path: string) => supabase.storage.from('stickers').getPublicUrl(path).data.publicUrl,
    },
    tracks: {
        uploadAudio: (userId: string, trackId: string, audioBlob: Blob, ext = 'mp3', mimeType = 'audio/mpeg') => {
            const path = `${userId}/${trackId}.${ext}`;
            return supabase.storage.from('tracks').upload(path, audioBlob, {
                contentType: mimeType,
                cacheControl: '31536000',
            });
        },
        uploadCover: (userId: string, trackId: string, coverBlob: Blob) => {
            const path = `${userId}/${trackId}.jpg`;
            return supabase.storage.from('tracks').upload(path, coverBlob, {
                contentType: 'image/jpeg',
            });
        },
        copyTrack: (sourcePath: string, destPath: string) => supabase.storage.from('tracks').copy(sourcePath, destPath),
        removeFiles: (paths: string[]) => supabase.storage.from('tracks').remove(paths),
        getPublicUrl: (path: string) => supabase.storage.from('tracks').getPublicUrl(path).data.publicUrl,
    },
};
