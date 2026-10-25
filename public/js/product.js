(function () {
  const $ = selector => document.querySelector(selector);
  const id = new URLSearchParams(location.search).get('id');
  function state(title, description, retry = false) {
    $('#product-detail').hidden = true; $('#product-state').hidden = false;
    $('#state-title').textContent = title; $('#state-description').textContent = description;
    $('#product-retry').hidden = !retry; $('#product-back').hidden = false;
    document.title = `${title} · DomusFour`;
  }
  function showImage(url, name, index, count) {
    const image = $('#product-image');
    image.hidden = false; $('#photo-unavailable').hidden = true;
    image.alt = `${name} — foto ${index + 1} di ${count}`; image.src = url;
    $('#gallery-status').textContent = `Foto ${index + 1} di ${count}`;
    $('#product-thumbnails').querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  }
  $('#product-image').addEventListener('error', () => { $('#product-image').hidden = true; $('#photo-unavailable').hidden = false; });
  async function load() {
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id || '')) { state('Prodotto non trovato', 'Scegli un articolo dal catalogo per vedere foto e dettagli.'); return; }
    $('#product-retry').disabled = true;
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (response.status === 404) { state('Prodotto non disponibile', 'Questo articolo non è più nel catalogo. Puoi scoprire gli altri prodotti o contattarci per informazioni.'); return; }
      if (!response.ok) throw new Error();
      const product = await response.json();
      const photos = [...new Set([product.image, ...(product.images || [])].filter(Boolean))].slice(0, 8);
      $('#product-name').textContent = product.name;
      $('#product-category').textContent = product.category_info?.name || product.category;
      $('#product-price').textContent = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(product.price);
      $('#product-description').textContent = product.description || '';
      $('#product-description').hidden = !product.description;
      $('#product-details').textContent = product.details || ''; $('#product-specs').hidden = !product.details;
      $('#product-badge').textContent = product.badge || ''; $('#product-badge').hidden = !product.badge;
      $('#breadcrumb-name').textContent = product.name; $('#breadcrumb-separator').hidden = false;
      document.title = `${product.name} · DomusFour`;
      document.querySelector('meta[name="description"]').content = (product.description || `Scopri ${product.name}: foto, dettagli e prezzo aggiornato su DomusFour.`).slice(0, 160);
      const buy = $('#product-buy');
      const external = typeof product.purchase_url === 'string' && /^https:\/\//.test(product.purchase_url);
      buy.hidden = !external; $('#purchase-note').hidden = !external;
      if (external) { buy.href = product.purchase_url; buy.textContent = new URL(product.purchase_url).hostname.endsWith('vinted.it') ? 'Acquista su Vinted' : 'Acquista'; }
      const contact = $('#product-contact');
      contact.className = external ? 'product-contact' : 'btn btn-primary btn-lg';
      contact.textContent = external ? 'Hai una domanda? Contattaci' : 'Chiedi informazioni';
      $('#product-thumbnails').replaceChildren();
      photos.forEach((url, index) => {
        const button = document.createElement('button'); button.type = 'button';
        button.setAttribute('aria-label', `Mostra foto ${index + 1} di ${product.name}`); button.setAttribute('aria-pressed', String(index === 0));
        const image = document.createElement('img'); image.src = url; image.alt = ''; image.loading = 'lazy';
        button.append(image); button.addEventListener('click', () => showImage(url, product.name, index, photos.length));
        $('#product-thumbnails').append(button);
      });
      $('#product-thumbnails').hidden = photos.length < 2;
      showImage(photos[0], product.name, 0, photos.length);
      $('#product-state').hidden = true; $('#product-detail').hidden = false;
    } catch { state('Il prodotto non è disponibile al momento', 'Non siamo riusciti a caricare i dettagli. Riprova tra poco.', true); }
    finally { $('#product-retry').disabled = false; }
  }
  $('#product-retry').addEventListener('click', load);
  load();
})();
