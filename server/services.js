export async function remote(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error('Servizio temporaneamente non disponibile.'), { status: 502 });
  return data;
}
export function database(path, options = {}) {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw Object.assign(new Error('Database da configurare.'), { status: 503 });
  return remote(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers } });
}
export function resend(path, body) {
  if (!process.env.RESEND_API_KEY) throw Object.assign(new Error('Newsletter da configurare.'), { status: 503 });
  return remote(`https://api.resend.com/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
export function validateProduct(data) {
  const fields = ['id','name','category','description','details','image','badge','purchase_url'];
  const product = Object.fromEntries(fields.map(k => [k, typeof data[k] === 'string' ? data[k].trim() : '']));
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(product.id) || !product.name || product.name.length > 160 || !['santi','calcio','maschere','fortuna'].includes(product.category)) throw Object.assign(new Error('Controlla codice, nome e categoria.'), { status: 400 });
  if (typeof data.price !== 'number' || !Number.isFinite(data.price) || data.price < 0 || data.price > 100000 || Math.abs(data.price * 100 - Math.round(data.price * 100)) > 0.00001) throw Object.assign(new Error('Prezzo non valido (massimo due decimali).'), { status: 400 });
  if (!/^(assets\/img\/[a-zA-Z0-9_.-]+|https:\/\/[^\s]+)$/.test(product.image) || (product.purchase_url && !/^https:\/\/[^\s]+$/.test(product.purchase_url)) || fields.some(k => product[k].length > 3000)) throw Object.assign(new Error('Immagine o link non valido. Usa HTTPS o assets/img/nome-file.'), { status: 400 });
  return { ...product, price: data.price, active: data.active === true, featured: data.featured === true };
}
