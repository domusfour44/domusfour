import { isCatalogProduct } from './products.js';

export async function remote(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (data?.code === '23505') throw Object.assign(new Error('Nome o codice già presente. Scegli un nome diverso.'), { status: 409 });
    if (data?.code === '23503') throw Object.assign(new Error('Categoria non disponibile. Aggiorna la pagina e riprova.'), { status: 400 });
    if (['42P01', '42703', 'PGRST204', 'PGRST205', 'PGRST200'].includes(data?.code)) throw Object.assign(new Error('Database da aggiornare: esegui gli script SQL indicati nel README.'), { status: 503 });
    const code = String(data?.name || data?.code || 'unknown');
    throw Object.assign(new Error('Servizio temporaneamente non disponibile.'), { status: 502, upstreamStatus: response.status, upstreamCode: /^[a-zA-Z0-9_-]{1,64}$/.test(code) ? code : 'unknown' });
  }
  return data;
}
export function database(path, options = {}) {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw Object.assign(new Error('Database da configurare.'), { status: 503 });
  return remote(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers } });
}
export function resend(path, body, headers = {}, method = 'POST') {
  if (!process.env.RESEND_API_KEY) throw Object.assign(new Error('Newsletter da configurare.'), { status: 503 });
  return remote(`https://api.resend.com/${path}`, { method, headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
export function validateProduct(data) {
  const fields = ['id','name','category','description','details','image','badge','purchase_url'];
  const product = Object.fromEntries(fields.map(k => [k, typeof data[k] === 'string' ? data[k].trim() : '']));
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(product.id) || !product.name || product.name.length > 160 || !isCatalogProduct(product)) throw Object.assign(new Error('Usa un nuovo codice, una foto del prodotto e una categoria valida.'), { status: 400 });
  if (typeof data.price !== 'number' || !Number.isFinite(data.price) || data.price < 0 || data.price > 100000 || Math.abs(data.price * 100 - Math.round(data.price * 100)) > 0.00001) throw Object.assign(new Error('Prezzo non valido (massimo due decimali).'), { status: 400 });
  if (!/^(assets\/img\/[a-zA-Z0-9_.-]+|https:\/\/[^\s]+)$/.test(product.image) || (product.purchase_url && !/^https:\/\/[^\s]+$/.test(product.purchase_url)) || fields.some(k => product[k].length > 3000)) throw Object.assign(new Error('Immagine o link non valido. Usa HTTPS o assets/img/nome-file.'), { status: 400 });
  if (data.images !== undefined) {
    if (!Array.isArray(data.images) || data.images.length > 8 || data.images.some(image => typeof image !== 'string' || image.length > 3000 || !/^(assets\/img\/[a-zA-Z0-9_.-]+|https:\/\/[^\s]+)$/.test(image) || /\.svg(?:[?#]|$)/i.test(image))) throw Object.assign(new Error('La galleria può contenere al massimo 8 foto valide.'), { status: 400 });
    product.images = [...new Set([product.image, ...data.images])];
    if (product.images.length > 8) throw Object.assign(new Error('La galleria può contenere al massimo 8 foto, inclusa la copertina.'), { status: 400 });
  }
  return { ...product, price: data.price, active: data.active === true, featured: data.featured === true };
}
export function validateCategory(data) {
  const name = typeof data?.name === 'string' ? data.name.trim().replace(/\s+/g, ' ') : '';
  const id = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (name.length < 2 || name.length > 80 || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) || ['maschere', 'fortuna', 'portafortuna'].includes(id)) throw Object.assign(new Error('Inserisci un nome di categoria valido, da 2 a 80 caratteri.'), { status: 400 });
  return { id, name, active: true };
}
export async function prepareProduct(data) {
  const product = validateProduct(data);
  const categories = await database(`categories?id=eq.${product.category}&active=eq.true&select=id`);
  if (!categories.length) throw Object.assign(new Error('La categoria non esiste. Creala prima di salvare il prodotto.'), { status: 400 });
  return product;
}
