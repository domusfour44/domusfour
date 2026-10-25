import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { remote } from './services.js';

const MAX_BYTES = 4 * 1024 * 1024;
const reject = (status, message) => { throw Object.assign(new Error(message), { status }); };

export async function uploadProductImage(req) {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) reject(503, 'Storage da configurare su Supabase.');
  let filename;
  try { filename = decodeURIComponent(req.headers['x-file-name'] || ''); }
  catch { reject(400, 'Nome del file non valido.'); }
  if (!filename || Buffer.byteLength(filename) > 180 || /[/\\\u0000-\u001f\u007f]/.test(filename) || filename.startsWith('.')) reject(400, 'Nome del file non valido: usa un nome senza cartelle, fino a 180 byte.');
  if (!/^[A-Za-z0-9_!.*'() &$=@;:+,?-]+$/.test(filename)) reject(400, 'Supabase non supporta questo nome. Rinomina la foto usando lettere senza accenti, numeri, spazi o trattini e riprova: il nome non verrà modificato automaticamente.');
  const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[extname(filename).toLowerCase()];
  if (!mime || req.headers['content-type'] !== mime) reject(415, 'Scegli una foto JPG, PNG o WebP.');
  if (Number(req.headers['content-length']) > MAX_BYTES) reject(413, 'La foto supera il limite di 4 MB.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > MAX_BYTES) { req.resume(); reject(413, 'La foto supera il limite di 4 MB.'); }
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const valid = mime === 'image/jpeg' ? bytes.length >= 4 && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    : mime === 'image/png' ? bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) reject(415, 'Il contenuto del file non corrisponde a una foto JPG, PNG o WebP.');
  // Unique directories preserve filenames and prevent overwriting other products' photos.
  const object = `${randomUUID()}/${encodeURIComponent(filename)}`;
  const storage = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object`;
  try {
    await remote(`${storage}/product-images/${object}`, {
      method: 'POST', headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, 'Content-Type': mime, 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' }, body: bytes
    });
  } catch (error) {
    console.error('[products] image_upload_failed', JSON.stringify({ status: error.upstreamStatus || error.status || 502, code: error.upstreamCode || 'unknown' }));
    reject(502, 'Foto non caricata. Verifica il bucket product-images su Supabase e riprova.');
  }
  return { url: `${storage}/public/product-images/${object}`, filename };
}
