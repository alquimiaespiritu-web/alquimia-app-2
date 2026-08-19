/* ============================================================
   Inyecta la barra superior NUEVA (idéntica en todas las páginas)
   en las páginas del motor viejo. Se usa junto con reskin-nuevo.css.
   No toca el contenido: solo pone la barra y oculta la vieja (vía CSS).
   ============================================================ */
(function () {
  var LOGO =
    '<svg class="nsello" viewBox="130 30 420 320" aria-hidden="true">' +
      '<defs><path id="rkIzq" d="M 217.0 249 L 329.6 54"/><path id="rkDer" d="M 350.4 54 L 463.0 249"/></defs>' +
      '<circle cx="340" cy="190" r="130" fill="none" stroke="#C6A15B" stroke-width="3.5"/>' +
      '<polygon points="340,60 452.6,255 227.4,255" fill="rgba(142,91,176,0.16)" stroke="#C6A15B" stroke-width="3"/>' +
      '<g fill="none" stroke="#C6A15B" stroke-width="3">' +
        '<line x1="310.6" y1="110" x2="369.4" y2="110"/>' +
        '<polygon points="255.9,218 298.6,218 277.25,255"/><polygon points="381.4,218 424.1,218 402.75,255"/>' +
        '<line x1="395.9" y1="243" x2="409.6" y2="243"/>' +
        '<circle cx="340" cy="190" r="50"/><line x1="290" y1="190" x2="330" y2="190"/><line x1="350" y1="190" x2="390" y2="190"/>' +
        '<circle cx="340" cy="190" r="10"/>' +
      '</g>' +
      '<circle cx="340" cy="190" r="3.8" fill="#C6A15B"/>' +
      '<g fill="#C6A15B" font-family="Georgia,\'Times New Roman\',serif">' +
        '<text font-size="17" letter-spacing="5"><textPath href="#rkIzq" text-anchor="middle" startOffset="50%">ALQUIMIA</textPath></text>' +
        '<text font-size="16" letter-spacing="1.5"><textPath href="#rkDer" text-anchor="middle" startOffset="50%">TRANSMUTACIÓN</textPath></text>' +
        '<text x="341" y="300" font-size="30" letter-spacing="11" text-anchor="middle">SOY</text>' +
      '</g>' +
    '</svg>';

  var PAIS =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' +
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18"/></svg>';
  var USER =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">' +
    '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6"/></svg>';

  function activo(href) {
    var p = (location.pathname.split('/').pop() || 'index.html');
    return p === href ? ' class="active"' : '';
  }

  function build() {
    if (document.querySelector('header.nbar')) return; // no duplicar
    var bar = document.createElement('header');
    bar.className = 'nbar';
    bar.innerHTML =
      '<div class="naq">' +
        '<a class="nbrand" href="index.html">' + LOGO + '<b>ALQUIMIA SOY</b></a>' +
        '<nav class="nnav">' +
          '<a href="marketplace.html"' + activo('marketplace.html') + '>Alquimistas</a>' +
          '<a href="experiencias.html"' + activo('experiencias.html') + '>Experiencias</a>' +
          '<a href="comunidad.html"' + activo('comunidad.html') + '>Comunidad</a>' +
          '<a href="noticias.html"' + activo('noticias.html') + '>Blog</a>' +
        '</nav>' +
        '<div class="nright">' +
          '<span class="nsel pais">' + PAIS + 'CO</span>' +
          '<span class="nsel">ES</span>' +
          '<a class="navatar" href="registro.html" title="Tu perfil">' + USER + '</a>' +
        '</div>' +
      '</div>';
    document.body.insertBefore(bar, document.body.firstChild);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
