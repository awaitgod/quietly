import emojiRegex from 'emoji-regex';
import imageData from './apple-emoji-map.json';
const base = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/';
const images: Record<string, string> = imageData;
export function appleEmojiUrl(emoji: string): string | undefined {
    const key = Array.from(emoji, ch => ch.codePointAt(0)!.toString(16)).join('-');
    const image = images[key];
    return image ? base + image : undefined;
}
export function splitEmoji(text: string): {
    text: string;
    url?: string;
}[] {
    const result: {
        text: string;
        url?: string;
    }[] = [];
    let offset = 0;
    for (const match of text.matchAll(emojiRegex())) {
        const index = match.index!;
        if (index > offset)
            result.push({ text: text.slice(offset, index) });
        result.push({ text: match[0], url: appleEmojiUrl(match[0]) });
        offset = index + match[0].length;
    }
    if (offset < text.length)
        result.push({ text: text.slice(offset) });
    return result;
}
export function emojiHtml(escapedText: string): string {
    return escapedText.replace(emojiRegex(), emoji => {
        const url = appleEmojiUrl(emoji);
        return url ? `<img class="apple-emoji" src="${url}" alt="${emoji}" draggable="false">` : emoji;
    });
}
