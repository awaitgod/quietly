import { storageApi } from '../services/supabase';
export function stickerUrl(value: string): string {
    if (/^https?:\/\//i.test(value))
        return value;
    if (value.startsWith('stickers/'))
        return `${import.meta.env.BASE_URL}${value}`;
    return storageApi.stickers.getPublicUrl(value);
}
export function isVideoSticker(value: string): boolean { return /\.(mp4|webm)(?:[?#]|$)/i.test(value); }
export function stickerForPartner(id: string): string {
    let hash = 0;
    for (const c of id)
        hash = ((hash * 31) + c.codePointAt(0)!) >>> 0;
    return `stickers/emoji_${hash % 6 + 1}.webp`;
}
