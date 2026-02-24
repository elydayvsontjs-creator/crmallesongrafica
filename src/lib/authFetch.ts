import { supabase } from './supabase';

/**
 * Realiza uma requisição fetch autenticada com o token JWT do Supabase
 * automaticamente incluído no header Authorization.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });
}
