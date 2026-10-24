// Integrated from the existing Telegram contact backend.
const MAX_BODY_BYTES = 16 * 1024;
const TELEGRAM_TIMEOUT_MS = 10000;

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
);

const reasons = Object.freeze({
  statua: 'Informazioni su una statua',
  pezzo: 'Pezzo personalizzato',
  ingrosso: "Ordine all'ingrosso",
  altro: 'Altro'
});

function sendJson(response, statusCode, data) {
  const body = JSON.stringify(data);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(body);
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;

  // Requests from tools such as curl may have no Origin header.
  if (!origin) return true;

  if (origin !== new URL(process.env.SITE_URL || 'http://localhost:3000').origin && !allowedOrigins.has(origin)) return false;

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Max-Age', '86400');
  response.setHeader('Vary', 'Origin');
  return true;
}

async function readFormData(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  const contentType = String(request.headers['content-type'] || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (contentType === 'application/json') {
    try {
      const data = JSON.parse(rawBody || '{}');
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Expected a JSON object');
      }
      return data;
    } catch {
      const error = new Error('Invalid JSON body');
      error.statusCode = 400;
      throw error;
    }
  }

  if (contentType === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(rawBody));
  }

  const error = new Error('Unsupported content type');
  error.statusCode = 415;
  throw error;
}

function cleanField(value, maxLength) {
  if (typeof value !== 'string') return '';
  const cleaned = value.trim();
  return cleaned.length > maxLength ? null : cleaned;
}

export async function handleContact(request, response) {
  if (!setCorsHeaders(request, response)) {
    sendJson(response, 403, { ok: false, error: 'Origin non autorizzata' });
    return;
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS');
    sendJson(response, 405, { ok: false, error: 'Metodo non consentito' });
    return;
  }

  let datiForm;
  try {
    datiForm = await readFormData(request);
  } catch (error) {
    sendJson(response, error.statusCode || 400, {
      ok: false,
      error: error.statusCode === 413
        ? 'Il modulo inviato è troppo grande'
        : 'Formato dei dati non valido'
    });
    return;
  }

  const nome = cleanField(datiForm.nome, 100);
  const email = cleanField(datiForm.email, 254);
  const motivoInput = cleanField(datiForm.motivo, 40);
  const numero = cleanField(datiForm.numero, 40);
  const testo = cleanField(datiForm.messaggio, 3000);

  if ([nome, email, motivoInput, numero, testo].includes(null)) {
    sendJson(response, 400, { ok: false, error: 'Uno o più campi sono troppo lunghi' });
    return;
  }

  if (!nome || !email || !testo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendJson(response, 400, { ok: false, error: 'Controlla i campi obbligatori' });
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error('Mancano TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID.');
    sendJson(response, 500, { ok: false, error: 'Configurazione del server incompleta' });
    return;
  }

  const motivo = motivoInput || 'altro';
  const motivoLabel = Object.hasOwn(reasons, motivo) ? reasons[motivo] : reasons.altro;
  const message = [
    'Nuovo messaggio dal sito',
    'Nome: ' + nome,
    'Email: ' + email,
    'Di cosa hai bisogno: ' + motivoLabel,
    'Telefono: ' + (numero || 'Non indicato'),
    'Messaggio: ' + testo
  ].join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    const telegramResponse = await fetch(
      'https://api.telegram.org/bot' + botToken + '/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message }),
        signal: controller.signal
      }
    );

    const telegramResult = await telegramResponse.json().catch(() => null);

    if (!telegramResponse.ok || !telegramResult || telegramResult.ok !== true) {
      console.error('Errore Telegram:', telegramResult && telegramResult.description);
      sendJson(response, 502, { ok: false, error: 'Telegram non ha accettato il messaggio' });
      return;
    }

    sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error('Errore durante l’invio a Telegram:', error.message);
    sendJson(response, 502, { ok: false, error: 'Invio del messaggio non riuscito' });
  } finally {
    clearTimeout(timeout);
  }
}

