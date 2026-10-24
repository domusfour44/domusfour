(async function () {
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const eur = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
  const labels = { santi: 'Santi', calcio: 'Calcio', maschere: 'Maschere', fortuna: 'Portafortuna' };
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error();
    const products = await response.json();
    document.querySelectorAll('[data-products]').forEach(grid => {
      const items = products.filter(p => !grid.hasAttribute('data-featured') || p.featured);
      grid.innerHTML = items.length ? items.map(p => `<div class="col" data-cat="${escape(p.category)}"><article class="card product h-100"><div class="statue-box"><img src="${escape(p.image)}" alt="${escape(p.name)}"></div><div class="card-body d-flex flex-column"><span class="small text-gold">${escape(labels[p.category] || p.category)}${p.badge ? ' · '+escape(p.badge) : ''}</span><h3 class="h5 mt-1">${escape(p.name)}</h3><p class="small text-body-secondary">${escape(p.description)}</p><p class="small text-body-secondary">${escape(p.details)}</p><div class="d-flex justify-content-between align-items-center mt-auto gap-2"><span class="price">${eur(p.price)}</span>${p.purchase_url ? `<a class="btn btn-primary btn-sm" href="${escape(p.purchase_url)}" rel="noopener">Acquista</a>` : `<button class="btn btn-primary btn-sm" data-add data-id="${escape(p.id)}" data-name="${escape(p.name)}" data-price="${p.price}" data-img="${escape(p.image)}">Aggiungi</button>`}</div></div></article></div>`).join('') : '<p role="status">Nessun prodotto disponibile.</p>';
    });
    // Reconcile persisted cart with current database prices and availability.
    document.dispatchEvent(new CustomEvent('catalog-loaded', { detail: products }));
    const filter = document.querySelector('[data-filter].active');
    if (filter) filter.click();
  } catch {
    document.querySelectorAll('[data-products]').forEach(grid => { grid.innerHTML = '<p role="alert">Il catalogo non è disponibile al momento. <button class="btn btn-outline-primary btn-sm" onclick="location.reload()">Riprova</button></p>'; });
  }
})();
