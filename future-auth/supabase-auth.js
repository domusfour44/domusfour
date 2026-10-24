// Dormant module: not imported by any public page or server route.
// Activation requires reviewed redirect URLs, email templates and account UX.
export function createCustomerAuth({ url, publishableKey, enabled = false }) {
  async function request(path, body) {
    if (!enabled) throw new Error('Autenticazione clienti non attiva.');
    if (!url || !publishableKey) throw new Error('Configurazione Supabase mancante.');
    const response = await fetch(`${url}/auth/v1/${path}`, { method:'POST', headers:{ apikey:publishableKey,'Content-Type':'application/json' }, body:JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.msg || result.error_description || 'Autenticazione non riuscita.');
    return result;
  }
  return { signUp: (email,password) => request('signup',{email,password}), signIn: (email,password) => request('token?grant_type=password',{email,password}) };
}
