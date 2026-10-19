const CONTACT_API_URL = 'https://domusfour.onrender.com/api/contact';
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

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Invio non riuscito');
      }

      contactForm.reset();
      window.alert('Messaggio inviato. Grazie!');
    } catch (error) {
      console.error('Errore invio form:', error);
      window.alert('Non è stato possibile inviare il messaggio. Riprova più tardi.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
}
