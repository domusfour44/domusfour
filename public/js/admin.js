const $ = s => document.querySelector(s);
const editor = $('#editor');
let products = [], categories = [], editing = null;
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const message = text => { $('#status').textContent = text; };
function showAccess() { $('#access').hidden = false; $('#workspace').hidden = true; $('#logout').hidden = true; $('#tickets').replaceChildren(); }
async function api(path, method = 'GET', data) {
  const response = await fetch('/api/admin/' + path, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Le API non sono raggiungibili su questo dominio. Verifica il deploy e l’inoltro da Vercel a Render.');
  }
  const result = await response.json();
  if (response.status === 401) showAccess();
  if (response.status === 403) throw new Error('Dominio non autorizzato. Apri l’admin su https://domusfour.it/admin.html e verifica SITE_URL su Render.');
  if (!response.ok) throw new Error(result.error || 'Richiesta non riuscita.');
  return result;
}
function reset() { editing = null; editor.reset(); editor.elements.id.readOnly = false; $('#editor-title').textContent = 'Nuovo prodotto'; }
function render() {
  const query = $('#search').value.toLowerCase();
  const visible = products.filter(p => (p.name + ' ' + p.id).toLowerCase().includes(query));
  $('#count').textContent = `${visible.length} prodotti · ${products.filter(p => p.active).length} pubblicati`;
  $('#products').innerHTML = visible.length ? visible.map(p => `<article class="admin-row"><img src="${escape(p.image)}" alt=""><div class="info"><h3 class="h6 mb-1">${escape(p.name)}</h3><span>${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(p.price)} · ${p.active ? 'Pubblicato' : 'Bozza'}${p.featured ? ' · In home' : ''}</span><small class="d-block text-body-secondary">${escape(p.id)}</small></div><div class="actions"><button class="btn btn-outline-primary btn-sm" data-edit="${escape(p.id)}" aria-label="Modifica ${escape(p.name)}">Modifica</button><button class="btn btn-outline-danger btn-sm" data-delete="${escape(p.id)}" aria-label="Elimina ${escape(p.name)}">Elimina</button></div></article>`).join('') : '<p>Nessun prodotto trovato.</p>';
}
async function load() {
  const result = await Promise.all([api('products'), api('categories')]);
  products = result[0]; categories = result[1]; renderCategories(); render();
  $('#access').hidden = true; $('#workspace').hidden = false; $('#logout').hidden = false;
  await loadTickets();
}
let ticketOffset = 0, ticketsLoading = false;
const ticketStates = { new: 'Nuovo', in_progress: 'In lavorazione', closed: 'Chiuso' };
const ticketCode = ticket => `DF-${String(ticket.ticket_number).padStart(6, '0')}`;
async function loadTickets() {
  if (ticketsLoading) return;
  ticketsLoading = true;
  const status = $('#tickets-status'); status.textContent = 'Caricamento ticket…';
  $('#tickets-refresh').disabled = true; $('#tickets-prev').disabled = true; $('#tickets-next').disabled = true;
  $('#tickets-filter').disabled = true;
  try {
    const tickets = await api(`tickets?offset=${ticketOffset}&status=${encodeURIComponent($('#tickets-filter').value)}`);
    $('#tickets').innerHTML = tickets.length ? tickets.map(ticket => `<details class="ticket"><summary><strong>${escape(ticketCode(ticket))} · ${escape(ticket.name)}</strong><span>${escape(ticketStates[ticket.status])} · ${escape(new Intl.DateTimeFormat('it-IT', {dateStyle:'short',timeStyle:'short',timeZone:'Europe/Rome'}).format(new Date(ticket.created_at)))}</span></summary><div class="ticket-content"><p><strong>${escape(ticket.reason)}</strong></p><p>Email: <a href="mailto:${escape(ticket.email)}">${escape(ticket.email)}</a><br>Telefono: ${escape(ticket.phone || 'Non indicato')}</p><p class="ticket-message">${escape(ticket.message)}</p><div class="d-flex flex-wrap gap-3 align-items-end"><label class="form-label mb-0">Stato del ticket<select class="form-select" data-ticket-state="${escape(ticket.id)}">${Object.entries(ticketStates).map(([id,label]) => `<option value="${id}" ${ticket.status === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><span class="small">Ricevuta email: ${ticket.email_status === 'sent' ? 'inviata' : ticket.email_status === 'failed' ? 'non inviata' : 'in attesa'}</span>${ticket.email_status !== 'sent' ? `<button type="button" class="btn btn-outline-primary btn-sm" data-ticket-receipt="${escape(ticket.id)}">Riprova invio ricevuta</button>` : ''}</div></div></details>`).join('') : '<p>Nessun ticket da mostrare.</p>';
    status.textContent = tickets.length ? `Ticket ${ticketOffset + 1}–${ticketOffset + tickets.length}. Apri un ticket per leggere il messaggio.` : 'Nessun messaggio in questa pagina.';
    $('#tickets-prev').disabled = ticketOffset === 0;
    $('#tickets-next').disabled = tickets.length < 50;
  } catch (error) { status.textContent = error.message; }
  finally { ticketsLoading = false; $('#tickets-refresh').disabled = false; $('#tickets-filter').disabled = false; }
}
$('#tickets-refresh').onclick = loadTickets;
$('#tickets-filter').onchange = () => { if (!ticketsLoading) { ticketOffset = 0; loadTickets(); } };
$('#tickets-prev').onclick = () => { ticketOffset = Math.max(0,ticketOffset - 50); loadTickets(); };
$('#tickets-next').onclick = () => { ticketOffset += 50; loadTickets(); };
$('#tickets').addEventListener('change', async event => {
  const select = event.target.closest('[data-ticket-state]'); if (!select) return;
  select.disabled = true;
  try { await api(`tickets/${select.dataset.ticketState}`, 'PATCH', { status: select.value }); await loadTickets(); }
  catch (error) { $('#tickets-status').textContent = error.message; }
  finally { select.disabled = false; }
});
$('#tickets').addEventListener('click', async event => {
  const button = event.target.closest('[data-ticket-receipt]'); if (!button) return;
  button.disabled = true;
  try { await api(`tickets/${button.dataset.ticketReceipt}/receipt`, 'POST'); await loadTickets(); }
  catch (error) { $('#tickets-status').textContent = error.message; }
  finally { button.disabled = false; }
});
function renderCategories(selected = editor.elements.category.value) {
  const select = editor.elements.category;
  select.innerHTML = '<option value="">Scegli una categoria</option>' + categories.map(c => `<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');
  select.value = categories.some(c => c.id === selected) ? selected : '';
  $('#category-list').textContent = categories.length ? categories.map(c => c.name).join(' · ') : 'Non ci sono categorie. Crea la prima per aggiungere un prodotto.';
}
$('#category-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target; if (!form.reportValidity()) return;
  const button = form.querySelector('button'); button.disabled = true;
  const status = $('#category-status'); status.textContent = 'Creazione in corso…';
  try {
    const created = await api('categories', 'POST', { name: form.elements.name.value });
    categories = await api('categories');
    renderCategories(created[0].id);
    form.reset();
    status.textContent = 'Categoria creata e selezionata nel prodotto.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
$('#login').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
  try { await api('login', 'POST', Object.fromEntries(new FormData(event.target))); event.target.reset(); await load(); message('Accesso effettuato.'); } catch (error) { message(error.message); } finally { button.disabled = false; }
});
$('#logout').onclick = async () => { try { await api('logout', 'POST'); products = []; reset(); showAccess(); message('Hai effettuato l’uscita.'); } catch (error) { message(error.message); } };
$('#new').onclick = () => { reset(); editor.elements.id.focus(); };
$('#cancel').onclick = reset;
$('#search').oninput = render;
$('#products').onclick = async event => {
  const button = event.target.closest('button'); if (!button) return;
  const p = products.find(p => p.id === (button.dataset.edit || button.dataset.delete)); if (!p) return;
  if (button.dataset.edit) {
    editing = p.id;
    for (const [key, value] of Object.entries(p)) if (editor.elements[key]) { if (editor.elements[key].type === 'checkbox') editor.elements[key].checked = value; else editor.elements[key].value = value; }
    editor.elements.id.readOnly = true; $('#editor-title').textContent = 'Modifica prodotto'; editor.elements.name.focus();
  } else if (confirm(`Eliminare definitivamente “${p.name}”?`)) {
    button.disabled = true;
    try { await api('products/' + encodeURIComponent(p.id), 'DELETE'); if (editing === p.id) reset(); await load(); message('Prodotto eliminato.'); } catch (error) { message(error.message); } finally { button.disabled = false; }
  }
};
editor.addEventListener('submit', async event => {
  event.preventDefault(); if (!editor.reportValidity()) return;
  const data = Object.fromEntries(new FormData(editor)); data.price = Number(data.price); data.active = editor.elements.active.checked; data.featured = editor.elements.featured.checked;
  const button = editor.querySelector('[type="submit"]'); button.disabled = true;
  try { await api('products' + (editing ? '/' + encodeURIComponent(editing) : ''), editing ? 'PUT' : 'POST', data); reset(); await load(); message('Prodotto salvato. Il catalogo è aggiornato.'); } catch (error) { message(error.message); } finally { button.disabled = false; }
});
(async () => { try { await api('session'); await load(); } catch (error) { if (error.message !== 'Accedi come amministratore.') message(error.message); } })();
