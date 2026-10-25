(async function () {
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const eur = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
  try {
    const response = await fetch('/api/products', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const products = (await response.json()).filter(p => !['maschere', 'fortuna'].includes(p.category) && !/\.svg(?:[?#]|$)/i.test(p.image));
    // Editorial pages reference the same product IDs without duplicating prices.
    document.querySelectorAll('[data-product-id]').forEach(card => {
      const product = products.find(p => p.id === card.dataset.productId);
      if (!product) { card.hidden = true; return; }
      card.querySelector('.price').textContent = eur(product.price);
      const buy = card.querySelector('[data-product-buy]');
      if (buy) {
        buy.href = `prodotto.html?id=${encodeURIComponent(product.id)}`;
        buy.textContent = 'Scopri il prodotto';
        buy.hidden = false;
      }
    });
    document.querySelectorAll('[data-products]').forEach(grid => {
      const items = products.filter(p => !grid.hasAttribute('data-featured') || p.featured);
      grid.innerHTML = items.length ? items.map(p => `<div class="col" data-cat="${escape(p.category)}"><article class="card product h-100"><a class="statue-box" href="prodotto.html?id=${encodeURIComponent(p.id)}" aria-label="Scopri ${escape(p.name)}"><img src="${escape(p.image)}" alt="${escape(p.name)}" loading="lazy"></a><div class="card-body d-flex flex-column"><span class="small text-gold">${escape(p.category_info?.name || p.category)}${p.badge ? ' · '+escape(p.badge) : ''}</span><h3 class="h5 mt-1"><a class="product-title-link" href="prodotto.html?id=${encodeURIComponent(p.id)}">${escape(p.name)}</a></h3><p class="small text-body-secondary">${escape(p.description)}</p><p class="small text-body-secondary">${escape(p.details)}</p><div class="d-flex justify-content-between align-items-center mt-auto gap-2"><span class="price">${eur(p.price)}</span><a class="btn btn-primary btn-sm" href="prodotto.html?id=${encodeURIComponent(p.id)}">Scopri</a></div></div></article></div>`).join('') : '<p role="status">Nessun prodotto disponibile.</p>';
    });
    // Reconcile persisted cart with current database prices and availability.
    document.dispatchEvent(new CustomEvent('catalog-loaded', { detail: products }));
    const filter = document.querySelector('[data-filter].active');
    if (filter) filter.click();
  } catch {
    document.querySelectorAll('[data-product-id]').forEach(card => {
      card.querySelector('.price').textContent = 'Prezzo non disponibile';
      const buy = card.querySelector('[data-product-buy]');
      if (buy) buy.hidden = true;
    });
    document.querySelectorAll('[data-products]').forEach(grid => { grid.innerHTML = '<p role="alert">Il catalogo non è disponibile al momento. <button class="btn btn-outline-primary btn-sm" onclick="location.reload()">Riprova</button></p>'; });
  }
})();
