import { resend } from './services.js';

async function verifySegmentMembership(contactPath, segmentId) {
  let after;
  const seen = new Set();
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ limit: '100' });
    if (after) query.set('after', after);
    const segments = await resend(`${contactPath}/segments?${query}`, undefined, {}, 'GET');
    if (!Array.isArray(segments?.data)) break;
    if (segments.data.some(segment => segment?.id === segmentId)) return;
    if (segments.has_more !== true) break;
    after = segments.data.at(-1)?.id;
    if (typeof after !== 'string' || !after || seen.has(after)) break;
    seen.add(after);
  }
  throw Object.assign(new Error('Presenza nel segmento non confermata.'), { upstreamCode: 'segment_membership_not_confirmed' });
}

export function newsletterSegmentId() {
  const id = process.env.RESEND_SEGMENT_ID?.trim();
  if (!id || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
    console.error('[newsletter] segment_configuration_missing_or_invalid');
    throw Object.assign(new Error('Iscrizioni momentaneamente non disponibili. Riprova più tardi.'), { status: 503 });
  }
  return id.toLowerCase();
}

export async function assignNewsletterSegment(email, segmentId, alreadyConfirmed = false) {
  const contactPath = `contacts/${encodeURIComponent(email)}`;
  let stage = alreadyConfirmed ? 'read_contact' : 'create_contact';
  try {
    if (alreadyConfirmed) {
      const contact = await resend(contactPath, undefined, {}, 'GET');
      if (contact.unsubscribed !== false) throw Object.assign(new Error('Richiedi un nuovo link dal modulo newsletter per confermare nuovamente la tua scelta.'), { status: 400 });
    } else {
      await resend('contacts', { email, unsubscribed: false });
    }
    stage = 'assign_segment';
    await resend(`${contactPath}/segments/${segmentId}`, {});
    // The assignment response alone does not prove membership; read the contact's segments.
    stage = 'verify_segment';
    await verifySegmentMembership(contactPath, segmentId);
  } catch (error) {
    // Never log recipient addresses, tokens, API keys, or provider response bodies.
    console.error('[newsletter] segment_assignment_failed', JSON.stringify({ stage, status: error.upstreamStatus || error.status || 502, code: error.upstreamCode || 'unknown' }));
    if (stage === 'read_contact' && error.upstreamStatus === 404) throw Object.assign(new Error('Richiedi un nuovo link dal modulo newsletter.'), { status: 400 });
    throw Object.assign(new Error(error.status === 400 ? error.message : 'Non è stato possibile completare l’iscrizione. Riprova tra poco.'), { status: error.status === 400 ? 400 : 502 });
  }
}
