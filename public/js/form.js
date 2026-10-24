const CONTACT_API_URL = '/api/contact';
const contactForm = document.querySelector('form[name="contatti"]');

if (contactForm) {
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!contactForm.reportValidity()) return;

    const submitButton = contactForm.querySelector('[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : '';

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Invio in corso…';
    }

    try {
      const formData = Object.fromEntries(new FormData(contactForm).entries());
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
      window.alert('Messaggio inviato. Grazie!');
    } catch (error) {
      console.error('Errore invio form:', error);
      window.alert(error.message || 'Non è stato possibile inviare il messaggio. Riprova più tardi.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
}
