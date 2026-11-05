export interface UserProfile {
    id: string;
    name: string;
    username: string;
    avatar_url?: string | null;
    bio?: string | null;
    description?: string | null;
    about?: string | null;
    qcoin?: number;
    online_visibility?: 'all' | 'contacts' | 'nobody';
    last_seen?: string | null;
    verified?: boolean;
    badge?: 'verified' | 'admin' | 'tester' | 'supporter' | 'first' | 'rich' | 'none';
    badges?: string[] | null;
    deleted_at?: string | null;
    banned_at?: string | null;
    banned?: boolean;
    created_at?: string;
    theme?: 'dark' | 'light';
    double_tap_reaction?: string;
    updated_at?: string;
    is_banned?: boolean;
}
export interface MessageReactionItem {
    emoji: string;
    user_id: string;
    created_at?: string;
}
export interface Message {
    id: string | number;
    sender_id: string;
    receiver_id?: string;
    content: string;
    reply_to?: string | number | null;
    pinned_at?: string | null;
    edited_at?: string | null;
    read_at?: string | null;
    reactions?: Record<string, string> | MessageReactionItem[] | null;
    deleted_for_all?: boolean;
    deleted_for?: string[] | null;
    created_at: string;
    chat_id?: string;
    is_read?: boolean;
    is_favorite?: boolean;
    status?: 'sending' | 'sent' | 'read' | 'error';
    reply_message?: Message | null;
    sender_profile?: UserProfile | null;
}
export interface Group {
    id: string;
    name: string;
    username?: string | null;
    avatar_url?: string | null;
    owner_id: string;
    is_public: boolean;
    no_forward?: boolean;
    history_visible?: boolean;
    allowed_reactions?: string[] | null;
    created_at: string;
    updated_at?: string;
    members_count?: number;
    last_message?: Message | GroupMessage | null;
    unread_count?: number;
}
export interface GroupMember {
    group_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member';
    created_at?: string;
    profile?: UserProfile;
}
export interface GroupMessage {
    id: number;
    group_id: string;
    sender_id: string;
    content: string;
    reply_to?: number | string | null;
    pinned_at?: string | null;
    edited_at?: string | null;
    created_at: string;
    reactions?: Record<string, string> | MessageReactionItem[] | null;
    sender_profile?: UserProfile | null;
}
export interface GroupRead {
    message_id: number;
    group_id: string;
    user_id: string;
}
export interface GroupReaction {
    message_id: number;
    group_id: string;
    user_id: string;
    emoji: string;
}
export interface UserContact {
    owner_id: string;
    contact_id: string;
    alias_name: string;
    alias_avatar?: string | null;
    profile?: UserProfile;
    id?: string;
    user_id?: string;
    name?: string;
    custom_avatar_url?: string | null;
    created_at?: string;
}
export interface BlockedUser {
    blocker_id: string;
    blocked_id: string;
}
export interface UserDevice {
    user_id: string;
    device_id: string;
    name: string;
    kind: 'Телефон' | 'Планшет' | 'Компьютер' | string;
    ua: string;
    ip: string;
    session_id?: string | null;
    last_seen: string;
    first_seen?: string;
    revoked_at?: string | null;
}
export interface Report {
    id?: number | string;
    reporter_id: string;
    reported_id: string;
    reason: 'Спам' | 'Оскорбления или травля' | 'Мошенничество' | 'Неприемлемый контент' | 'Другое' | string;
    details?: string;
    status?: 'open' | 'resolved' | 'dismissed' | string;
    created_at?: string;
}
export interface StickerPack {
    id: number | string;
    owner_id?: string;
    user_id?: string;
    title: string;
    items: string[];
    is_copy?: boolean;
    created_at?: string;
}
export interface UserGift {
    id: number | string;
    owner_id: string;
    from_id: string;
    gift: string;
    price: number;
    message?: string | null;
    status: 'owned' | 'exchanged' | 'sold' | string;
    hidden: boolean;
    created_at: string;
    user_id?: string;
    sender_id?: string;
    gift_id?: string;
    is_hidden?: boolean;
    sender_profile?: UserProfile;
    from_profile?: UserProfile;
}
export interface CoinTx {
    id: number | string;
    user_id: string;
    amount: number;
    kind: 'gift_sent' | 'gift_self' | 'gift_exchange' | 'bonus' | string;
    gift?: string | null;
    other_id?: string | null;
    created_at: string;
}
export interface Payment {
    id: string;
    user_id: string;
    qcoin: number;
    status: 'pending' | 'paid' | 'canceled' | 'failed';
    created_at: string;
}
export interface SystemMessage {
    id: number | string;
    user_id: string;
    kind: 'welcome' | 'new_login' | string;
    body: string;
    read_at?: string | null;
    created_at: string;
}
export interface QuietlyFavoriteMessage {
    id?: number | string;
    user_id: string;
    client_id: string;
    content: string;
    original_sender_id?: string | null;
    original_message_id?: string | null;
    created_at: string;
}
export interface PublicKeyEntry {
    user_id: string;
    kid: string;
    public_key: string;
    created_at?: string;
}
export interface UserKeyBackup {
    user_id: string;
    salt: string;
    iv: string;
    data: string;
    updated_at?: string;
}
export interface GroupKeyEntry {
    group_id: string | number;
    user_id: string;
    key_id: string;
    wrapped_by: string;
    wrapped_by_kid: string;
    recipient_kid: string;
    iv: string;
    data: string;
}
export interface UserChatArchiveState {
    user_id: string;
    archived_ids: string[];
    updated_at: string;
}
export interface AudioTrack {
    id: string;
    user_id: string;
    title: string;
    artist: string;
    duration: number;
    audio_path: string;
    audio_url: string;
    cover_path?: string | null;
    cover_url?: string | null;
    is_favorite?: boolean;
    src_id?: string | null;
    created_at?: string;
}
export type UserTrack = AudioTrack;
export interface GiftItem {
    id: string;
    title: string;
    price: number;
    image: string;
    limit?: number;
    stock?: number;
    rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}
export interface ForwardContentPayload {
    u: string;
    n: string;
    c: string;
}
export interface GiftContentPayload {
    g: string;
    p: number;
    m?: string;
    i?: string;
    x?: number;
}
export interface ServiceContentPayload {
    t: 'pin' | 'unpin' | 'clear' | 'join' | 'leave' | 'rename' | 'photo';
    id?: string;
    q?: string;
    u?: string;
}
export const UNICODE_FORMAT = {
    BOLD: '\u2060',
    ITALIC: '\u2061',
    UNDERLINE: '\u2062',
    STRIKE: '\u2063',
    QUOTE: '\u2064',
    MONOSPACE: '\u206A',
    SPOILER: '\u206B',
} as const;
export const CONTENT_PREFIX = {
    STICKER: 'sticker::',
    FORWARD: 'fwd::',
    GIFT: 'gift::',
    SERVICE: 'svc::',
    E2E_DM: 'e2e1:',
    E2E_GRP: 'g2:',
} as const;
export interface GiftStockItem {
    gift_id: string;
    total: number;
    sold: number;
    first_sale: string;
    last_sale: string;
}
export interface SendGiftResult {
    balance: number;
    gift_id: string;
    message: {
        id: string | number;
        content: string;
        created_at: string;
        [key: string]: any;
    };
}
export interface ExchangeGiftResult {
    balance: number;
    payout: number;
    content: string;
    message?: any;
}
export interface RedeemPromoResult {
    ok: boolean;
    amount?: number;
    balance?: number;
    error?: 'not_found' | 'inactive' | 'used_up' | 'already_used' | 'too_many' | 'forbidden' | string;
}
export interface AdminStatsResult {
    users_total: number;
    users_today: number;
    users_week: number;
    online_24h: number;
    messages_total: number;
    messages_today: number;
    reports_open: number;
    reports_total: number;
    banned: number;
    deleted: number;
    signups: Array<{
        d: string;
        n: number;
    }>;
}
export interface AdminPromoItem {
    id: string;
    code: string;
    amount: number;
    max_uses: number;
    used_count: number;
    active: boolean;
    created_at: string;
}
