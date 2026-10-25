import { randomUUID } from 'node:crypto';
import { database, resend } from './services.js';

export const ticketCode = ticket => `DF-${String(ticket.ticket_number).padStart(6, '0')}`;
export const validTicketId = id => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
const reasons = { statua: 'Informazioni su una statua', pezzo: 'Pezzo personalizzato', ingrosso: 'Ordine all’ingrosso', altro: 'Altro' };

export async function saveTicket(data) {
  const requestKey = data.request_key || randomUUID();
  if (!validTicketId(requestKey)) throw Object.assign(new Error('Identificativo richiesta non valido.'), { status: 400 });
  const input = { request_key: requestKey, name: data.name, email: data.email, phone: data.phone, reason: reasons[data.reason] || reasons.altro, message: data.message };
  const created = await database('contact_tickets?on_conflict=request_key', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(input) });
  const ticket = created[0] || (await database(`contact_tickets?request_key=eq.${requestKey}`))[0];
  if (!ticket) throw new Error('Ticket non salvato.');
  if (['name','email','phone','reason','message'].some(key => ticket[key] !== input[key])) throw Object.assign(new Error('La richiesta è già stata usata per un altro messaggio. Ricarica la pagina.'), { status: 409 });
  return ticket;
}
async function mark(ticket, field, value) {
  await database(`contact_tickets?id=eq.${ticket.id}`, { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
  ticket[field] = value;
}
export async function sendTicketReceipt(ticket) {
  if (ticket.email_status === 'sent') return true;
  try {
    await resend('emails', {
      from: process.env.RESEND_FROM,
      to: [ticket.email],
      reply_to: process.env.CONTACT_REPLY_TO || 'domusfour44@domusfour.it',
      subject: `Messaggio ricevuto · Ticket ${ticketCode(ticket)}`,
      text: `Ciao ${ticket.name},\n\nabbiamo ricevuto il tuo messaggio.\nIl numero della tua richiesta è ${ticketCode(ticket)}. Conservalo per eventuali comunicazioni.\n\nOggetto: ${ticket.reason}\n\nIl tuo messaggio:\n${ticket.message}\n\nTi risponderemo appena possibile. Questa è una ricevuta automatica, non una risposta alla richiesta. Non sei stato iscritto alla newsletter.\n\nDomusFour\n${new URL('/privacy.html#contatti', process.env.SITE_URL || 'http://localhost:3000').href}`
    }, { 'Idempotency-Key': `ticket-receipt/${ticket.id}` });
    await mark(ticket, 'email_status', 'sent');
    return true;
  } catch {
    await mark(ticket, 'email_status', 'failed').catch(() => {});
    return false;
  }
}
export async function notifyTicketTelegram(ticket) {
  if (ticket.telegram_status === 'sent' || ticket.telegram_status === 'skipped') return;
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) { await mark(ticket, 'telegram_status', 'skipped').catch(() => {}); return; }
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: `Nuovo ticket ${ticketCode(ticket)}\nNome: ${ticket.name}\nEmail: ${ticket.email}\nDi cosa hai bisogno: ${ticket.reason}\nTelefono: ${ticket.phone || 'Non indicato'}\nMessaggio: ${ticket.message}` })
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error('Telegram non disponibile');
    await mark(ticket, 'telegram_status', 'sent');
  } catch { await mark(ticket, 'telegram_status', 'failed').catch(() => {}); }
}
