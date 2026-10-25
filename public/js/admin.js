const $ = s => document.querySelector(s);
const editor = $('#editor');
let products = [], categories = [], editing = null;
let gallery = [], editorBusy = false;
let currentUser = null, adminUsers = [], resettingUser = null, usersLoading = false;
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const message = text => { ($('#workspace').hidden ? $('#login-status') : $('#status')).textContent = text; };
function showAccess() { document.title = 'Accesso amministratore · DomusFour'; $('#access').hidden = false; $('#workspace').hidden = true; $('#logout').hidden = true; $('#tickets').replaceChildren(); $('#users-list').replaceChildren(); resetUserForm(); $('#password-form').reset(); currentUser = null; adminUsers = []; reset(); }
async function api(path, method = 'GET', data) {
  const response = await fetch('/api/admin/' + path, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Le API non sono raggiungibili su questo dominio. Verifica il deploy e l’inoltro da Vercel a Render.');
  }
  const result = await response.json();
  if (response.status === 401) showAccess();
  if (response.status === 403 && result.error === 'Origine non consentita.') throw new Error('Dominio non autorizzato. Apri l’admin su https://domusfour.it/admin.html e verifica SITE_URL su Render.');
  if (!response.ok) throw new Error(result.error || 'Richiesta non riuscita.');
  return result;
}
function reset() {
  gallery = []; $('#photo-list').replaceChildren(); $('#photo-status').textContent = '';
  editing = null; editor.reset(); editor.elements.id.readOnly = false; $('#editor-title').textContent = 'Nuovo prodotto';
  $('#product-editor').hidden = true; $('#product-layout').classList.remove('is-editing');
}
function productPhotos() { return [...new Set([editor.elements.image.value.trim(), ...gallery].filter(Boolean))]; }
function renderPhotos() {
  $('#photo-list').innerHTML = productPhotos().map((url, index) => {
    let name; try { name = decodeURIComponent(url.split('/').at(-1).split('?')[0]); } catch { name = 'Foto prodotto'; }
    return `<div class="admin-photo"><img src="${escape(url)}" alt="Foto ${index + 1}"><div><span>${escape(name)}</span><button type="button" class="admin-photo-cover" data-cover="${index}" ${url === editor.elements.image.value ? 'disabled' : ''}>${url === editor.elements.image.value ? 'Copertina' : 'Usa come copertina'}</button></div><button type="button" class="btn btn-outline-danger btn-sm" data-remove-photo="${index}" aria-label="Rimuovi foto ${index + 1}">Rimuovi</button></div>`;
  }).join('');
}
function busyEditor(busy) {
  editorBusy = busy;
  $('#editor-fields').disabled = busy;
  for (const id of ['cancel', 'new', 'logout']) $('#' + id).disabled = busy;
  editor.setAttribute('aria-busy', String(busy));
}
editor.elements.image.addEventListener('change', renderPhotos);
$('#photo-list').addEventListener('click', event => {
  if (editorBusy) return;
  const button = event.target.closest('[data-cover],[data-remove-photo]'); if (!button) return;
  const photos = productPhotos();
  if (button.hasAttribute('data-cover')) editor.elements.image.value = photos[Number(button.dataset.cover)];
  else {
    const removed = photos.splice(Number(button.dataset.removePhoto), 1)[0];
    if (editor.elements.image.value === removed) editor.elements.image.value = photos[0] || '';
  }
  gallery = photos;
  renderPhotos();
});
$('#photo-upload').addEventListener('change', async event => {
  const files = [...event.target.files]; if (!files.length || editorBusy) return;
  const status = $('#photo-status');
  if (productPhotos().length + files.length > 8) { status.textContent = 'Puoi aggiungere al massimo 8 foto. Rimuovine una prima di continuare.'; event.target.value = ''; return; }
  if (files.some(file => file.size > 4 * 1024 * 1024 || !/\.(jpe?g|png|webp)$/i.test(file.name))) { status.textContent = 'Scegli foto JPG, PNG o WebP, fino a 4 MB ciascuna.'; event.target.value = ''; return; }
  busyEditor(true);
  let uploaded = 0;
  try {
    for (const file of files) {
      status.textContent = `Caricamento foto ${uploaded + 1} di ${files.length}…`;
      const type = /\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/jpeg';
      const response = await fetch('/api/admin/images', { method: 'POST', headers: { 'Content-Type': type, 'X-File-Name': encodeURIComponent(file.name) }, body: file });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) showAccess();
      if (!response.ok) throw new Error(result.error || 'Caricamento non riuscito. Riprova.');
      gallery = [...productPhotos(), result.url];
      if (!editor.elements.image.value) editor.elements.image.value = result.url;
      uploaded++; renderPhotos();
    }
    status.textContent = `${uploaded === 1 ? 'Foto caricata' : `${uploaded} foto caricate`}. Salva il prodotto per pubblicare.`;
  } catch (error) { status.textContent = `${uploaded ? `${uploaded} foto caricate. ` : ''}${error.message}`; }
  finally { event.target.value = ''; busyEditor(false); }
});
function openEditor() {
  $('#product-editor').hidden = false; $('#product-layout').classList.add('is-editing');
}
const adminViews = {
  tickets: { title: 'Ticket e messaggi', description: 'Le richieste dei clienti, dal primo messaggio alla chiusura.' },
  products: { title: 'Prodotti', description: 'Aggiorna il catalogo, i prezzi e la visibilità dei tuoi articoli.' },
  categories: { title: 'Categorie', description: 'Organizza i prodotti e crea nuove categorie per il catalogo.' },
  users: { title: 'Utenti', description: 'Crea accessi personali per i collaboratori e gestisci chi può entrare nel pannello.' },
  password: { title: 'La tua password', description: 'Proteggi il tuo accesso con una password personale.' }
};
function setView(view, focus = false) {
  if (!Object.hasOwn(adminViews, view)) view = 'tickets';
  if (currentUser?.must_change_password) view = 'password';
  if ((view === 'users' && !currentUser?.owner) || (view === 'password' && currentUser?.owner)) view = 'tickets';
  document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== view; });
  document.querySelectorAll('[data-view]').forEach(link => {
    if (link.dataset.view === view) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('#view-title').textContent = adminViews[view].title;
  $('#view-description').textContent = adminViews[view].description;
  document.title = `${adminViews[view].title} · DomusFour Admin`;
  $('#status').textContent = '';
  if (view === 'users') loadUsers();
  if (focus) { $('#view-title').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'auto' }); }
}
window.addEventListener('hashchange', () => {
  const view = location.hash.slice(1);
  if (!$('#workspace').hidden && Object.hasOwn(adminViews, view)) setView(view, true);
});
document.querySelector('.admin-nav').addEventListener('click', event => {
  const link = event.target.closest('[data-view]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (location.hash !== link.hash) history.pushState(null, '', link.hash);
  setView(link.dataset.view, true);
});
function render() {
  const query = $('#search').value.toLowerCase();
  const visible = products.filter(p => (p.name + ' ' + p.id).toLowerCase().includes(query));
  $('#count').textContent = `${visible.length} prodotti · ${products.filter(p => p.active).length} pubblicati`;
  $('#products').innerHTML = visible.length ? visible.map(p => `<article class="admin-row"><img src="${escape(p.image)}" alt=""><div class="info"><h3 class="h6 mb-1">${escape(p.name)}</h3><span>${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(p.price)} · ${p.active ? 'Pubblicato' : 'Bozza'}${p.featured ? ' · In home' : ''}</span><small class="d-block text-body-secondary">${escape(p.id)}</small></div><div class="actions">${p.active ? `<a class="btn btn-outline-primary btn-sm" href="prodotto.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener" aria-label="Apri scheda ${escape(p.name)}">Apri scheda</a>` : ''}<button class="btn btn-outline-primary btn-sm" data-edit="${escape(p.id)}" aria-label="Modifica ${escape(p.name)}">Modifica</button><button class="btn btn-outline-danger btn-sm" data-delete="${escape(p.id)}" aria-label="Elimina ${escape(p.name)}">Elimina</button></div></article>`).join('') : (query ? '<p>Nessun prodotto trovato. Prova un altro nome o codice.</p>' : '<p>Il catalogo è vuoto. Usa «Nuovo prodotto» per aggiungere il primo articolo.</p>');
}
async function load() {
  currentUser = (await api('session')).user;
  document.querySelectorAll('[data-view]').forEach(link => {
    link.hidden = currentUser.must_change_password ? link.dataset.view !== 'password'
      : link.dataset.view === 'users' ? !currentUser.owner : link.dataset.view === 'password' ? currentUser.owner : false;
  });
  $('#password-help').textContent = currentUser.must_change_password ? 'Prima di continuare devi sostituire la password iniziale con una personale, di almeno 6 caratteri.' : 'Usa una password diversa da quella attuale, di almeno 6 caratteri.';
  if (currentUser.must_change_password) {
    $('#access').hidden = true; $('#workspace').hidden = false; $('#logout').hidden = false;
    setView('password'); return;
  }
  const result = await Promise.all([api('products'), api('categories')]);
  products = result[0]; categories = result[1]; renderCategories(); render();
  $('#access').hidden = true; $('#workspace').hidden = false; $('#logout').hidden = false;
  $('#login-status').textContent = '';
  setView(location.hash.slice(1));
  await loadTickets();
}
function resetUserForm() {
  resettingUser = null; $('#user-form').reset();
  $('#user-name-label').hidden = false; $('#user-email-label').hidden = false;
  $('#user-form').elements.name.required = true; $('#user-form').elements.email.required = true;
  $('#user-form-title').textContent = 'Aggiungi un utente'; $('#user-submit').textContent = 'Crea accesso'; $('#user-cancel').hidden = true;
  $('#user-form-help').textContent = 'I collaboratori possono gestire prodotti, categorie e ticket. Solo tu puoi gestire gli accessi.';
}
async function loadUsers() {
  if (!currentUser?.owner || usersLoading) return;
  usersLoading = true; $('#users-refresh').disabled = true; $('#users-status').textContent = 'Caricamento accessi…';
  try {
    adminUsers = await api('users');
    $('#users-list').innerHTML = adminUsers.map(user => `<article class="admin-user-row"><h3>${escape(user.name)}</h3><p>${escape(user.email)}</p><span class="admin-user-state">${user.owner ? 'Proprietario · accesso principale' : !user.active ? 'Accesso disattivato' : user.must_change_password ? 'Attivo · password iniziale da cambiare' : 'Accesso attivo'}</span>${user.owner ? '<p>Questo accesso è gestito dalle variabili su Render e non può essere disattivato qui.</p>' : `<div class="actions"><button type="button" class="btn btn-outline-primary btn-sm" data-user-active="${escape(user.id)}">${user.active ? 'Disattiva accesso' : 'Riattiva accesso'}</button><button type="button" class="btn btn-outline-secondary btn-sm" data-user-password="${escape(user.id)}">Reimposta password</button></div>`}</article>`).join('');
    $('#users-status').textContent = `${adminUsers.length} ${adminUsers.length === 1 ? 'accesso' : 'accessi'}. Le disattivazioni revocano anche le sessioni già aperte.`;
  } catch (error) { $('#users-status').textContent = error.message; }
  finally { usersLoading = false; $('#users-refresh').disabled = false; }
}
$('#users-refresh').onclick = loadUsers;
$('#user-cancel').onclick = () => { resetUserForm(); $('#user-form-status').textContent = ''; };
$('#users-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-user-active],[data-user-password]'); if (!button) return;
  const user = adminUsers.find(user => user.id === (button.dataset.userActive || button.dataset.userPassword)); if (!user || user.owner) return;
  if (button.dataset.userPassword) {
    resettingUser = user.id; $('#user-form').reset();
    $('#user-name-label').hidden = true; $('#user-email-label').hidden = true;
    $('#user-form').elements.name.required = false; $('#user-form').elements.email.required = false;
    $('#user-form-title').textContent = 'Reimposta password'; $('#user-submit').textContent = 'Salva password iniziale'; $('#user-cancel').hidden = false;
    $('#user-form-help').textContent = `Imposta una nuova password iniziale per ${user.name}. Le sessioni aperte verranno revocate e l’utente dovrà cambiarla al prossimo accesso.`;
    $('#user-form-status').textContent = ''; $('#user-form').elements.password.focus(); return;
  }
  if (user.active && !confirm(`Disattivare l’accesso di ${user.name}? Anche le sessioni già aperte perderanno l’accesso.`)) return;
  button.disabled = true;
  try { await api(`users/${user.id}`, 'PATCH', {active: !user.active}); await loadUsers(); }
  catch (error) { $('#users-status').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#user-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target; if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form)); const resetting = resettingUser;
  $('#user-fields').disabled = true; $('#user-form-status').textContent = resetting ? 'Aggiornamento in corso…' : 'Creazione accesso…';
  try {
    await api(resetting ? `users/${resetting}/password` : 'users', 'POST', resetting ? {password:data.password} : data);
    resetUserForm(); await loadUsers();
    $('#user-form-status').textContent = resetting ? 'Password reimpostata. Comunica personalmente la nuova password iniziale all’utente.' : 'Accesso creato. Comunica personalmente email e password iniziale all’utente: potrà entrare dalla stessa pagina admin.';
  } catch (error) { form.elements.password.value = ''; $('#user-form-status').textContent = error.message; }
  finally { $('#user-fields').disabled = false; }
});
$('#password-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target; if (!form.reportValidity()) return;
  if (form.elements.password.value !== form.elements.confirmation.value) { $('#password-status').textContent = 'Le nuove password non coincidono.'; return; }
  const data = {current_password:form.elements.current_password.value,password:form.elements.password.value};
  $('#password-fields').disabled = true; $('#password-status').textContent = 'Salvataggio in corso…';
  try { await api('password', 'POST', data); form.reset(); $('#password-status').textContent = 'Password aggiornata.'; history.replaceState(null,'','#tickets'); await load(); message('Password aggiornata. Puoi usare il pannello.'); }
  catch (error) { form.reset(); $('#password-status').textContent = error.message; }
  finally { $('#password-fields').disabled = false; }
});
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
    $('#tickets').innerHTML = tickets.length ? tickets.map(ticket => {
      const date = new Intl.DateTimeFormat('it-IT', {dateStyle:'short',timeStyle:'short',timeZone:'Europe/Rome'}).format(new Date(ticket.created_at));
      return `<details class="ticket"><summary><span class="ticket-identity"><span class="ticket-reference">${escape(ticketCode(ticket))}</span><strong>${escape(ticket.name)}</strong><span class="ticket-subject">${escape(ticket.reason)}</span></span><span class="ticket-meta"><time datetime="${escape(ticket.created_at)}">${escape(date)}</time><span class="status-badge" data-state="${escape(ticket.status)}">${escape(ticketStates[ticket.status])}</span></span></summary><div class="ticket-content"><p><strong>${escape(ticket.reason)}</strong></p><p>Email: <a href="mailto:${escape(ticket.email)}">${escape(ticket.email)}</a><br>Telefono: ${escape(ticket.phone || 'Non indicato')}</p><p class="ticket-message">${escape(ticket.message)}</p><div class="d-flex flex-wrap gap-3 align-items-end"><label class="form-label mb-0">Stato del ticket<select class="form-select" data-ticket-state="${escape(ticket.id)}">${Object.entries(ticketStates).map(([id,label]) => `<option value="${id}" ${ticket.status === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><span class="small">Ricevuta email: ${ticket.email_status === 'sent' ? 'inviata' : ticket.email_status === 'failed' ? 'non inviata' : 'in attesa'}</span>${ticket.email_status !== 'sent' ? `<button type="button" class="btn btn-outline-primary btn-sm" data-ticket-receipt="${escape(ticket.id)}">Riprova invio ricevuta</button>` : ''}</div></div></details>`;
    }).join('') : '<p>Non ci sono richieste da mostrare. I nuovi messaggi del modulo contatti compariranno qui.</p>';
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
  $('#category-list').innerHTML = categories.length ? '<ul class="category-items">' + categories.map(c => {
    const count = products.filter(p => p.category === c.id).length;
    return `<li>${escape(c.name)}<span>${count} ${count === 1 ? 'prodotto' : 'prodotti'}</span></li>`;
  }).join('') + '</ul>' : '<p>Non ci sono categorie. Crea la prima usando il modulo.</p>';
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
    status.textContent = 'Categoria creata. Ora puoi assegnarla ai tuoi prodotti.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
$('#login').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
  try { await api('login', 'POST', Object.fromEntries(new FormData(event.target))); event.target.reset(); await load(); message('Accesso effettuato.'); } catch (error) { message(error.message); } finally { button.disabled = false; }
});
$('#logout').onclick = async () => { try { await api('logout', 'POST'); products = []; reset(); showAccess(); message('Hai effettuato l’uscita.'); } catch (error) { message(error.message); } };
$('#new').onclick = () => { reset(); openEditor(); editor.elements.name.focus(); };
$('#cancel').onclick = reset;
$('#discard').onclick = reset;
$('#search').oninput = render;
$('#products').onclick = async event => {
  if (editorBusy) return;
  const button = event.target.closest('button'); if (!button) return;
  const p = products.find(p => p.id === (button.dataset.edit || button.dataset.delete)); if (!p) return;
  if (button.dataset.edit) {
    reset();
    editing = p.id;
    openEditor();
    for (const [key, value] of Object.entries(p)) if (editor.elements[key]) { if (editor.elements[key].type === 'checkbox') editor.elements[key].checked = value; else editor.elements[key].value = value; }
    gallery = [...new Set([p.image, ...(p.images || [])])]; renderPhotos();
    editor.elements.id.readOnly = true; $('#editor-title').textContent = 'Modifica prodotto'; editor.elements.name.focus();
  } else if (confirm(`Eliminare definitivamente “${p.name}”?`)) {
    button.disabled = true;
    try { await api('products/' + encodeURIComponent(p.id), 'DELETE'); if (editing === p.id) reset(); await load(); message('Prodotto eliminato.'); } catch (error) { message(error.message); } finally { button.disabled = false; }
  }
};
editor.addEventListener('submit', async event => {
  event.preventDefault(); if (editorBusy || !editor.reportValidity()) return;
  const data = Object.fromEntries(new FormData(editor)); data.price = Number(data.price); data.active = editor.elements.active.checked; data.featured = editor.elements.featured.checked;
  data.images = productPhotos();
  busyEditor(true);
  try { await api('products' + (editing ? '/' + encodeURIComponent(editing) : ''), editing ? 'PUT' : 'POST', data); reset(); await load(); message('Prodotto salvato. Il catalogo è aggiornato.'); } catch (error) { message(error.message); } finally { busyEditor(false); }
});
(async () => { try { await load(); } catch (error) { if (error.message !== 'Accedi come amministratore.') message(error.message); } })();
