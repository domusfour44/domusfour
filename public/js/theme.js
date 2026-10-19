/* theme.js
   Tema chiaro/scuro. Va caricato nell'<head> per evitare il lampeggio. Usa il tema scuro di Bootstrap (data-bs-theme). */
(function () {
  var saved = null;
  try { saved = localStorage.getItem('dn_theme'); } catch (e) {}
  var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#theme-toggle')) return;
    var next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', next);
    try { localStorage.setItem('dn_theme', next); } catch (e) {}
  });
})();
