/* Alquimia — PWA + Notificaciones (lado del navegador)
   · Hace la web instalable (ícono en la pantalla de inicio del celular).
   · Registra el Service Worker.
   · Pide permiso y suscribe al usuario a las notificaciones push.
   Se carga en TODAS las páginas (lo llama app.js), así que inyecta por sí mismo
   las etiquetas necesarias en el <head>. */
(function () {
  "use strict";

  // Llave PÚBLICA VAPID (es pública, puede ir aquí). La privada vive SOLO en Netlify.
  var VAPID_PUBLIC = "BO3UJ1CYsZm_kMAldrmgn2Ad2NBtsy55fnktfOY_dx4tL8dBdWBObuWPAto58sg1RCW8e3FhT4P-AloADEYeoRg";

  var T = function (k) { return (window.I18N && window.I18N.t) ? window.I18N.t(k) : k; };
  var LANG = function () { return (window.I18N && window.I18N.lang) || "es"; };

  // ---- 1) etiquetas del <head> (manifest, color, íconos de iOS) ----
  function head() {
    var H = document.head;
    function add(tag, attrs) {
      var e = document.createElement(tag);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      H.appendChild(e);
    }
    if (!H.querySelector('link[rel="manifest"]')) add("link", { rel: "manifest", href: "manifest.webmanifest" });
    if (!H.querySelector('meta[name="theme-color"]')) add("meta", { name: "theme-color", content: "#2A152B" });
    if (!H.querySelector('link[rel="apple-touch-icon"]')) add("link", { rel: "apple-touch-icon", href: "icons/apple-touch-icon.png" });
    if (!H.querySelector('meta[name="apple-mobile-web-app-capable"]')) add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    if (!H.querySelector('meta[name="mobile-web-app-capable"]')) add("meta", { name: "mobile-web-app-capable", content: "yes" });
    if (!H.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) add("meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });
    if (!H.querySelector('meta[name="apple-mobile-web-app-title"]')) add("meta", { name: "apple-mobile-web-app-title", content: "Alquimia" });
  }

  // ---- 2) registrar el Service Worker ----
  var swReg = null;
  function registerSW() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.register("sw.js").then(function (reg) {
      swReg = reg;
      return reg;
    }).catch(function (e) { console.warn("SW:", e); return null; });
  }

  // ---- utilidades de entorno ----
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
           window.navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
           (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function pushSupported() {
    return ("serviceWorker" in navigator) && ("PushManager" in window) && ("Notification" in window);
  }

  // ---- 3) banner de instalación ----
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    maybeShowInstall();
  });
  window.addEventListener("appinstalled", function () {
    hideInstall();
    try { localStorage.setItem("alq_installed", "1"); } catch (e) {}
  });

  function dismissed(key) { try { return localStorage.getItem(key) === "1"; } catch (e) { return false; } }
  function setDismissed(key) { try { localStorage.setItem(key, "1"); } catch (e) {} }

  function maybeShowInstall() {
    if (isStandalone()) return;
    if (dismissed("alq_install_dismissed")) return;
    if (document.getElementById("alqInstall")) return;
    // Android/Chrome: tenemos deferredPrompt. iOS: mostramos instrucciones.
    if (!deferredPrompt && !isIOS()) return;
    var bar = document.createElement("div");
    bar.id = "alqInstall";
    bar.className = "alq-install";
    var body = isIOS()
      ? '<p>' + esc(T("pwa.install.ios")) + '</p>'
      : '<p>' + esc(T("pwa.install.text")) + '</p>';
    bar.innerHTML =
      '<span class="ai-ico" aria-hidden="true">' + sealMini() + '</span>' +
      '<div class="ai-body">' + body + '</div>' +
      '<div class="ai-actions">' +
        (isIOS() ? '' : '<button type="button" class="btn btn-gold" id="aiGo">' + esc(T("pwa.install.cta")) + '</button>') +
        '<button type="button" class="ai-close" id="aiClose" aria-label="Cerrar">✕</button>' +
      '</div>';
    document.body.appendChild(bar);
    var go = document.getElementById("aiGo");
    if (go) go.addEventListener("click", async function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (e) {}
      deferredPrompt = null;
      hideInstall();
    });
    document.getElementById("aiClose").addEventListener("click", function () {
      setDismissed("alq_install_dismissed"); hideInstall();
    });
  }
  function hideInstall() { var b = document.getElementById("alqInstall"); if (b) b.remove(); }

  function esc(s) { var d = document.createElement("div"); d.textContent = (s == null ? "" : String(s)); return d.innerHTML; }
  function sealMini() {
    return '<svg viewBox="0 0 200 200" width="30" height="30" fill="none" stroke="#C6A15B" stroke-width="7" stroke-linejoin="round">' +
      '<circle cx="100" cy="100" r="86"/><polygon points="100,32 158,150 42,150" stroke-width="6"/>' +
      '<circle cx="100" cy="103" r="30" stroke-width="6"/><circle cx="100" cy="103" r="4" fill="#C6A15B" stroke="none"/></svg>';
  }

  // ---- 4) suscripción a notificaciones ----
  function urlB64ToUint8(base64) {
    var padding = "=".repeat((4 - (base64.length % 4)) % 4);
    var b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(b64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  // Devuelve: "unsupported" | "need-install" | "denied" | "granted-error" | subscriptionJSON
  async function enablePush(opts) {
    opts = opts || {};
    if (!pushSupported()) return { status: "unsupported" };
    if (isIOS() && !isStandalone()) return { status: "need-install" };
    var reg = swReg || await registerSW();
    if (!reg) return { status: "unsupported" };
    var perm = Notification.permission;
    if (perm === "default") { try { perm = await Notification.requestPermission(); } catch (e) { perm = "denied"; } }
    if (perm !== "granted") return { status: "denied" };
    var sub;
    try {
      sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8(VAPID_PUBLIC)
        });
      }
    } catch (e) { console.warn("subscribe:", e); return { status: "granted-error" }; }
    var json = sub.toJSON();
    // Guardar en Supabase (si está disponible)
    try {
      if (window.ALQ && window.ALQ.savePushSubscription) {
        await window.ALQ.savePushSubscription(json, {
          topics: opts.topics || ["general"],
          lang: LANG(),
          sellerId: opts.sellerId || null,
          role: opts.role || null,
          retoStart: opts.retoStart || null
        });
      }
    } catch (e) { console.warn("savePush:", e); }
    try { localStorage.setItem("alq_push", "1"); } catch (e) {}
    return { status: "ok", subscription: json };
  }

  async function pushState() {
    if (!pushSupported()) return "unsupported";
    if (isIOS() && !isStandalone()) return "need-install";
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission === "granted") {
      try {
        var reg = swReg || await registerSW();
        var sub = reg && await reg.pushManager.getSubscription();
        return sub ? "on" : "granted";
      } catch (e) { return "granted"; }
    }
    return "off";
  }

  // API pública para el resto de la app (reto, ajustes, etc.)
  window.ALQPUSH = {
    enable: enablePush,
    state: pushState,
    supported: pushSupported,
    isStandalone: isStandalone,
    isIOS: isIOS,
    showInstall: maybeShowInstall
  };

  // ---- arranque ----
  function boot() {
    head();
    registerSW();
    // Muestra el banner de instalar tras un momento (no molesta al entrar).
    setTimeout(maybeShowInstall, 3500);
  }
  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
