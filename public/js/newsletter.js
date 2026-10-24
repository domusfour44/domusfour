const form = document.querySelector('[data-newsletter]');
const confirmButton = document.querySelector('[data-confirm-newsletter]');
async function newsletterRequest(path, data, button, output) {
  button.disabled = true;
  output.textContent = 'Invio in corso…';
  try {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    output.textContent = result.message;
    return true;
  } catch (error) { output.textContent = error.message || 'Servizio non disponibile. Riprova.'; return false; }
  finally { button.disabled = false; }
}
if (form) {
  const output = document.createElement('p'); output.setAttribute('role', 'status'); form.append(output);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!form.reportValidity()) return;
    if (await newsletterRequest('/api/newsletter', { email: form.elements.email.value, consent: form.elements.consent.checked }, form.querySelector('button'), output)) form.reset();
  });
}
if (confirmButton) {
  const token = new URLSearchParams(location.search).get('token');
  history.replaceState(null, '', location.pathname);
  confirmButton.addEventListener('click', async () => {
    if (await newsletterRequest('/api/newsletter/confirm', { token }, confirmButton, document.querySelector('[role="status"]'))) confirmButton.hidden = true;
  });
}
