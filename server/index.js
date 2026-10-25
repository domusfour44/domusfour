import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHmac, createHash, timingSafeEqual, scryptSync, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { database, resend, prepareProduct, validateCategory } from './services.js';
import { handleContact } from './contact.js';
import { isCatalogProduct } from './products.js';
import { validTicketId, sendTicketReceipt } from './tickets.js';
import { newsletterConfirmationEmail } from './emails.js';
import { newsletterSegmentId, assignNewsletterSegment } from './newsletter.js';
import { uploadProductImage } from './images.js';

const root = fileURLToPath(new URL('../public/', import.meta.url)).replace(/[\\/]$/, '');
const site = () => new URL(process.env.SITE_URL || 'http://localhost:3000');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const secret = () => { if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) fail(503, 'Configurare SESSION_SECRET (almeno 32 caratteri).'); return process.env.SESSION_SECRET; };
function sign(value) { const raw = Buffer.from(JSON.stringify(value)).toString('base64url'); return raw + '.' + createHmac('sha256', secret()).update(raw).digest('base64url'); }
function verify(token, type) {
  const [raw, signature] = String(token || '').split('.');
  if (!raw || !signature) return null;
  const expected = createHmac('sha256', secret()).update(raw).digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try { const value = JSON.parse(Buffer.from(raw, 'base64url')); return value.type === type && value.exp > Date.now() ? value : null; } catch { return null; }
}
const limits = new Map();
setInterval(() => { for (const [key, value] of limits) if (value.until < Date.now()) limits.delete(key); }, 60000).unref();
function limit(req, route, max) {
  const key = route + req.socket.remoteAddress;
  const value = limits.get(key) || { count: 0, until: Date.now() + 900000 };
  if (value.until < Date.now()) { value.count = 0; value.until = Date.now() + 900000; }
  value.count++; limits.set(key, value);
  if (value.count > max) fail(429, 'Troppi tentativi. Riprova fra 15 minuti.');
}
async function body(req) {
  let result = '';
  for await (const chunk of req) { result += chunk; if (Buffer.byteLength(result) > 16384) fail(413, 'Richiesta troppo grande.'); }
  try { return JSON.parse(result); } catch { fail(400, 'Richiesta non valida.'); }
}
function admin(req) {
  const cookie = /(?:^|; )dn_admin=([^;]+)/.exec(req.headers.cookie || '');
  if (!verify(cookie?.[1], 'admin')) fail(401, 'Accedi come amministratore.');
}
const cookie = token => `dn_admin=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${token ? 28800 : 0}${site().protocol === 'https:' ? '; Secure' : ''}`;
export const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  try {
    const url = new URL(req.url, site());
    const path = url.pathname;
    if (path === '/health' && req.method === 'GET') return json({ ok: true });
    if (path === '/api/contact') {
      if (req.method === 'POST') limit(req, path, 10);
      return await handleContact(req, res);
    }
    if (path.startsWith('/api/')) {
      if (!['GET','HEAD'].includes(req.method) && req.headers.origin !== site().origin) fail(403, 'Origine non consentita.');
      if (path === '/api/products' && req.method === 'GET') return json((await database('products?active=eq.true&select=*,category_info:categories(name)&order=created_at.asc')).filter(isCatalogProduct));
      const productMatch = /^\/api\/products\/([a-z0-9][a-z0-9-]{0,79})$/.exec(path);
      if (productMatch && req.method === 'GET') {
        const products = await database(`products?id=eq.${productMatch[1]}&active=eq.true&select=*,category_info:categories(name)&limit=1`);
        const product = products.find(isCatalogProduct);
        if (!product) fail(404, 'Questo prodotto non è più disponibile.');
        return json(product);
      }
      if (path === '/api/admin/login' && req.method === 'POST') {
        limit(req, path, 10);
        const data = await body(req);
        if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16) fail(503, 'Accesso amministratore da configurare.');
        const hash = value => scryptSync(String(value || ''), 'domus-admin', 32);
        if (!timingSafeEqual(hash(data.password), hash(process.env.ADMIN_PASSWORD)) || data.email !== process.env.ADMIN_EMAIL) fail(401, 'Credenziali non valide.');
        res.setHeader('Set-Cookie', cookie(sign({ type: 'admin', exp: Date.now() + 28800000, nonce: randomBytes(16).toString('hex') })));
        return json({ ok: true });
      }
      if (path.startsWith('/api/admin/')) {
        admin(req);
        if (path === '/api/admin/images' && req.method === 'POST') { limit(req, path, 60); return json(await uploadProductImage(req), 201); }
        if (path === '/api/admin/session' && req.method === 'GET') return json({ ok: true });
        if (path === '/api/admin/logout' && req.method === 'POST') { res.setHeader('Set-Cookie', cookie('')); return json({ ok: true }); }
        if (path === '/api/admin/tickets' && req.method === 'GET') {
          const offset = Number(url.searchParams.get('offset') || 0);
          const status = url.searchParams.get('status');
          if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000000 || (status && !['new','in_progress','closed'].includes(status))) fail(400, 'Filtro ticket non valido.');
          return json(await database(`contact_tickets?order=created_at.desc,id.desc&limit=50&offset=${offset}${status ? `&status=eq.${status}` : ''}`));
        }
        const ticketMatch = /^\/api\/admin\/tickets\/([^/]+)(\/receipt)?$/.exec(path);
        if (ticketMatch && validTicketId(ticketMatch[1])) {
          const ticketPath = `contact_tickets?id=eq.${ticketMatch[1]}`;
          if (!ticketMatch[2] && req.method === 'PATCH') {
            const { status } = await body(req);
            if (!['new','in_progress','closed'].includes(status)) fail(400, 'Stato ticket non valido.');
            const rows = await database(ticketPath, { method: 'PATCH', body: JSON.stringify({ status }) });
            if (!rows.length) fail(404, 'Ticket non trovato.');
            return json({ ok: true });
          }
          if (ticketMatch[2] && req.method === 'POST') {
            const rows = await database(ticketPath);
            if (!rows.length) fail(404, 'Ticket non trovato.');
            if (!await sendTicketReceipt(rows[0])) fail(502, 'Ticket salvato, ma la ricevuta non è stata inviata. Verifica Resend e riprova.');
            return json({ ok: true });
          }
        }
        if (path === '/api/admin/categories' && req.method === 'GET') return json(await database('categories?active=eq.true&order=name.asc'));
        if (path === '/api/admin/categories' && req.method === 'POST') return json(await database('categories', { method: 'POST', body: JSON.stringify(validateCategory(await body(req))) }), 201);
        if (path === '/api/admin/products' && req.method === 'GET') return json((await database('products?order=created_at.asc')).filter(isCatalogProduct));
        if (path === '/api/admin/products' && req.method === 'POST') return json(await database('products', { method: 'POST', body: JSON.stringify(await prepareProduct(await body(req))) }), 201);
        const match = /^\/api\/admin\/products\/([a-z0-9-]+)$/.exec(path);
        if (match && ['PUT','DELETE'].includes(req.method)) {
          let options = { method: 'DELETE' };
          if (req.method === 'PUT') { const product = await prepareProduct(await body(req)); if (product.id !== match[1]) fail(400, 'Il codice prodotto non può essere modificato.'); options = { method: 'PATCH', body: JSON.stringify(product) }; }
          const rows = await database(`products?id=eq.${match[1]}`, options);
          if (!rows.length) fail(404, 'Prodotto non trovato.');
          return json({ ok: true });
        }
      }
      if (path === '/api/newsletter' && req.method === 'POST') {
        limit(req, path, 5);
        const data = await body(req);
        if (data.consent !== true || typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fail(400, 'Inserisci una email valida e accetta l’informativa.');
        newsletterSegmentId();
        const token = sign({ type: 'newsletter', email: data.email.trim().toLowerCase(), exp: Date.now() + 86400000, consent_at: new Date().toISOString(), privacy_version: '2026-10-25' });
        const link = new URL('/newsletter-confirm.html', site()); link.searchParams.set('token', token);
        await resend('emails', { from: process.env.RESEND_FROM, to: [data.email.trim()], reply_to: process.env.CONTACT_REPLY_TO || 'domusfour44@domusfour.it', ...newsletterConfirmationEmail(link.href) });
        return json({ ok: true, message: 'Controlla la tua email e conferma l’iscrizione entro 24 ore.' });
      }
      if (path === '/api/newsletter/confirm' && req.method === 'POST') {
        limit(req, path, 20);
        const token = (await body(req)).token;
        const data = verify(token, 'newsletter');
        if (!data || data.privacy_version !== '2026-10-25') fail(400, 'Link non valido o scaduto. Iscriviti nuovamente dalla home.');
        const segmentId = newsletterSegmentId();
        const confirmationId = createHash('sha256').update(token).digest('hex');
        const recordPath = `newsletter_consents?confirmation_id=eq.${confirmationId}`;
        const existing = await database(recordPath);
        if (existing[0]?.synced) {
          await assignNewsletterSegment(data.email, segmentId, true);
          return json({ ok: true, message: 'Questa iscrizione è già stata confermata.' });
        }
        if (!existing.length) await database('newsletter_consents', { method: 'POST', body: JSON.stringify({ confirmation_id: confirmationId, email: data.email, requested_at: data.consent_at, privacy_version: data.privacy_version }) });
        await assignNewsletterSegment(data.email, segmentId);
        await database(recordPath, { method: 'PATCH', body: JSON.stringify({ synced: true }) });
        return json({ ok: true, message: 'Iscrizione confermata. Grazie!' });
      }
      fail(404, 'Rotta non trovata.');
    }
    if (!['GET','HEAD'].includes(req.method)) fail(405, 'Metodo non consentito.');
    const file = resolve(root, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep) || path.split('/').some(p => p.startsWith('.'))) fail(404, 'Pagina non trovata.');
    const content = await readFile(file).catch(() => fail(404, 'Pagina non trovata.'));
    if (['/newsletter-confirm.html', '/admin.html'].includes(path)) res.setHeader('Cache-Control', 'no-store');
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) { json({ ok: false, error: error.status ? error.message : 'Errore interno del server.' }, error.status || 500); }
});
if (process.env.NODE_ENV !== 'test') server.listen(process.env.PORT || 3000, () => console.log('Domus Neapolis: server avviato.'));
