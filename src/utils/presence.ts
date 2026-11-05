export interface PresenceStatus {
    text: string;
    online: boolean;
}
export function formatLastSeen(lastSeen: string | null | undefined, now = Date.now()): string {
    if (!lastSeen)
        return 'Был(а) недавно';
    const timestamp = new Date(lastSeen).getTime();
    if (!Number.isFinite(timestamp))
        return 'Был(а) недавно';
    const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
    if (minutes < 1)
        return 'Был(а) только что';
    if (minutes < 60)
        return `Был(а) ${minutes} мин. назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `Был(а) ${hours} ч. назад`;
    return `Был(а) ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', ...(new Date(timestamp).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' as const } : {}) }).format(timestamp)}`;
}
export function resolvePresence(options: {
    id: string;
    deleted?: boolean;
    blocked?: boolean;
    visible?: boolean;
    online?: boolean;
    lastSeen?: string | null;
    now?: number;
}): PresenceStatus {
    if (['sys:quietly', 'sys:favorites', 'quietly_saved_notes_favorite'].includes(options.id))
        return { text: 'Бот', online: false };
    if (options.deleted)
        return { text: '', online: false };
    if (options.blocked || !options.visible)
        return { text: 'Был(а) недавно', online: false };
    if (options.online)
        return { text: 'В сети', online: true };
    return { text: formatLastSeen(options.lastSeen, options.now), online: false };
}
