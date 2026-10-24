const $ = s => document.querySelector(s);
const editor = $('#editor');
let products = [], editing = null;
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message = text => { $('#status').textContent = text; };
function showAccess() { $('#access').hidden = false; $('#workspace').hidden = true; $('#logout').hidden = true; }
async function api(path, method = 'GET', data) {
  const response = await fetch('/api/admin/' + path, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  const result = await response.json();
  if (response.status === 401) showAccess();
  if (!response.ok) throw new Error(result.error || 'Richiesta non riuscita.');
  return result;
}
function reset() { editing = null; editor.reset(); editor.elements.id.readOnly = false; $('#editor-title').textContent = 'Nuovo prodotto'; }
function render() {
  const query = $('#search').value.toLowerCase();
  const visible = products.filter(p => (p.name+' '+p.id).toLowerCase().includes(query));
  $('#count').textContent = `${visible.length} prodotti · ${products.filter(p => p.active).length} pubblicati`;
  $('#products').innerHTML = visible.length ? visible.map(p => `<article class="admin-row"><img src="${escape(p.image)}" alt=""><div class="info"><h3 class="h6 mb-1">${escape(p.name)}</h3><span>${new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(p.price)} · ${p.active ? 'Pubblicato' : 'Bozza'}${p.featured ? ' · In home' : ''}</span><small class="d-block text-body-secondary">${escape(p.id)}</small></div><div class="actions"><button class="btn btn-outline-primary btn-sm" data-edit="${escape(p.id)}" aria-label="Modifica ${escape(p.name)}">Modifica</button><button class="btn btn-outline-danger btn-sm" data-delete="${escape(p.id)}" aria-label="Elimina ${escape(p.name)}">Elimina</button></div></article>`).join('') : '<p>Nessun prodotto trovato.</p>';
}
async function load() {
  products = await api('products'); render();
  $('#access').hidden = true; $('#workspace').hidden = false; $('#logout').hidden = false;
}
$('#login').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
  try { await api('login','POST',Object.fromEntries(new FormData(event.target))); event.target.reset(); await load(); message('Accesso effettuato.'); } catch(error) { message(error.message); } finally { button.disabled = false; }
});
$('#logout').onclick = async () => { try { await api('logout','POST'); products=[]; reset(); showAccess(); message('Hai effettuato l’uscita.'); } catch(error) { message(error.message); } };
$('#new').onclick = () => { reset(); editor.elements.id.focus(); };
$('#cancel').onclick = reset;
$('#search').oninput = render;
$('#products').onclick = async event => {
  const button = event.target.closest('button'); if (!button) return;
  const p = products.find(p => p.id === (button.dataset.edit || button.dataset.delete)); if (!p) return;
  if (button.dataset.edit) {
    editing = p.id;
    for (const [key,value] of Object.entries(p)) if (editor.elements[key]) { if (editor.elements[key].type === 'checkbox') editor.elements[key].checked = value; else editor.elements[key].value = value; }
    editor.elements.id.readOnly = true; $('#editor-title').textContent = 'Modifica prodotto'; editor.elements.name.focus();
  } else if (confirm(`Eliminare definitivamente “${p.name}”?`)) {
    button.disabled = true;
    try { await api('products/'+encodeURIComponent(p.id),'DELETE'); if (editing === p.id) reset(); await load(); message('Prodotto eliminato.'); } catch(error) { message(error.message); } finally { button.disabled=false; }
  }
};
editor.addEventListener('submit', async event => {
  event.preventDefault(); if (!editor.reportValidity()) return;
  const data = Object.fromEntries(new FormData(editor)); data.price = Number(data.price); data.active = editor.elements.active.checked; data.featured = editor.elements.featured.checked;
  const button = editor.querySelector('[type="submit"]'); button.disabled = true;
  try { await api('products'+(editing ? '/'+encodeURIComponent(editing) : ''),editing ? 'PUT' : 'POST',data); reset(); await load(); message('Prodotto salvato. Il catalogo è aggiornato.'); } catch(error) { message(error.message); } finally { button.disabled = false; }
});
(async () => { try { await api('session'); await load(); } catch(error) { if (error.message !== 'Accedi come amministratore.') message(error.message); } })();
