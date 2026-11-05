import { supabase } from '../supabase';
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
    signOut: (options?: {
        scope?: 'local' | 'others';
    }) => supabase.auth.signOut(options),
};
