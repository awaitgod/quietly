import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '../supabase';
export const authApi = {
    getSession: () => supabase.auth.getSession(),
    getUser: () => supabase.auth.getUser(),
    signInWithOtp: (email: string, shouldCreateUser = true) => supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser },
    }),
    verifyOtp: (email: string, token: string) => supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'email',
    }),
    signInWithPassword: (email: string, password: string) => supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
    }),
    updatePassword: (password: string) => supabase.auth.updateUser({ password }),
    changePassword: async (email: string, currentPassword: string, newPassword: string) => {
        const verifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `quietly-password-check-${crypto.randomUUID()}` },
        });
        const { error: verifyError } = await verifier.auth.signInWithPassword({ email, password: currentPassword });
        if (verifyError) throw verifyError;
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
        } finally {
            await verifier.auth.signOut({ scope: 'local' }).catch(() => {});
        }
    },
    signOut: (options?: {
        scope?: 'local' | 'others';
    }) => supabase.auth.signOut(options),
};
