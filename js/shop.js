/* shop.js
   Carrello, filtro della collezione e moduli (demo).
   Per aggiungere una statuetta NON serve toccare questo file: basta copiare una scheda nell'HTML. */
(function () {
  var FREE_SHIPPING = 100; // soglia spedizione gratuita, in euro
  var cart = [];
  try { cart = JSON.parse(localStorage.getItem('dn_cart') || '[]') || []; } catch (e) { cart = []; }

  var eur = function (n) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n); };
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var save = function () { try { localStorage.setItem('dn_cart', JSON.stringify(cart)); } catch (e) {} };

  function render() {
    var count = cart.reduce(function (a, i) { return a + i.q; }, 0);
    var total = cart.reduce(function (a, i) { return a + i.q * i.price; }, 0);
    var badge = $('#cart-count');
    badge.textContent = count;
    badge.classList.toggle('d-none', count === 0);

    if (!cart.length) {
      $('#cart-items').innerHTML = '<div class="text-center text-body-secondary py-5"><strong class="d-block text-body fs-5">Il carrello è vuoto</strong>Scegli una statuetta dalla collezione e aggiungila qui.</div>';
      $('#cart-footer').innerHTML = '<a class="btn btn-primary w-100" href="collezione.html">Vai alla collezione</a>';
      return;
    }
    $('#cart-items').innerHTML = '<ul class="list-group list-group-flush">' + cart.map(function (i) {
      return '<li class="list-group-item bg-transparent px-0 d-flex gap-3 align-items-center">' +
        '<div class="cart-thumb"><img src="' + esc(i.img) + '" alt=""></div>' +
        '<div class="flex-grow-1"><div class="fw-bold">' + esc(i.name) + '</div>' +
        '<div class="d-flex align-items-center gap-2 mt-2">' +
        '<button class="btn btn-outline-secondary btn-sm" data-dec="' + esc(i.id) + '" aria-label="Diminuisci quantità">-</button>' +
        '<span>' + i.q + '</span>' +
        '<button class="btn btn-outline-secondary btn-sm" data-inc="' + esc(i.id) + '" aria-label="Aumenta quantità">+</button></div></div>' +
        '<div class="fw-bold">' + eur(i.price * i.q) + '</div></li>';
    }).join('') + '</ul>';
    var free = total >= FREE_SHIPPING;
    $('#cart-footer').innerHTML =
      '<div class="d-flex justify-content-between fs-5 fw-bold mb-1"><span>Totale</span><span>' + eur(total) + '</span></div>' +
      '<p class="small text-body-secondary">' + (free ? 'Spedizione gratuita inclusa.' : 'Ti mancano ' + eur(FREE_SHIPPING - total) + ' per la spedizione gratuita.') + '</p>' +
      '<button class="btn btn-primary w-100" data-checkout>Procedi all\'ordine</button>' +
      '<div class="alert alert-warning small mt-3 mb-0 d-none" id="cart-demo">Questo è un sito dimostrativo: nessun pagamento viene effettuato e nessun ordine viene inviato.</div>';
  }

  function change(id, d) {
    var item = cart.filter(function (i) { return i.id === id; })[0];
    if (!item) return;
    item.q += d;
    if (item.q <= 0) cart = cart.filter(function (i) { return i !== item; });
    save(); render();
  }

  function filterProducts(cat) {
    document.querySelectorAll('[data-filter]').forEach(function (b) { b.classList.toggle('active', b.dataset.filter === cat); });
    document.querySelectorAll('[data-cat]').forEach(function (c) { c.classList.toggle('d-none', cat !== 'tutte' && c.dataset.cat !== cat); });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-add],[data-inc],[data-dec],[data-filter],[data-checkout]');
    if (!t) return;
    if (t.hasAttribute('data-add')) {
      var d = t.dataset, item = cart.filter(function (i) { return i.id === d.id; })[0];
      if (item) item.q++; else cart.push({ id: d.id, name: d.name, price: +d.price, img: d.img, q: 1 });
      save(); render();
      bootstrap.Offcanvas.getOrCreateInstance('#cart').show();
    }
    if (t.dataset.inc) change(t.dataset.inc, 1);
    if (t.dataset.dec) change(t.dataset.dec, -1);
    if (t.dataset.filter) filterProducts(t.dataset.filter);
    if (t.hasAttribute('data-checkout')) $('#cart-demo').classList.remove('d-none');
  });

  /* Moduli dimostrativi: controllano i campi e mostrano un messaggio */
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-demo]');
    if (!f) return;
    e.preventDefault();
    if (!f.checkValidity()) { f.classList.add('was-validated'); return; }
    f.outerHTML = '<div class="alert alert-success mb-0"><strong>' + f.dataset.demo + '</strong><br>Sito dimostrativo: nessun dato è stato davvero inviato.</div>';
  });

  render();
  var hash = location.hash.replace('#', '');
  if (hash && document.querySelector('[data-filter="' + hash + '"]')) filterProducts(hash);
})();
