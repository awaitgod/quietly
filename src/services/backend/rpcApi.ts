import { supabase } from '../supabase';
import type { Message, GroupMessage, GiftStockItem, SendGiftResult, ExchangeGiftResult, RedeemPromoResult, AdminStatsResult, AdminPromoItem } from '../../types';
export const rpcApi = {
    emailExists: async (email: string): Promise<boolean> => {
        const { data, error } = await supabase.rpc('email_exists', {
            check_email: email.trim().toLowerCase(),
        });
        if (error)
            throw error;
        return !!data;
    },
    deleteIncompleteAccount: async (): Promise<boolean> => {
        const { data, error } = await supabase.rpc('delete_incomplete_account');
        if (error)
            throw error;
        return !!data;
    },
    deleteMyAccount: async (): Promise<boolean> => {
        const { data, error } = await supabase.rpc('delete_my_account');
        if (error)
            throw error;
        return !!data;
    },
    editMessage: async (p_id: string, p_content: string): Promise<Message> => {
        const { data, error } = await supabase.rpc('edit_message', {
            p_id: String(p_id),
            p_content,
        });
        if (error)
            throw error;
        return data as Message;
    },
    reactMessage: async (p_id: string, p_emoji: string): Promise<Message> => {
        const { data, error } = await supabase.rpc('react_message', {
            p_id: String(p_id),
            p_emoji,
        });
        if (error)
            throw error;
        return data as Message;
    },
    pinMessage: async (p_id: string, p_pin: boolean): Promise<Message> => {
        const { data, error } = await supabase.rpc('pin_message', {
            p_id: String(p_id),
            p_pin,
        });
        if (error)
            throw error;
        return data as Message;
    },
    deleteMessage: async (p_id: string, p_all: boolean): Promise<Message> => {
        const { data, error } = await supabase.rpc('delete_message', {
            p_id: String(p_id),
            p_all,
        });
        if (error)
            throw error;
        return data as Message;
    },
    deleteChat: async (p_partner: string, p_all: boolean): Promise<void> => {
        const { error } = await supabase.rpc('delete_chat', {
            p_partner,
            p_all,
        });
        if (error)
            throw error;
    },
    inContactsOf: async (p_owner: string): Promise<boolean> => {
        const { data, error } = await supabase.rpc('in_contacts_of', {
            p_owner,
        });
        if (error)
            throw error;
        return !!data;
    },
    revokeDeviceSession: async (p_device_id: string): Promise<boolean> => {
        const { data, error } = await supabase.rpc('revoke_device_session', {
            p_device_id,
        });
        if (error)
            throw error;
        return !!data;
    },
    isAdmin: async (): Promise<boolean> => {
        const { data, error } = await supabase.rpc('is_admin');
        if (error)
            throw error;
        return !!data;
    },
    setMyBadge: async (p_badge: string): Promise<void> => {
        const { error } = await supabase.rpc('set_my_badge', { p_badge });
        if (error)
            throw error;
    },
    giftStock: async (): Promise<GiftStockItem[]> => {
        const { data, error } = await supabase.rpc('gift_stock');
        if (error)
            throw error;
        return (data || []) as GiftStockItem[];
    },
    sendGift: async (p_to: string, p_gift: string, p_text = ''): Promise<SendGiftResult> => {
        const { data, error } = await supabase.rpc('send_gift', {
            p_to,
            p_gift,
            p_text,
        });
        if (error)
            throw error;
        return data as SendGiftResult;
    },
    exchangeGift: async (p_id: string, p_source: 'chat' | 'profile'): Promise<ExchangeGiftResult> => {
        const { data, error } = await supabase.rpc('exchange_gift', {
            p_id,
            p_source,
        });
        if (error)
            throw error;
        return data as ExchangeGiftResult;
    },
    setGiftHidden: async (p_id: string | number, p_hidden: boolean): Promise<void> => {
        const { error } = await supabase.rpc('set_gift_hidden', {
            p_id: String(p_id),
            p_hidden,
        });
        if (error)
            throw error;
    },
    pinGroupMessage: async (p_id: number, p_pin: boolean): Promise<GroupMessage> => {
        const { data, error } = await supabase.rpc('pin_group_message', {
            p_id,
            p_pin,
        });
        if (error)
            throw error;
        return data as GroupMessage;
    },
    clearGroupHistory: async (p_group_id: string | number): Promise<void> => {
        const { error } = await supabase.rpc('clear_group_history', {
            p_group_id,
        });
        if (error)
            throw error;
    },
    redeemPromo: async (p_code: string): Promise<RedeemPromoResult> => {
        const { data, error } = await supabase.rpc('redeem_promo', {
            p_code: p_code.trim().toUpperCase(),
        });
        if (error)
            throw error;
        return data as RedeemPromoResult;
    },
    admin: {
        stats: async (): Promise<AdminStatsResult> => {
            const { data, error } = await supabase.rpc('admin_stats');
            if (error)
                throw error;
            return data as AdminStatsResult;
        },
        users: async (p_q = '', p_limit = 50, p_offset = 0) => {
            const { data, error } = await supabase.rpc('admin_users', {
                p_q,
                p_limit,
                p_offset,
            });
            if (error)
                throw error;
            return data;
        },
        setBadge: async (p_user: string, p_badge: string, p_on: boolean) => {
            const { data, error } = await supabase.rpc('admin_set_badge', {
                p_user,
                p_badge,
                p_on,
            });
            if (error)
                throw error;
            return data;
        },
        setBan: async (p_user: string, p_ban: boolean) => {
            const { error } = await supabase.rpc('admin_set_ban', { p_user, p_ban });
            if (error)
                throw error;
        },
        deleteUser: async (p_user: string) => {
            const { error } = await supabase.rpc('admin_delete_user', { p_user });
            if (error)
                throw error;
        },
        reports: async (p_status = 'open', p_limit = 50) => {
            const { data, error } = await supabase.rpc('admin_reports', {
                p_status,
                p_limit,
            });
            if (error)
                throw error;
            return data;
        },
        setReport: async (p_id: string | number, p_status: string) => {
            const { error } = await supabase.rpc('admin_set_report', { p_id, p_status });
            if (error)
                throw error;
        },
        listPromos: async (): Promise<AdminPromoItem[]> => {
            const { data, error } = await supabase.rpc('admin_list_promos');
            if (error)
                throw error;
            return (data || []) as AdminPromoItem[];
        },
        createPromo: async (p_code: string, p_amount: number, p_max_uses: number) => {
            const { data, error } = await supabase.rpc('admin_create_promo', {
                p_code: p_code.trim().toUpperCase(),
                p_amount,
                p_max_uses,
            });
            if (error)
                throw error;
            return data;
        },
        setPromoActive: async (p_id: string, p_active: boolean) => {
            const { error } = await supabase.rpc('admin_set_promo_active', { p_id, p_active });
            if (error)
                throw error;
        },
        deletePromo: async (p_id: string) => {
            const { error } = await supabase.rpc('admin_delete_promo', { p_id });
            if (error)
                throw error;
        },
    },
};
