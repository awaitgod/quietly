import { supabase } from '../supabase';
export const functionsApi = {
    plategaCreate: async (qcoin: number, method: 'sbp' | 'crypto'): Promise<string> => {
        const { data, error } = await supabase.functions.invoke('platega-create', {
            body: { qcoin, method },
        });
        if (error)
            throw error;
        if (data?.url && typeof data.url === 'string') {
            return data.url;
        }
        throw new Error(data?.error || 'Не удалось получить ссылку на оплату');
    },
};
