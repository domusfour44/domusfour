const form = document.querySelector('[data-newsletter]');
const confirmButton = document.querySelector('[data-confirm-newsletter]');
async function newsletterRequest(path, data, button, output) {
  button.disabled = true;
  output.textContent = 'Invio in corso…';
  output.dataset.errorCode = '';
  try {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    output.dataset.errorCode = String(response.status);
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Servizio momentaneamente non disponibile. Riprova tra poco.');
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
  const card = document.querySelector('[data-confirmation]');
  const title = document.querySelector('#confirmation-title');
  const description = document.querySelector('#confirmation-description');
  const output = document.querySelector('.confirmation-status');
  const icon = document.querySelector('[data-confirm-icon]');
  const restart = document.querySelector('[data-confirm-restart]');
  function setState(state) {
    card.dataset.state = state;
    card.setAttribute('aria-busy', String(state === 'pending'));
    if (state === 'success') {
      title.textContent = 'Iscrizione confermata.';
      description.textContent = 'Benvenuto in DomusFour. Le prossime novità e offerte arriveranno direttamente nella tua casella.';
      icon.innerHTML = '<path d="m8 16 5 5L25 9"/>';
      confirmButton.hidden = true;
      output.textContent = '';
      document.querySelector('[data-confirm-return]').textContent = 'Scopri i prodotti';
      document.querySelector('[data-confirm-return]').href = 'napoli.html#prodotti';
      document.title = 'Iscrizione confermata · DomusFour';
      title.focus({ preventScroll: true });
    }
    if (state === 'invalid') {
      title.textContent = 'Ti serve un nuovo link.';
      description.textContent = 'Questo link non è valido o è scaduto. Torna alla newsletter e richiedine uno nuovo: basta inserire di nuovo la tua email.';
      icon.innerHTML = '<circle cx="16" cy="16" r="11"/><path d="M16 9v8l5 3"/>';
      confirmButton.hidden = true; restart.hidden = false; output.textContent = '';
    }
    if (state === 'error') {
      title.textContent = 'Riproviamo tra poco.';
      description.textContent = 'Non siamo riusciti a completare la conferma. Riprova con il pulsante qui sotto.';
      confirmButton.firstChild.textContent = 'Riprova la conferma';
      output.textContent = output.dataset.errorCode === '429' ? 'Hai effettuato diversi tentativi. Attendi 15 minuti prima di riprovare.' : 'Il servizio è momentaneamente non disponibile. Se il problema continua, contattaci.';
    }
  }
  if (!token) setState('invalid');
  confirmButton.addEventListener('click', async () => {
    setState('pending');
    confirmButton.firstChild.textContent = 'Conferma in corso…';
    const success = await newsletterRequest('/api/newsletter/confirm', { token }, confirmButton, output);
    setState(success ? 'success' : output.dataset.errorCode === '400' ? 'invalid' : 'error');
  });
}
