const CONTACT_API_URL = '/api/contact';
const contactForm = document.querySelector('form[name="contatti"]');

if (contactForm) {
  const status = document.querySelector('#contact-status');
  let requestKey, previousPayload;
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!contactForm.reportValidity()) return;
    status.textContent = 'Invio del messaggio in corso…';

    const submitButton = contactForm.querySelector('[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : '';

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Invio in corso…';
    }

    try {
      const formData = Object.fromEntries(new FormData(contactForm).entries());
      const payload = JSON.stringify(formData);
      if (payload !== previousPayload) { requestKey = crypto.randomUUID(); previousPayload = payload; }
      formData.request_key = requestKey;
      const response = await fetch(CONTACT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Il servizio contatti non è raggiungibile. Verifica l’inoltro delle API da Vercel a Render.');
      }
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Invio non riuscito');
      }

      contactForm.reset();
      requestKey = null; previousPayload = null;
      status.textContent = `Messaggio ricevuto. Il tuo ticket è ${result.ticket_id}. ` + (result.email_sent ? 'Ti abbiamo inviato una ricevuta con il riepilogo. Controlla anche la cartella spam.' : 'La richiesta è salvata, ma non è stato possibile inviare la ricevuta email. Conserva il numero del ticket: non serve reinviare il messaggio.');
      status.focus();
    } catch (error) {
      status.textContent = error.message || 'Non è stato possibile inviare il messaggio. Riprova più tardi.';
      status.focus();
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
}
