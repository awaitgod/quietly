import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { tablesApi, rpcApi, functionsApi } from '../services/supabase';
import type { GiftItem, UserGift, CoinTx, GiftStockItem } from '../types';
import { useAuthStore } from './auth';
export const useEconomyStore = defineStore('economy', () => {
    const authStore = useAuthStore();
    const isTopupOpen = ref(false);
    const isPromoOpen = ref(false);
    const isGiftsCatalogOpen = ref(false);
    const userGifts = ref<UserGift[]>([]);
    const giftsByOwner = ref<Record<string, UserGift[]>>({});
    const giftErrors = ref<Record<string, boolean>>({});
    const giftLoading = ref<Record<string, boolean>>({});
    const giftsRequests: Record<string, number> = {};
    watch(() => authStore.user?.id, () => {
        giftsByOwner.value = {};
        giftErrors.value = {};
        giftLoading.value = {};
        userGifts.value = [];
        for (const id of Object.keys(giftsRequests))
            giftsRequests[id] = (giftsRequests[id] || 0) + 1;
    });
    const coinTxHistory = ref<CoinTx[]>([]);
    const giftStocks = ref<GiftStockItem[]>([]);
    const coinToast = ref<{
        amount: number;
        visible: boolean;
    }>({ amount: 0, visible: false });
    const topupPackages = [
        { qcoins: 50, priceRub: 99 },
        { qcoins: 100, priceRub: 189 },
        { qcoins: 250, priceRub: 449 },
        { qcoins: 500, priceRub: 849 },
        { qcoins: 1000, priceRub: 1590 },
        { qcoins: 2500, priceRub: 3690 },
    ];
    const giftImage = (id: string) => `${import.meta.env.BASE_URL}gifts/${id}.webp`;
    const defaultGifts: GiftItem[] = [
        { id: 'snowman', title: 'Снеговик', price: 25, image: giftImage('snowman'), rarity: 'common' },
        { id: 'bomb', title: 'Бомба', price: 25, image: giftImage('bomb'), rarity: 'common' },
        { id: 'tree', title: 'Призрак', price: 50, image: giftImage('tree'), rarity: 'rare' },
        { id: 'cookie', title: 'Печенье', price: 50, image: giftImage('cookie'), rarity: 'rare' },
        { id: 'phone', title: 'Телефон', price: 100, image: giftImage('phone'), rarity: 'epic' },
        { id: 'hat', title: 'Цилиндр', price: 100, image: giftImage('hat'), rarity: 'epic' },
        { id: 'snowflake', title: 'Снежинка', price: 100, limit: 5000, image: giftImage('snowflake'), rarity: 'legendary' },
    ];
    function showCoinToast(amount: number) {
        coinToast.value = { amount, visible: true };
        setTimeout(() => {
            coinToast.value.visible = false;
        }, 2800);
    }
    async function redeemPromo(code: string): Promise<{
        ok: boolean;
        amount?: number;
        error?: string;
    }> {
        try {
            const res = await rpcApi.redeemPromo(code);
            if (res?.ok) {
                if (authStore.profile && res.balance != null) {
                    authStore.profile.qcoin = Number(res.balance) || 0;
                }
                showCoinToast(Number(res.amount) || 0);
                return { ok: true, amount: res.amount };
            }
            return { ok: false, error: res?.error || 'Промокод недействителен' };
        }
        catch (err: any) {
            console.error('[Economy] redeemPromo error:', err);
            return { ok: false, error: err.message || 'Ошибка сети' };
        }
    }
    async function createTopupPayment(qcoin: number, method: 'sbp' | 'crypto'): Promise<string | null> {
        try {
            return await functionsApi.plategaCreate(qcoin, method);
        }
        catch (err) {
            console.error('[Economy] createTopupPayment error:', err);
            return null;
        }
    }
    async function checkPaymentStatus(paymentId: string) {
        try {
            const { data, error } = await tablesApi.payments.checkPaymentStatus(paymentId);
            if (error)
                throw error;
            return data;
        }
        catch (err) {
            console.error('[Economy] checkPaymentStatus error:', err);
            return null;
        }
    }
    async function loadGiftStock() {
        try {
            const stocks = await rpcApi.giftStock();
            giftStocks.value = stocks;
            return stocks;
        }
        catch (err) {
            console.warn('[Economy] loadGiftStock error:', err);
            return [];
        }
    }
    async function loadUserGifts(userId: string) {
        const request = giftsRequests[userId] = (giftsRequests[userId] || 0) + 1;
        giftLoading.value[userId] = true;
        giftErrors.value[userId] = false;
        try {
            const rows: any[] = [];
            const pageSize = 200;
            for (let offset = 0;; offset += pageSize) {
                const { data, error } = await tablesApi.userGifts.loadUserGifts(userId, pageSize, offset);
                if (error)
                    throw error;
                rows.push(...(data || []));
                if (!data || data.length < pageSize)
                    break;
            }
            const senderIds = Array.from(new Set(rows.map(g => g.from_id).filter(Boolean))) as string[];
            const profMap = new Map<string, any>();
            if (senderIds.length) {
                const { data: profs } = await tablesApi.profiles.getByIds(senderIds);
                profs?.forEach((p: any) => profMap.set(p.id, p));
            }
            if (request !== giftsRequests[userId])
                return;
            const gifts = rows.map(g => ({ ...g, user_id: g.owner_id, sender_id: g.from_id, gift_id: g.gift, is_hidden: g.hidden, sender_profile: profMap.get(g.from_id), from_profile: profMap.get(g.from_id) })) as UserGift[];
            giftsByOwner.value[userId] = gifts;
            userGifts.value = gifts;
        }
        catch (err) {
            if (request === giftsRequests[userId])
                giftErrors.value[userId] = true;
            console.error('[Economy] loadUserGifts error:', err);
        }
        finally {
            if (request === giftsRequests[userId])
                giftLoading.value[userId] = false;
        }
    }
    async function sendGift(recipientId: string, giftId: string, message = '') {
        try {
            const data = await rpcApi.sendGift(recipientId, giftId, message);
            if (authStore.profile && data.balance != null) {
                authStore.profile.qcoin = data.balance;
            }
            await Promise.all([loadUserGifts(recipientId), loadGiftStock()]);
            return data;
        }
        catch (err) {
            console.error('[Economy] sendGift error:', err);
            throw err;
        }
    }
    async function exchangeGift(giftOrMsgId: string, source: 'chat' | 'profile') {
        try {
            const data = await rpcApi.exchangeGift(giftOrMsgId, source);
            if (authStore.profile && data.balance != null) {
                authStore.profile.qcoin = data.balance;
            }
            showCoinToast(data.payout);
            return data;
        }
        catch (err) {
            console.error('[Economy] exchangeGift error:', err);
            throw err;
        }
    }
    async function setGiftHidden(giftId: string | number, hidden: boolean) {
        try {
            await rpcApi.setGiftHidden(giftId, hidden);
            const found = userGifts.value.find((g) => g.id === giftId);
            if (found) {
                found.hidden = hidden;
                found.is_hidden = hidden;
            }
        }
        catch (err) {
            console.error('[Economy] setGiftHidden error:', err);
            throw err;
        }
    }
    async function loadCoinTxHistory() {
        if (!authStore.user?.id)
            return;
        try {
            const { data, error } = await tablesApi.coinTx.loadHistory(authStore.user.id);
            if (error)
                throw error;
            coinTxHistory.value = (data as CoinTx[]) || [];
        }
        catch (err) {
            console.error('[Economy] loadCoinTxHistory error:', err);
        }
    }
    return {
        isTopupOpen,
        isPromoOpen,
        isGiftsCatalogOpen,
        userGifts,
        giftsByOwner,
        giftErrors,
        giftLoading,
        coinTxHistory,
        giftStocks,
        coinToast,
        topupPackages,
        defaultGifts,
        showCoinToast,
        redeemPromo,
        createTopupPayment,
        checkPaymentStatus,
        loadGiftStock,
        loadUserGifts,
        sendGift,
        exchangeGift,
        setGiftHidden,
        loadCoinTxHistory,
    };
});
