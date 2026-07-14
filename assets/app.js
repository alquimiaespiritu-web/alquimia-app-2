/* ===== Alquimia — lógica compartida de la app ===== */
(function () {
  const A = window.ALQ;
  const T = (k, v) => (window.I18N ? window.I18N.t(k, v) : k);
  const LANG = () => (window.I18N ? window.I18N.lang : "es");

  // Llama a la función de IA de Netlify (asistente vendedora / buscador comprador)
  async function callAI(payload) {
    const res = await fetch("/.netlify/functions/ai", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    let data = {};
    try { data = await res.json(); } catch (e) { throw new Error(T("ai.err")); }
    if (!res.ok) throw new Error(data.error || T("ai.err"));
    return data;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function cap1(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function kindOptions(sel) {
    return [["Servicio", "cp.lb.kind.service"], ["Producto", "cp.lb.kind.product"], ["Experiencia", "cp.lb.kind.experience"]]
      .map(o => `<option value="${o[0]}" ${sel === o[0] ? "selected" : ""}>${T(o[1])}</option>`).join("");
  }
  function currencyOptions(sel) {
    return [["EUR", "EUR — Euro (€)"], ["COP", "COP — Peso colombiano ($)"], ["USD", "USD — Dólar ($)"], ["MXN", "MXN — Peso mexicano ($)"], ["ARS", "ARS — Peso argentino ($)"], ["CLP", "CLP — Peso chileno ($)"], ["PEN", "PEN — Sol peruano (S/)"], ["BRL", "BRL — Real brasileño (R$)"]]
      .map(o => `<option value="${o[0]}" ${sel === o[0] ? "selected" : ""}>${o[1]}</option>`).join("");
  }

  const GLYPH = `<svg class="mark" viewBox="0 0 200 200" aria-hidden="true">
    <circle class="mk-ring" cx="100" cy="100" r="86"/>
    <g id="mk-aire" class="mk-pillar"><polygon points="100,14 174.5,143 25.5,143"/><line x1="82.7" y1="44" x2="117.3" y2="44"/></g>
    <g id="mk-agua" class="mk-pillar"><polygon points="43.4,118 72.3,118 57.85,143"/></g>
    <g id="mk-tierra" class="mk-pillar"><polygon points="127.7,118 156.6,118 142.15,143"/><line x1="136.4" y1="133" x2="147.9" y2="133"/></g>
    <g id="mk-sal" class="mk-pillar"><circle cx="100" cy="100" r="33"/><line x1="67" y1="100" x2="92" y2="100"/><line x1="108" y1="100" x2="133" y2="100"/></g>
    <g id="mk-sol" class="mk-pillar"><circle cx="100" cy="100" r="8"/><circle class="dot" cx="100" cy="100" r="3"/></g></svg>`;

  const PILLARS = {
    Cuerpo:    { mark: "sal",    color: "#E0876B", sym: "🜔" },
    Mente:     { mark: "aire",   color: "#A57BC9", sym: "🜁" },
    Alma:      { mark: "sol",    color: "#D8B86A", sym: "☉" },
    Planeta:   { mark: "tierra", color: "#3FBF7A", sym: "🜃" },
    Comunidad: { mark: "agua",   color: "#5BBFD6", sym: "🜄" }
  };
  // Chip de pilar (símbolo alquímico + nombre, en el color del pilar) para resaltar la categoría
  function pillarChip(c) {
    const p = PILLARS[c]; if (!p) return "";
    return `<span class="pf-pillar" style="--pc:${p.color}"><span class="pf-pillar-sym">${p.sym}</span>${A.catLabel(c)}</span>`;
  }
  // Símbolos alquímicos del/los pilar(es) de una publicación (para la imagen del marketplace)
  function pillarMarks(cat) {
    const a = A.catList(cat).map(c => PILLARS[c] && PILLARS[c].sym).filter(Boolean);
    return a.length ? `<span class="pf-pmark">${a.join(" ")}</span>` : "";
  }
  // Embellece la descripción del producto: "Etiqueta: valor" → fila con título;
  // respeta viñetas (-, •, *) y saltos de línea. Sin campos nuevos ni base de datos.
  function renderDesc(raw) {
    const text = String(raw == null ? "" : raw).replace(/\r\n?/g, "\n").trim();
    if (!text) return "";
    const lines = text.split("\n");
    let html = "", bullets = [];
    const flush = () => { if (bullets.length) { html += `<ul class="ds-list">${bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul>`; bullets = []; } };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) { flush(); continue; }
      const b = line.match(/^[-•*–]\s+(.*)$/);
      if (b) { bullets.push(b[1]); continue; }
      flush();
      const hd = line.match(/^([A-Za-zÁÉÍÓÚÑÜáéíóúñü][^:\n]{1,38}):$/);
      if (hd) { html += `<div class="ds-h">${esc(hd[1].trim())}</div>`; continue; }
      const kv = line.match(/^([A-Za-zÁÉÍÓÚÑÜáéíóúñü][^:\n]{1,38}):\s+(\S.*)$/);
      if (kv) { html += `<div class="ds-row"><span class="ds-k">${esc(kv[1].trim())}</span><span class="ds-v">${esc(kv[2].trim())}</span></div>`; }
      else { html += `<p>${esc(line)}</p>`; }
    }
    flush();
    return html;
  }
  // Combina los campos guiados (Objetivo, Duración, Para quién, Qué incluye) + la
  // descripción libre en un texto "Etiqueta: valor" que renderDesc pinta como secciones.
  function composeListingDesc(o) {
    const rows = [];
    const add = (labelKey, val, allowBlock) => {
      val = String(val == null ? "" : val).trim();
      if (!val) return;
      const label = T(labelKey);
      if (allowBlock && /\n/.test(val)) rows.push(label + ":\n" + val);
      else rows.push(label + ": " + val.replace(/\s*\n\s*/g, " "));
    };
    add("cp.lb.objetivo", o.objetivo);
    add("cp.lb.duracion", o.duracion);
    add("cp.lb.paraquien", o.paraquien);
    add("cp.lb.incluye", o.incluye, true);
    let out = rows.join("\n");
    const free = String(o.desc == null ? "" : o.desc).trim();
    if (free) out += (out ? "\n\n" : "") + free;
    return out.trim();
  }
  // Sello completo de Alquimia (como la home). La animación (qué pilar palpita) la
  // controla initSeal() ciclando solo los pilares de este perfil.
  function sealSVG() {
    const cl = () => "pillar";
    return `<svg class="seal-full" viewBox="130 30 420 320" aria-label="Sello de Alquimia">
      <defs><path id="ladoIzqP" d="M 217.0 249 L 329.6 54"/><path id="ladoDerP" d="M 350.4 54 L 463.0 249"/></defs>
      <g class="lf-logo">
        <g><circle cx="340" cy="190" r="130" fill="none" stroke="#C6A15B" stroke-width="3.5"/></g>
        <g id="ps-aire" class="${cl('aire')}"><polygon points="340,60 452.6,255 227.4,255" fill="#8E5BB0" fill-opacity=".2" stroke="#C6A15B" stroke-width="3"/><line x1="310.6" y1="110" x2="369.4" y2="110" stroke="#C6A15B" stroke-width="3"/></g>
        <g id="ps-agua" class="${cl('agua')}"><polygon points="255.9,218 298.6,218 277.25,255" fill="none" stroke="#C6A15B" stroke-width="3"/></g>
        <g id="ps-tierra" class="${cl('tierra')}"><polygon points="381.4,218 424.1,218 402.75,255" fill="none" stroke="#C6A15B" stroke-width="3"/><line x1="395.9" y1="243" x2="409.6" y2="243" stroke="#C6A15B" stroke-width="3"/></g>
        <g id="ps-sal" class="${cl('sal')}"><circle cx="340" cy="190" r="50" fill="none" stroke="#C6A15B" stroke-width="3"/><line x1="290" y1="190" x2="330" y2="190" stroke="#C6A15B" stroke-width="3"/><line x1="350" y1="190" x2="390" y2="190" stroke="#C6A15B" stroke-width="3"/></g>
        <g id="ps-sol" class="${cl('sol')}"><circle cx="340" cy="190" r="10" fill="none" stroke="#C6A15B" stroke-width="3"/><circle class="dot" cx="340" cy="190" r="3.8" fill="#C6A15B"/></g>
        <text class="lf-word" font-family="Georgia,'Times New Roman',serif" font-size="17" letter-spacing="5" fill="#C6A15B"><textPath href="#ladoIzqP" startOffset="50%" text-anchor="middle">ALQUIMIA</textPath></text>
        <text class="lf-word" font-family="Georgia,'Times New Roman',serif" font-size="16" letter-spacing="1.5" fill="#C6A15B"><textPath href="#ladoDerP" startOffset="50%" text-anchor="middle">TRANSMUTACIÓN</textPath></text>
      </g></svg>`;
  }
  // Anima el sello del perfil como en la home: palpita un pilar a la vez (solo los del perfil)
  // y va mostrando su nombre + "cuidado de…" en la leyenda, rotando.
  function initSeal(cats) {
    const svg = document.querySelector(".seal-full");
    const cap = document.querySelector(".pf-seal-cap");
    if (!svg) return;
    const list = (cats || []).map(c => PILLARS[c] ? { id: "ps-" + PILLARS[c].mark, cat: c } : null).filter(Boolean);
    if (!list.length) return;
    let i = 0;
    function show(k) {
      svg.querySelectorAll(".pillar").forEach(p => p.classList.remove("active"));
      const el = svg.querySelector("#" + list[k].id); if (el) el.classList.add("active");
      if (cap) {
        cap.innerHTML = `<span class="ps-item"><span class="ps-name">${A.catLabel(list[k].cat)}</span><span class="ps-sub">${cap1(T("pil.sub." + list[k].cat))}</span></span>`;
        cap.classList.remove("show"); void cap.offsetWidth; cap.classList.add("show");
      }
    }
    show(0);
    if (list.length > 1) setInterval(() => { i = (i + 1) % list.length; show(i); }, 2200);
  }

  function setMarkPulse(cats) {
    const mark = document.querySelector(".brand .mark");
    if (!mark) return;
    mark.querySelectorAll(".mk-pillar").forEach(g => { g.classList.remove("pulse"); g.style.removeProperty("--pc"); });
    const list = (cats || []).filter(c => PILLARS[c]);
    if (!list.length) { mark.classList.remove("mk-sel"); return; }
    mark.classList.add("mk-sel");
    list.forEach(c => {
      const g = mark.querySelector("#mk-" + PILLARS[c].mark);
      if (g) { g.classList.add("pulse"); g.style.setProperty("--pc", PILLARS[c].color); }
    });
  }

  function chrome(active) {
    const h = document.getElementById("site-header");
    if (h) h.outerHTML = `<header class="site"><nav>
        <div class="brand"><a class="brand-logo" id="brandLogo" href="index.html" aria-label="Alquimia">${GLYPH}</a><a class="brand-name" href="index.html"><span class="name">Alquimia</span></a></div>
        <div class="nav-right">
          <div class="nav-links" id="navLinks">
            <a href="marketplace.html" class="${active==='marketplace'?'active':''}">${T("nav.marketplace")}</a>
            <a href="reto.html" class="${active==='reto'?'active':''}">${T("nav.reto")}</a>
            <a href="como-funciona.html" class="${active==='como'?'active':''}">${T("nav.how")}</a>
            <a href="noticias.html" class="${active==='noticias'?'active':''}">${T("nav.news")}</a>
            <a href="sobre.html" class="${active==='sobre'?'active':''}">${T("nav.about")}</a>
            <a href="contacto.html" class="${active==='contacto'?'active':''}">${T("nav.contact")}</a>
            <span id="nav-account" class="nav-account" style="display:contents"><a href="create-profile.html?login=1" class="cta">${T("nav.login")}</a></span>
          </div>
          <select id="langSelect" class="cur-toggle" title="${T("nav.langTitle")}" aria-label="${T("nav.langTitle")}"><option value="es" ${LANG()==="es"?"selected":""}>ES</option><option value="en" ${LANG()==="en"?"selected":""}>EN</option><option value="nl" ${LANG()==="nl"?"selected":""}>NL</option></select>
          <select id="curToggle" class="cur-toggle" title="${T("nav.curTitle")}" aria-label="${T("nav.curTitle")}">${A.currencyList().map(c => `<option value="${c}" ${A.displayCurrency()===c?"selected":""}>${c}</option>`).join("")}</select>
          <a href="cart.html" class="cart-link ${active==='cart'?'active':''}" title="Carrito" aria-label="Carrito" style="position:relative;display:inline-flex;align-items:center;color:var(--parchment-dim);padding:2px">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <span id="cartCount" class="badge" style="position:absolute;top:-6px;right:-8px;background:var(--gold);color:var(--ink);font-size:10px;font-weight:700;min-width:16px;height:16px;border-radius:9px;display:grid;place-items:center;padding:0 4px">0</span>
          </a>
          <span id="nav-logout-slot" class="nav-logout-slot"></span>
          <button type="button" id="navToggle" class="nav-toggle" aria-label="${T("nav.menu")}" aria-expanded="false">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div></nav></header>`;
    // El logo lleva al PANEL solo cuando la cuenta de administración (Alquimia)
    // tiene la sesión activa. Para el resto, el logo va al inicio como siempre.
    (async () => {
      try {
        const u = await A.authUser();
        if (u && ADMIN_EMAILS.indexOf(String(u.email || "").toLowerCase()) >= 0) {
          const bl = document.getElementById("brandLogo");
          if (bl) { bl.setAttribute("href", "admin.html"); bl.setAttribute("title", "Panel de administración"); bl.classList.add("brand-admin"); }
        }
      } catch (e) {}
    })();
    const f = document.getElementById("site-footer");
    if (f) f.outerHTML = `<footer class="site"><div class="wrap">
        <div class="row" style="justify-content:space-between;align-items:center;gap:18px">
          <span class="slogan">${T("footer.slogan")}</span>
          <nav class="foot-links">
            <a href="sobre.html">${T("footer.about")}</a>
            <a href="noticias.html">${T("nav.news")}</a>
            <a href="marketplace.html">${T("nav.marketplace")}</a>
            <a href="reto.html">${T("nav.reto")}</a>
            <a href="como-funciona.html">${T("nav.how")}</a>
            <a href="faq.html">FAQ</a>
            <a href="registro.html">${T("nav.register")}</a>
            <a href="contacto.html">${T("nav.contact")}</a>
          </nav>
        </div>
        <div class="row" style="justify-content:space-between;align-items:center;gap:18px;margin-top:14px">
          <span class="meta">${T("footer.places")}</span>
          <span class="meta">${T("footer.copy")}</span>
        </div>
        <div class="row" style="justify-content:center;gap:18px;margin-top:10px">
          <a class="meta" href="terminos.html">${T("footer.terms")}</a>
          <a class="meta" href="privacidad.html">${T("footer.privacy")}</a>
          <a class="meta" href="privacidad.html#cookies">${T("footer.cookies")}</a>
          <a class="meta" href="contacto.html">${T("nav.contact")}</a>
        </div>
        <div class="row" style="justify-content:center;margin-top:8px">
          <span class="meta" style="opacity:.7;text-align:center">${T("footer.legal")}</span>
        </div></div></footer>`;
    // Aviso de cookies (GDPR/AVG) — visible hasta que se acepta o rechaza.
    (function () {
      let choice = null; try { choice = localStorage.getItem("alq_cookie_consent"); } catch (e) {}
      if (choice) return;
      if (document.getElementById("cookieBanner")) return;
      const bar = document.createElement("div");
      bar.id = "cookieBanner";
      bar.setAttribute("role", "dialog");
      bar.setAttribute("aria-live", "polite");
      bar.setAttribute("aria-label", T("cookie.aria"));
      bar.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:9999;max-width:680px;width:calc(100% - 32px);background:var(--ink,#2A152B);color:var(--parchment,#EFE7DA);border:1px solid var(--gold,#C6A15B);border-radius:14px;padding:16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.45);font-size:14px;line-height:1.55";
      bar.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">
          <p style="margin:0">${T("cookie.text")} <a href="privacidad.html#cookies" style="color:var(--gold,#C6A15B);text-decoration:underline">${T("cookie.more")}</a></p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
            <button type="button" id="ckReject" class="btn btn-ghost" style="padding:8px 16px">${T("cookie.reject")}</button>
            <button type="button" id="ckAccept" class="btn btn-gold" style="padding:8px 16px">${T("cookie.accept")}</button>
          </div></div>`;
      document.body.appendChild(bar);
      const done = v => { try { localStorage.setItem("alq_cookie_consent", v); } catch (e) {} bar.remove(); };
      bar.querySelector("#ckAccept").addEventListener("click", () => done("accepted"));
      bar.querySelector("#ckReject").addEventListener("click", () => done("rejected"));
    })();
    const lt = document.getElementById("langSelect");
    if (lt && window.I18N) lt.addEventListener("change", () => window.I18N.set(lt.value));
    const ct = document.getElementById("curToggle");
    if (ct) ct.addEventListener("change", () => { A.setDisplayCurrency(ct.value); location.reload(); });
    const nt = document.getElementById("navToggle"), nl = document.getElementById("navLinks");
    if (nt && nl) nt.addEventListener("click", () => { const o = nl.classList.toggle("open"); nt.setAttribute("aria-expanded", o ? "true" : "false"); });
    updateCartCount();
    updateNavAuth(active);
  }

  // Ajusta la navegación según la sesión:
  // · Sin sesión  -> "Regístrate" (y "Mi perfil" de comprador si ya hay uno en este navegador).
  // · Con sesión de vendedora -> "Mi panel", "Mi perfil" (público) y "Salir".
  async function updateNavAuth(active) {
    const slot = document.getElementById("nav-account");
    const logoutSlot = document.getElementById("nav-logout-slot");
    if (!slot) return;
    let user = null;
    try { user = A.authUser ? await A.authUser() : null; } catch (e) {}
    if (user) {
      let pid = (A.lastProfileId && A.lastProfileId()) || null;
      if (!pid && A.myProfile) {
        try { const mp = await A.myProfile(); if (mp && mp.id) { pid = mp.id; try { localStorage.setItem("alq_last_profile", pid); } catch (e) {} } } catch (e) {}
      }
      const profHref = pid ? ("profile.html?id=" + pid) : "create-profile.html";
      // Panel = icono de casa, Perfil = icono de persona
      slot.innerHTML =
        `<a href="dashboard.html" class="nav-ico ${active==='dashboard'?'active':''}" title="${T("nav.dashboard")}" aria-label="${T("nav.dashboard")}">${HOME_ICON}</a>` +
        `<a href="${profHref}" class="nav-ico ${active==='profile'?'active':''}" title="${T("nav.profile")}" aria-label="${T("nav.profile")}">${USER_ICON}</a>`;
      // Salir va en su propio espacio (donde estaba el carrito)
      if (logoutSlot) {
        logoutSlot.innerHTML = `<a href="#" id="navLogout" class="nav-ico nav-logout" title="${T("nav.logout")}" aria-label="${T("nav.logout")}">${LOGOUT_ICON}</a>`;
        const lo = document.getElementById("navLogout");
        if (lo) lo.addEventListener("click", async (e) => {
          e.preventDefault();
          if (A.signOut) { try { await A.signOut(); } catch (err) {} }
          try { localStorage.removeItem("alq_last_profile"); } catch (err) {}
          location.href = "index.html";
        });
      }
    } else {
      if (logoutSlot) logoutSlot.innerHTML = "";
      let buyer = null;
      try { buyer = (A.getBuyer && A.getBuyer()) || null; } catch (e) {}
      const acctHref = buyer ? "comprador.html" : "create-profile.html?login=1";
      slot.innerHTML = `<a href="${acctHref}" class="nav-ico ${active==='comprador'?'active':''}" title="${T("nav.profile")}" aria-label="${T("nav.profile")}">${USER_ICON}</a>`;
    }
  }

  function updateCartCount(){ const el = document.getElementById("cartCount"); if (el) el.textContent = A.cartCount(); }

  const gc = g => (typeof g === "string" && g.indexOf("grad") === 0) ? g : "grad-" + g;
  const igUrl = v => { v = (v || "").trim(); if (!v) return "#"; if (v.indexOf("http") === 0) return v; return "https://instagram.com/" + v.replace(/^@/, ""); };
  const extUrl = v => { v = (v || "").trim(); if (!v) return ""; return v.indexOf("http") === 0 ? v : "https://" + v; };
  const onlyDigits = v => String(v || "").replace(/[^0-9]/g, "");

  // Ojo para ver/ocultar contraseña en TODOS los campos de tipo password del sitio.
  const EYE_SHOW = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_HIDE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const USER_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const HOME_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
  const LOGOUT_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
  function enhancePasswordFields(scope) {
    (scope || document).querySelectorAll('input[type="password"]').forEach(inp => {
      if (inp.dataset.eye) return; inp.dataset.eye = "1";
      const wrap = document.createElement("div"); wrap.className = "pw-wrap";
      inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "pw-eye"; btn.setAttribute("aria-label", "Ver u ocultar contraseña");
      btn.innerHTML = EYE_SHOW; wrap.appendChild(btn);
      btn.addEventListener("click", () => {
        if (inp.type === "password") { inp.type = "text"; btn.innerHTML = EYE_HIDE; }
        else { inp.type = "password"; btn.innerHTML = EYE_SHOW; }
      });
    });
  }

  // Editor de perfil EN EL PERFIL (modal), visible solo para la dueña.
  function openProfileEditor(s) {
    const old = document.getElementById("pfEditOverlay"); if (old) old.remove();
    let newPhoto = null;
    const cats = A.categories || [];
    const catBoxes = cats.map(c => `<label class="check"><input type="checkbox" class="pe2-cat" value="${esc(c)}"${(s.cat || "").split(",").map(x => x.trim()).indexOf(c) >= 0 ? " checked" : ""}><span>${A.catLabel ? A.catLabel(c) : esc(c)}</span></label>`).join("");
    const curOpts = (A.currencyList ? A.currencyList() : ["EUR"]).map(c => `<option value="${c}"${(s.currency || "EUR") === c ? " selected" : ""}>${c}</option>`).join("");
    const ch = s.notifyChannel || "email";
    const ov = document.createElement("div"); ov.id = "pfEditOverlay"; ov.className = "lead-overlay";
    ov.innerHTML = `<div class="lead-modal">
      <button class="lead-close" id="pfEdClose" aria-label="cerrar">✕</button>
      <h3 style="font-size:20px;margin-bottom:14px">${T("pf.ed.h")}</h3>
      <div class="field"><label>${T("pf.ed.name")}</label><input id="pe2-name" value="${esc(s.name || "")}"></div>
      <div class="field"><label>${T("pf.ed.role")}</label><input id="pe2-role" value="${esc(s.role || "")}"></div>
      <div class="field"><label>${T("pf.ed.cats")}</label><div class="checks">${catBoxes}</div></div>
      <div class="grid-2">
        <div class="field"><label>${T("pf.ed.loc")}</label><input id="pe2-loc" value="${esc(s.loc || "")}"></div>
        <div class="field"><label>${T("pf.ed.currency")}</label><select id="pe2-currency">${curOpts}</select></div>
      </div>
      <div class="field"><label>${T("cp.f.instagram")}</label><input id="pe2-ig" value="${esc(s.instagram || "")}"></div>
      <div class="field"><label>${T("cp.f.whatsapp")}</label><input id="pe2-wa" value="${esc(s.whatsapp || "")}" placeholder="+57 300 000 0000"></div>
      <div class="field"><label>${T("cp.f.notify")}</label><select id="pe2-notify">
        <option value="email"${ch === "email" ? " selected" : ""}>${T("cp.notify.email")}</option>
        <option value="whatsapp"${ch === "whatsapp" ? " selected" : ""}>${T("cp.notify.whatsapp")}</option>
        <option value="instagram"${ch === "instagram" ? " selected" : ""}>${T("cp.notify.instagram")}</option>
      </select></div>
      <div class="field"><label>${T("cp.f.pay")}</label><input id="pe2-pay" value="${esc(s.payUrl || "")}"></div>
      <div class="field"><label>${T("cp.f.story")}</label><textarea id="pe2-bio">${esc(s.bio || "")}</textarea></div>
      <div class="field"><label class="upload"><span id="pe2-photo-lbl">${T("pf.ed.photo")}</span><input type="file" id="pe2-photo" accept="image/*"></label></div>
      <button class="btn btn-gold btn-lg btn-block" id="pe2-save">${T("pf.ed.save")}</button>
      <p id="pe2-msg" class="note center mt8"></p>
    </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    document.getElementById("pfEdClose").addEventListener("click", close);
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    const ph = document.getElementById("pe2-photo");
    ph.addEventListener("change", () => { const f = ph.files[0]; if (!f) return; downscale(f, 256, d => { newPhoto = d; document.getElementById("pe2-photo-lbl").textContent = "✓ " + (f.name || "foto"); }); ph.value = ""; });
    document.getElementById("pe2-save").addEventListener("click", async function () {
      const name = val("pe2-name"), role = val("pe2-role");
      const out = document.getElementById("pe2-msg");
      if (!name || !role) { out.style.color = "var(--gold-2)"; out.textContent = T("cp.err.required"); return; }
      const cat = [...ov.querySelectorAll(".pe2-cat:checked")].map(x => x.value).join(",");
      const ini = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
      this.disabled = true; out.style.color = "var(--parchment-dim)"; out.textContent = T("cp.saving");
      try {
        await A.updateProfile(s.id, { name: name, role: role, cat: cat, ini: ini, loc: val("pe2-loc") || "—",
          currency: document.getElementById("pe2-currency").value, instagram: val("pe2-ig"), whatsapp: val("pe2-wa"),
          notifyChannel: document.getElementById("pe2-notify").value, payUrl: val("pe2-pay"), bio: val("pe2-bio"),
          avatarImg: newPhoto || undefined });
        out.style.color = "var(--emerald)"; out.textContent = T("pf.ed.saved");
        setTimeout(() => location.reload(), 1100);
      } catch (e) { this.disabled = false; out.style.color = "var(--gold-2)"; out.textContent = (e && e.message) || T("ai.err"); }
    });
  }

  // Botón "Me interesa": enruta según el canal de avisos elegido por la vendedora.
  // whatsapp -> wa.me ; instagram -> su Instagram ; email (o por defecto) -> formulario que le envía un correo.
  function interestBtn(s, cls, listingTitle) {
    const label = T("ls.interest");
    const ch = s.notifyChannel || "email";
    if (ch === "whatsapp" && s.whatsapp) {
      const txt = encodeURIComponent(T("ls.interest.wa").replace("{name}", s.name || ""));
      return `<a class="${cls}" href="https://wa.me/${onlyDigits(s.whatsapp)}?text=${txt}" target="_blank" rel="noopener">${label}</a>`;
    }
    if (ch === "instagram" && s.instagram) {
      return `<a class="${cls}" href="${igUrl(s.instagram)}" target="_blank" rel="noopener">${label}</a>`;
    }
    if (s.email) {
      return `<button type="button" class="${cls} js-interest" data-sid="${esc(s.id)}" data-sname="${esc(s.name || "")}" data-ltitle="${esc(listingTitle || "")}">${label}</button>`;
    }
    if (s.instagram) return `<a class="${cls}" href="${igUrl(s.instagram)}" target="_blank" rel="noopener">${label}</a>`;
    return "";
  }

  // Modal de "Me interesa" para el canal por correo: el comprador deja su contacto y se le envía un email a la vendedora.
  let leadWired = false;
  function wireInterest() {
    if (leadWired) return; leadWired = true;
    document.addEventListener("click", function (e) {
      const b = e.target.closest && e.target.closest(".js-interest");
      if (!b) return;
      e.preventDefault();
      openLeadModal(b.getAttribute("data-sid"), b.getAttribute("data-sname"), b.getAttribute("data-ltitle"));
    });
  }
  function openLeadModal(sid, sname, ltitle) {
    const old = document.getElementById("leadOverlay"); if (old) old.remove();
    const ov = document.createElement("div"); ov.id = "leadOverlay"; ov.className = "lead-overlay";
    ov.innerHTML = `<div class="lead-modal">
      <button class="lead-close" id="leadClose" aria-label="cerrar">✕</button>
      <h3 style="font-size:20px;margin-bottom:4px">${T("lead.h").replace("{name}", esc(sname || ""))}</h3>
      <p class="muted" style="margin-bottom:14px">${T("lead.p")}</p>
      <div class="field"><label>${T("lead.name")}</label><input id="lead-name"></div>
      <div class="field"><label>${T("lead.contact")}</label><input id="lead-contact" placeholder="${T("lead.contact.ph")}"></div>
      <div class="field"><label>${T("lead.msg")}</label><textarea id="lead-msg" placeholder="${T("lead.msg.ph")}"></textarea></div>
      <button class="btn btn-gold btn-lg btn-block" id="lead-send">${T("lead.send")}</button>
      <p id="lead-msgout" class="note center mt8"></p>
    </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    document.getElementById("leadClose").addEventListener("click", close);
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    document.getElementById("lead-send").addEventListener("click", async function () {
      const nm = val("lead-name"), ct = val("lead-contact"), ms = val("lead-msg");
      const out = document.getElementById("lead-msgout");
      if (!nm || !ct) { out.style.color = "var(--gold-2)"; out.textContent = T("lead.err.req"); return; }
      this.disabled = true; out.style.color = "var(--parchment-dim)"; out.textContent = T("au.loading");
      try {
        const r = await fetch("/.netlify/functions/lead-email", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerId: sid, buyerName: nm, buyerContact: ct, message: ms, listingTitle: ltitle, lang: (window.I18N && window.I18N.lang) || "es" }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || T("ai.err"));
        out.style.color = "var(--emerald)"; out.textContent = T("lead.ok");
        setTimeout(close, 1900);
      } catch (e) { this.disabled = false; out.style.color = "var(--gold-2)"; out.textContent = (e && e.message) || T("ai.err"); }
    });
  }

  function thumb(grad, kind) {
    return `<div class="thumb ${gc(grad)}">${kind?`<span class="kind">${kind}</span>`:''}<span></span>
      <div class="glyphmark">${GLYPH}</div></div>`;
  }

  // ---------- INDEX (logo animado) ----------
  function initFlower() {
    const flower = document.querySelector(".flower-grid");
    if (!flower) return;
    const cap = document.getElementById("flowerCap");
    const petals = [].slice.call(flower.querySelectorAll(".petal-card"));
    if (!petals.length) return;
    const colors = { body: "#E0876B", mind: "#A57BC9", soul: "#D8B86A", planet: "#3FBF7A", community: "#5BBFD6" };
    const order = ["community", "body", "mind", "soul", "planet"];
    let i = 0, hovering = false;
    function show(key) {
      petals.forEach(p => p.classList.toggle("active", p.dataset.key === key));
      if (cap) {
        const nm = cap.querySelector(".fc-name"), ds = cap.querySelector(".fc-desc");
        if (nm) nm.textContent = T("ab.dim." + key + ".t");
        if (ds) ds.textContent = T("ab.dim." + key + ".d");
        cap.style.setProperty("--c", colors[key] || "#C6A15B");
        cap.classList.remove("show"); void cap.offsetWidth; cap.classList.add("show");
      }
    }
    function step() { if (hovering) return; show(order[i % order.length]); i++; }
    petals.forEach(p => {
      p.addEventListener("mouseenter", () => { hovering = true; show(p.dataset.key); });
      p.addEventListener("mouseleave", () => { hovering = false; });
      p.addEventListener("focus", () => { show(p.dataset.key); });
    });
    show(order[0]); i = 1; setInterval(step, 2600);
  }

  // ---------- partículas de oro flotando ----------
  function initGoldParticles() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    [].slice.call(document.querySelectorAll("canvas.gold-particles")).forEach(setupParticles);
  }
  function setupParticles(cv) {
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, parts = [], raf = null;
    function mk(fromBottom) {
      return {
        x: Math.random() * w,
        y: fromBottom ? h + Math.random() * 20 : Math.random() * h,
        r: 0.6 + Math.random() * 1.9,
        vy: -(0.08 + Math.random() * 0.28),
        vx: (Math.random() - 0.5) * 0.18,
        a: 0.25 + Math.random() * 0.5,
        tw: Math.random() * Math.PI * 2,
        tws: 0.01 + Math.random() * 0.03
      };
    }
    function build() {
      const r = cv.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(14, Math.min(70, Math.round(w * h / 11000)));
      parts = [];
      for (let k = 0; k < n; k++) parts.push(mk(false));
    }
    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (let k = 0; k < parts.length; k++) {
        const p = parts[k];
        p.y += p.vy; p.x += p.vx; p.tw += p.tws;
        if (p.y < -6) { parts[k] = mk(true); continue; }
        const alpha = p.a * (0.55 + 0.45 * Math.sin(p.tw));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(230,203,142," + alpha.toFixed(3) + ")";
        ctx.shadowColor = "rgba(230,203,142,0.6)";
        ctx.shadowBlur = p.r * 2.4;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    }
    build();
    frame();
    if (window.ResizeObserver) { try { new ResizeObserver(build).observe(cv); } catch (e) {} }
    else window.addEventListener("resize", build);
  }

  function initCarousel() {
    const root = document.getElementById("newsCarousel");
    if (!root) return;
    const stage = document.getElementById("ncStage");
    const cards = [].slice.call(root.querySelectorAll(".nc-card"));
    const dotsWrap = document.getElementById("ncDots");
    const n = cards.length;
    if (!stage || !n) return;
    let active = 0, timer = null;
    if (dotsWrap) {
      for (let k = 0; k < n; k++) {
        const b = document.createElement("button");
        b.type = "button"; b.setAttribute("aria-label", "Noticia " + (k + 1));
        b.addEventListener("click", () => { setActive(k); reset(); });
        dotsWrap.appendChild(b);
      }
    }
    const dots = dotsWrap ? [].slice.call(dotsWrap.children) : [];
    function layout() {
      cards.forEach((c, idx) => {
        let off = idx - active;
        if (off > n / 2) off -= n;
        if (off < -n / 2) off += n;
        const a = Math.abs(off);
        const rot = Math.max(-50, Math.min(50, off * -40));
        const tx = off * 60;
        const tz = -a * 150;
        const sc = Math.max(0.6, 1 - a * 0.16);
        c.style.transform = "translateX(" + tx + "%) translateZ(" + tz + "px) rotateY(" + rot + "deg) scale(" + sc + ")";
        c.style.opacity = a === 0 ? "1" : (a === 1 ? "0.92" : "0.4");
        c.style.zIndex = String(10 - a);
        c.style.pointerEvents = a > 2 ? "none" : "auto";
        c.classList.toggle("is-active", off === 0);
      });
      dots.forEach((d, k) => d.classList.toggle("on", k === active));
    }
    function setActive(k) { active = (k % n + n) % n; layout(); }
    function next() { setActive(active + 1); }
    function reset() { if (timer) clearInterval(timer); timer = setInterval(next, 4000); }
    const nx = root.querySelector(".nc-next"), pv = root.querySelector(".nc-prev");
    if (nx) nx.addEventListener("click", () => { next(); reset(); });
    if (pv) pv.addEventListener("click", () => { setActive(active - 1); reset(); });
    cards.forEach((c, idx) => {
      c.addEventListener("click", (e) => { if (idx !== active) { e.preventDefault(); setActive(idx); reset(); } });
    });
    root.addEventListener("mouseenter", () => { if (timer) clearInterval(timer); });
    root.addEventListener("mouseleave", reset);
    layout(); reset();
  }

  function initIndex() {
    initCarousel();
  }

  // ---------- PÁGINA DE CADA PILAR ----------
  function initPilar() {
    const root = document.getElementById("pilarRoot");
    if (!root) return;
    const valid = { Cuerpo: "body", Mente: "mind", Alma: "soul", Planeta: "planet", Comunidad: "community" };
    const syms = { Cuerpo: "🜔", Mente: "🜁", Alma: "☉", Planeta: "🜃", Comunidad: "🜄" };
    let name = A.param("p") || "Cuerpo";
    if (!valid[name]) name = "Cuerpo";
    const key = valid[name];
    document.body.setAttribute("data-pillar", name);
    const label = A.catLabel(name);
    document.title = label + " — Alquimia";
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute("content", T("pilpg." + key + ".why").replace(/<[^>]+>/g, ""));
    setMarkPulse([name]);
    const slug = name.toLowerCase();
    const offer = [1, 2, 3].map(n => T("pilpg." + key + ".b" + n)).filter(s => s && s.indexOf("pilpg.") !== 0);
    root.innerHTML = `
      <div class="pilar-hero">
        <span class="pilar-kicker">${T("pil.sub." + name)}</span>
        <div class="pilar-sym">${syms[name]}</div>
        <h1>${label}</h1>
        <p class="pilar-def">${T("ab.dim." + key + ".d")}</p>
        <div class="pilar-rule"></div>
      </div>
      <section class="pilar-section">
        <h2>${T("pilpg.why.h")}</h2>
        <div class="pilar-why">${T("pilpg." + key + ".why")}</div>
      </section>
      <section class="pilar-section">
        <h2>${T("pilpg.offer.h")}</h2>
        <ul class="pilar-offer">${offer.map(o => `<li>${o}</li>`).join("")}</ul>
      </section>
      <section class="pilar-section" style="text-align:center">
        <div class="pilar-cta-row">
          <a class="btn btn-gold btn-lg" href="marketplace.html?cat=${encodeURIComponent(name)}">${T("pilpg.cta.market")}</a>
          <a class="btn btn-ghost btn-lg" href="noticia-${slug}.html">${T("pilpg.cta.news")}</a>
          <a class="btn btn-ghost btn-lg" href="create-profile.html">${T("pilpg.cta.join")}</a>
        </div>
        <a class="pilar-back" href="index.html">${T("pilpg.back")}</a>
      </section>`;
  }

  function initLiveLogo() {
    const svg = document.querySelector(".logo-full");
    if (!svg) return;
    const cap = document.getElementById("logoCap");
    const capLink = document.getElementById("logoCapLink");
    const pillars = [].slice.call(svg.querySelectorAll(".pillar"));
    const info = {
      sal:    { name: "Cuerpo",    color: "#E0876B", key: "body" },
      aire:   { name: "Mente",     color: "#A57BC9", key: "mind" },
      sol:    { name: "Alma",      color: "#D8B86A", key: "soul" },
      tierra: { name: "Planeta",   color: "#3FBF7A", key: "planet" },
      agua:   { name: "Comunidad", color: "#5BBFD6", key: "community" }
    };
    const seq = ["sal", "aire", "sol", "tierra", "agua"];
    let i = 0, hovering = false;
    function setCap(id) {
      if (!cap) return;
      const d = info[id]; if (!d) return;
      const nm = cap.querySelector(".lc-name"), sb = cap.querySelector(".lc-sub"), ds = cap.querySelector(".lc-desc");
      if (nm) nm.textContent = A.catLabel(d.name);
      if (sb) sb.textContent = T("pil.sub." + d.name);
      if (ds) ds.textContent = T("ab.dim." + d.key + ".d");
      if (capLink) { capLink.textContent = T("pil.link"); capLink.href = "pilar.html?p=" + encodeURIComponent(d.name); }
      cap.classList.remove("show"); void cap.offsetWidth; cap.classList.add("show");
    }
    function activate(id) {
      pillars.forEach(p => p.classList.remove("active"));
      const el = svg.querySelector("#" + id);
      if (el) el.classList.add("active");
      setCap(id);
    }
    function step() { if (hovering) return; activate(seq[i % seq.length]); i++; }
    pillars.forEach(p => {
      p.addEventListener("pointerenter", () => { hovering = true; activate(p.id); });
      p.addEventListener("pointerleave", () => { hovering = false; });
      p.style.cursor = "pointer";
      p.addEventListener("click", () => {
        const d = info[p.id]; if (d) location.href = "pilar.html?p=" + encodeURIComponent(d.name);
      });
    });
    setTimeout(() => {
      svg.querySelectorAll(".lf-enter").forEach(el => {
        el.classList.remove("lf-enter", "lf-top", "lf-bottom", "lf-left", "lf-right", "lf-pop");
        el.style.animation = "none"; el.style.opacity = "1";
      });
      const g = svg.querySelector(".lf-logo");
      if (g) g.classList.add("lf-breathe");
      step(); setInterval(step, 1900);
    }, 2700);
  }

  // ---------- MARKETPLACE ----------
  function initMarketplace() {
    const feed = document.getElementById("feed");
    const filters = document.getElementById("filters");
    const search = document.getElementById("searchInput");
    let cat = "todos", q = "";
    const catParam = A.param("cat");
    if (catParam && A.categories.indexOf(catParam) >= 0) cat = catParam;

    function catIcon(c) {
      const s = {
        Cuerpo: '<circle cx="12" cy="12" r="8"/><line x1="4" y1="12" x2="20" y2="12"/>',
        Mente: '<polygon points="12,3 21,20 3,20"/><line x1="8.8" y1="9" x2="15.2" y2="9"/>',
        Alma: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none"/>',
        Planeta: '<polygon points="3,4 21,4 12,21"/><line x1="9.35" y1="16" x2="14.65" y2="16"/>',
        Comunidad: '<polygon points="3,5 21,5 12,21"/>'
      }[c];
      if (!s) return "";
      return `<svg class="chip-ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">${s}</svg>`;
    }

    filters.innerHTML = `<button class="chip active" data-c="todos">${T("mk.all")}</button>` +
      A.categories.map(c => `<button class="chip" data-c="${c}">${catIcon(c)}<span>${A.catLabel(c)}</span></button>`).join("");

    function render() {
      let items = A.getListings();
      if (cat !== "todos") items = items.filter(l => A.catList(l.cat).indexOf(cat) >= 0);
      if (q) items = items.filter(l => ((l.title || "") + " " + (l.titleEn || "") + " " + l.sellerName + " " + l.cat + " " + A.catsLabel(l.cat)).toLowerCase().includes(q));
      items = items.slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); // destacadas primero
      feed.innerHTML = items.length ? items.map(l => `
        <a class="pf-cell ${gc(l.g)}" href="listing.html?id=${l.id}">
          <span class="kind">${A.kindLabel(l.kind)}</span>
          ${pillarMarks(l.cat)}
          ${l.featured ? `<span class="feat">✦ ${T("badge.featured")}</span>` : ""}
          ${l.img ? `<img class="pf-img" src="${l.img}" alt="${esc(A.fld(l, "title"))}" loading="lazy" decoding="async">` : `<div class="glyphmark">${GLYPH}</div>`}
          <div class="over">
            <div class="ttl">${A.fld(l, "title")}</div>
            <div class="price">${A.price(l.price, l.currency)}</div>
            <div class="who">${l.sellerAmbassador ? `<span class="amb-star" title="${T("badge.ambassador")}">★</span> ` : ""}${l.sellerName} · ${l.loc}</div>
          </div></a>`).join("")
        : `<div class="empty" style="grid-column:1/-1">${T("mk.empty")}</div>`;
    }
    filters.addEventListener("click", e => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      filters.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active"); cat = chip.dataset.c; render();
      setMarkPulse(cat === "todos" ? [] : [cat]);
    });
    if (search) search.addEventListener("input", () => { q = search.value.trim().toLowerCase(); render(); });
    if (cat !== "todos") {
      filters.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.c === cat));
      setMarkPulse([cat]);
    }

    // Buscador con IA: el cliente describe lo que necesita y la IA recomienda
    const aiGo = document.getElementById("aiGo"), aiQ = document.getElementById("aiQuery"), aiRes = document.getElementById("aiResults");
    async function runFinder() {
      const query = (aiQ.value || "").trim();
      if (!query) { aiQ.focus(); return; }
      // Privacidad: NO enviamos el nombre real de la vendedora a la IA; usamos un código interno (V1, V2…)
      const scodes = {}; let _sc = 0;
      const items = A.getListings().map(l => {
        if (!scodes[l.sellerId]) scodes[l.sellerId] = "V" + (++_sc);
        return { id: l.id, title: A.fld(l, "title"), desc: l.desc || "", cat: A.catsLabel(l.cat), kind: A.kindLabel(l.kind), seller: scodes[l.sellerId] };
      });
      aiGo.disabled = true; aiRes.innerHTML = `<p class="ai-note">${T("ai.thinking")}</p>`;
      try {
        const out = await callAI({ action: "buyer", lang: LANG(), query: query, items: items });
        let html = out.message ? `<p class="ai-msg">${esc(out.message)}</p>` : "";
        const cards = (out.results || []).map(r => {
          const l = A.getListing(r.id); if (!l) return "";
          const img = l.img ? `<img src="${l.img}" alt="${esc(A.fld(l, "title"))}" loading="lazy" decoding="async">` : `<div class="ai-card-noimg">${GLYPH}</div>`;
          return `<a class="ai-card" href="listing.html?id=${l.id}">${img}<div class="ai-card-b"><div class="ai-card-t">${esc(A.fld(l, "title"))}</div><div class="ai-card-w">${esc(l.sellerName)} · ${esc(A.catsLabel(l.cat))}</div><div class="ai-card-r">${esc(r.reason || "")}</div></div></a>`;
        }).join("");
        html += cards ? `<div class="ai-cards">${cards}</div>` : (out.message ? "" : `<p class="ai-note">${T("ai.none")}</p>`);
        aiRes.innerHTML = html;
      } catch (e) { aiRes.innerHTML = `<p class="ai-note" style="color:var(--gold-2)">${esc((e && e.message) || T("ai.err"))}</p>`; }
      aiGo.disabled = false;
    }
    if (aiGo) aiGo.addEventListener("click", runFinder);
    if (aiQ) aiQ.addEventListener("keydown", e => { if (e.key === "Enter") runFinder(); });

    render();
  }

  // ---------- LISTING DETAIL ----------
  function initListing() {
    const l = A.getListing(A.param("id"));
    const root = document.getElementById("detailRoot");
    if (!l) { root.innerHTML = `<div class="empty">${T("ls.notFound")}</div>`; return; }
    const s = A.getSeller(l.sellerId);
    const avatar = s.avatarImg ? `<span class="avatar sm"><img src="${s.avatarImg}" alt=""></span>` : `<span class="avatar sm">${s.ini}</span>`;
    root.innerHTML = `
      <div>
        <div class="hero-img ${gc(l.g)}">${pillarMarks(l.cat)}${l.img ? `<img class="pf-img" src="${l.img}" alt="${esc(A.fld(l, "title"))}" decoding="async">` : `<div class="glyphmark">${GLYPH}</div>`}</div>
      </div>
      <div>
        <span class="kindtag">${A.kindLabel(l.kind)} · ${A.catsLabel(l.cat)}</span>
        <h1>${A.fld(l, "title")}</h1>
        <div class="price-lg">${A.price(l.price, l.currency)}</div>
        <div class="desc desc-rich">${renderDesc(A.fld(l, "desc"))}</div>
        ${s.payUrl ? `<a class="btn btn-gold btn-lg btn-block" href="${extUrl(s.payUrl)}" target="_blank" rel="noopener">${T("ls.pay")}</a>` : ""}
        ${interestBtn(s, `btn ${s.payUrl ? "btn-ghost" : "btn-gold"} btn-lg btn-block mt8`, A.fld(l, "title"))}
        <a class="seller-row" href="profile.html?id=${s.id}">
          ${avatar}
          <div class="who"><b>${s.name}${s.ambassador ? ` <span class="amb-star" title="${T("badge.ambassador")}">★</span>` : ""}</b><span>${A.fld(s, "role")} · ${s.loc}</span></div>
          <span style="margin-left:auto;color:var(--gold-2);font-size:14px">${T("ls.viewProfile")}</span>
        </a>
        <p class="note">${T("ls.protected")}</p>
      </div>`;
  }

  // ---------- PROFILE ----------
  async function initProfile() {
    const id = A.param("id") || A.lastProfileId();
    let s = A.getSeller(id);
    if (!s && A.fetchSeller) s = await A.fetchSeller(id);
    const root = document.getElementById("profileRoot");
    if (!s) { root.innerHTML = `<div class="empty">${T("pf.notFound")}</div>`; return; }
    setMarkPulse(A.catList(s.cat));
    const avatarInner = s.avatarImg ? `<img src="${s.avatarImg}" alt="">` : `${s.ini}`;
    const highlights = (s.media || []).map(m => {
      if (m.url) {
        const inner = m.t === "video"
          ? `<video src="${m.url}" muted playsinline preload="metadata"></video><span class="play">▶</span>`
          : `<div class="ph-img" style="background-image:url('${m.url}')"></div>`;
        return `<a class="pf-hl" href="${m.url}" target="_blank" rel="noopener"><div class="circle"><div class="ph">${inner}</div></div></a>`;
      }
      if (m.g) return `<div class="pf-hl"><div class="circle"><div class="ph ${'grad-'+m.g}"></div></div><span>${A.fld(m, "l")}</span></div>`;
      return "";
    }).join("");
    const cells = (s.listings || []).map(l => `
      <a class="pf-cell ${gc(l.g)}" href="listing.html?id=${l.id}">
        <span class="kind">${A.kindLabel(l.kind)}</span>
        ${pillarMarks(l.cat)}
        ${l.img ? `<img class="pf-img" src="${l.img}" alt="${esc(A.fld(l, "title"))}" loading="lazy" decoding="async">` : `<div class="glyphmark">${GLYPH}</div>`}
        <div class="over"><div class="ttl">${A.fld(l, "title")}</div><div class="price">${A.price(l.price, l.currency)}</div></div>
      </a>`).join("");
    root.innerHTML = `
      <section class="pf-head">
        <div class="pf-avatar-ring"><div class="inner">${avatarInner}</div></div>
        <div class="pf-info">
          <div class="pf-toprow">
            <span class="pf-handle">${s.name}</span>
            ${s.ambassador ? `<span class="amb-badge" title="${T("badge.ambassador")}">★ ${T("badge.ambassador")}</span>` : ""}
            ${s.commissionFree ? `<span class="founder-badge">✦ ${T("badge.founder")}</span>` : ""}
            <span class="pf-live"><span class="dot"></span>${T("pf.available")}</span>
          </div>
          <div class="pf-role">${A.fld(s, "role")}</div>
          <div class="pf-actions"><a class="btn btn-gold btn-sm" href="#pf-listings">${T("pf.viewOffer")}</a>${s.payUrl ? `<a class="btn btn-ghost btn-sm" href="${extUrl(s.payUrl)}" target="_blank" rel="noopener">${T("pf.pay")}</a>` : ""}${interestBtn(s, "btn btn-ghost btn-sm", "")}</div>
          <div class="pf-stats">
            <div class="pf-stat"><div class="n">${(s.listings||[]).length}</div><div class="l">${T("db.stat.listings")}</div></div>
            <div class="pf-stat"><div class="n">${s.loc}</div><div class="l">${T("rg.f.loc")}</div></div>
          </div>
          <div class="pf-bio">${A.fld(s, "bio")}</div>
          ${(s.languages || "").trim() ? `<div class="pf-langs">${T("pf.langs")}: ${esc((s.languages || "").split(",").map(x => x.trim()).filter(Boolean).join(" · "))}</div>` : ""}
        </div>
        ${A.catList(s.cat).length ? `<div class="pf-seal pf-seal-side">${sealSVG()}<div class="pf-seal-cap"></div></div>` : ""}
      </section>
      <div class="pf-tabbar">
        <button type="button" class="pf-tab active" data-tab="offer">${T("pf.tab.offer")}</button>
        ${highlights ? `<button type="button" class="pf-tab" data-tab="media">${T("pf.tab.media")}</button>` : ""}
      </div>
      <section class="pf-grid pf-panel" id="pf-listings" data-panel="offer">${cells || '<div class="empty">' + T("pf.noListings") + '</div>'}</section>
      ${highlights ? `<section class="pf-highlights pf-panel" data-panel="media" style="display:none">${highlights}</section>` : ""}`;
    initSeal(A.catList(s.cat));
    const tabbar = root.querySelector(".pf-tabbar");
    if (tabbar) tabbar.addEventListener("click", (e) => {
      const b = e.target.closest(".pf-tab"); if (!b) return;
      tabbar.querySelectorAll(".pf-tab").forEach(t => t.classList.toggle("active", t === b));
      root.querySelectorAll(".pf-panel").forEach(p => { p.style.display = (p.dataset.panel === b.dataset.tab) ? "" : "none"; });
    });
    // Si la dueña está viendo su propio perfil, mostramos "Editar perfil".
    try {
      const mine = (A.myProfile ? await A.myProfile() : null);
      if (mine && mine.id === s.id) {
        const actions = root.querySelector(".pf-actions");
        if (actions) {
          const eb = document.createElement("button");
          eb.type = "button"; eb.className = "btn btn-gold btn-sm"; eb.id = "pfEdit";
          eb.textContent = T("pf.edit");
          actions.insertBefore(eb, actions.firstChild);
          eb.addEventListener("click", () => openProfileEditor(s));
        }
      }
    } catch (e) {}
  }

  // ---------- CREATE PROFILE ----------
  async function initCreate() {
    const user = (A.authUser ? await A.authUser() : null);
    if (user) {
      const mine = (A.myProfile ? await A.myProfile() : null);
      if (mine && mine.id) { location.replace("profile.html?id=" + mine.id); return; }
      wireProfileForm(user); return;
    }
    // Si llega desde "Entrar", mostramos directamente el login
    if (A.param("login")) { renderAuth(document.querySelector(".form-card"), "signin"); return; }
    wireProfileForm(user);
  }

  // Coach de marca personal: chat conversacional que ayuda a crear el perfil
  function initCoach() {
    const panel = document.getElementById("coachPanel");
    if (!panel || panel.dataset.wired) return;
    panel.dataset.wired = "1";
    const body = document.getElementById("coachBody");
    const input = document.getElementById("coachInput");
    const send = document.getElementById("coachSend");
    const toggle = document.getElementById("coachToggle");
    const msgs = [{ role: "assistant", content: T("coach.greet") }];
    let pending = false;
    function render() {
      body.innerHTML = msgs.map(m => `<div class="cm ${m.role === "user" ? "cm-u" : "cm-a"}">${esc(m.content)}</div>`).join("")
        + (pending ? `<div class="cm cm-a cm-typing">${T("ai.thinking")}</div>` : "");
      body.scrollTop = body.scrollHeight;
    }
    async function sendMsg() {
      const t = (input.value || "").trim();
      if (!t || pending) return;
      msgs.push({ role: "user", content: t }); input.value = ""; pending = true; render();
      try {
        const out = await callAI({ action: "coach", lang: LANG(), messages: msgs });
        msgs.push({ role: "assistant", content: out.reply || T("ai.err") });
      } catch (e) {
        msgs.push({ role: "assistant", content: (e && e.message) || T("ai.err") });
      }
      pending = false; render();
    }
    if (send) send.addEventListener("click", sendMsg);
    if (input) input.addEventListener("keydown", e => { if (e.key === "Enter") sendMsg(); });
    if (toggle) toggle.addEventListener("click", () => panel.classList.toggle("collapsed"));
    render();
  }

  // Página reset.html: la persona llega desde el enlace del email de recuperación.
  // supabase-js procesa el token del hash y crea una sesión temporal de recuperación.
  async function initReset() {
    const root = document.getElementById("resetRoot");
    if (!root) return;
    let user = null;
    try { user = A.authUser ? await A.authUser() : null; } catch (e) {}
    if (!user) { await new Promise(r => setTimeout(r, 900)); try { user = A.authUser ? await A.authUser() : null; } catch (e) {} }
    if (!user) {
      root.innerHTML = `<div class="form-card"><h2 style="font-size:22px">${T("rp.title")}</h2><p class="muted mt8">${T("rp.nolink")}</p><div class="row mt24"><a class="btn btn-ghost" href="create-profile.html?login=1">${T("au.signin")}</a></div></div>`;
      return;
    }
    root.innerHTML = `<div class="form-card">
      <div class="page-head" style="padding-top:0"><span class="eyebrow">${T("au.eyebrow")}</span><h1 style="font-size:clamp(26px,4vw,34px);margin:8px 0 6px">${T("rp.title")}</h1><p class="sub">${T("rp.sub")}</p></div>
      <div class="field"><label>${T("rp.new")}</label><input id="rp-pass" type="password" placeholder="••••••••"></div>
      <div class="field"><label>${T("rp.new2")}</label><input id="rp-pass2" type="password" placeholder="••••••••"></div>
      <button class="btn btn-gold btn-lg btn-block" id="rp-go">${T("rp.save")}</button>
      <p id="rp-msg" class="note center mt16"></p></div>`;
    document.getElementById("rp-go").addEventListener("click", async function () {
      const p = val("rp-pass"), p2 = val("rp-pass2");
      const msg = document.getElementById("rp-msg");
      if (!p || p.length < 6) { msg.textContent = T("rp.err.short"); msg.style.color = "var(--gold-2)"; return; }
      if (p !== p2) { msg.textContent = T("rp.err.match"); msg.style.color = "var(--gold-2)"; return; }
      const btn = document.getElementById("rp-go"); btn.disabled = true; msg.style.color = "var(--parchment-dim)"; msg.textContent = T("au.loading");
      try {
        await A.changePassword(p);
        msg.style.color = "var(--parchment-dim)"; msg.textContent = T("rp.saved");
        setTimeout(() => location.href = "dashboard.html", 1500);
      } catch (e) { btn.disabled = false; msg.style.color = "var(--gold-2)"; msg.textContent = (e && e.message) ? e.message : T("au.err.generic"); }
    });
  }

  function renderAuth(card) {
    if (!card) return;
    card.innerHTML = `
      <div class="page-head" style="padding-top:0"><span class="eyebrow">${T("au.eyebrow")}</span><h1 style="font-size:clamp(26px,4vw,36px);margin:8px 0 6px">${T("au.signin")}</h1><p class="sub">${T("au.sub.signin")}</p></div>
      <div class="field"><label>${T("au.email")}</label><input id="au-email" type="email" placeholder="tucorreo@ejemplo.com"></div>
      <div class="field"><label>${T("au.password")}</label><input id="au-pass" type="password" placeholder="••••••••"></div>
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <button class="btn btn-gold btn-lg" id="au-go" style="flex:1;min-width:140px">${T("au.signin")}</button>
        <a class="btn btn-ghost btn-lg" href="registro.html" style="flex:1;min-width:140px;text-align:center">${T("au.signup")}</a>
      </div>
      <p class="note center mt8"><a href="#" id="au-forgot" style="color:var(--gold-2)">${T("au.forgot")}</a></p>
      <p class="note center" style="margin-top:4px">${T("au.firstTime")}</p>
      <p id="au-msg" class="note center mt8"></p>`;
    const forgot = document.getElementById("au-forgot");
    if (forgot) forgot.addEventListener("click", async function (e) {
      e.preventDefault();
      const msg = document.getElementById("au-msg");
      let email = val("au-email");
      if (!email) { email = (window.prompt(T("au.forgot.ask")) || "").trim(); }
      if (!email) { msg.textContent = T("au.err.empty"); msg.style.color = "var(--gold-2)"; return; }
      msg.style.color = "var(--parchment-dim)"; msg.textContent = T("au.loading");
      try {
        await A.resetPassword(email);
        msg.style.color = "var(--parchment-dim)"; msg.textContent = T("au.forgot.sent");
      } catch (err) { msg.style.color = "var(--gold-2)"; msg.textContent = (err && err.message) ? err.message : T("au.forgot.err"); }
    });
    document.getElementById("au-go").addEventListener("click", async function () {
      const email = val("au-email"), pass = val("au-pass");
      const msg = document.getElementById("au-msg");
      if (!email || !pass) { msg.textContent = T("au.err.empty"); msg.style.color = "var(--gold-2)"; return; }
      const btn = document.getElementById("au-go"); btn.disabled = true; msg.style.color = "var(--parchment-dim)"; msg.textContent = T("au.loading");
      try {
        await A.signIn(email, pass);
        const u = await A.authUser();
        if (!u) { btn.disabled = false; msg.style.color = "var(--gold-2)"; msg.textContent = T("au.confirm"); return; }
        location.reload();
      } catch (e) { btn.disabled = false; msg.style.color = "var(--gold-2)"; msg.textContent = (e && e.message) ? e.message : T("au.err.generic"); }
    });
  }

  function wireProfileForm(user) {
    // Si ya hay sesión, ocultamos los campos de email/clave (usa su cuenta)
    const acctFields = document.getElementById("acctFields");
    const loginHint = document.getElementById("loginHint");
    if (user) { if (acctFields) acctFields.style.display = "none"; if (loginHint) loginHint.style.display = "none"; }
    const goLogin = document.getElementById("goLogin");
    if (goLogin) goLogin.addEventListener("click", (e) => { e.preventDefault(); renderAuth(document.querySelector(".form-card")); });
    initCoach();

    let avatarData = null;
    const avatarInput = document.getElementById("avatarInput");
    const avatarPrev = document.getElementById("avatarPrev");
    avatarInput.addEventListener("change", () => {
      const f = avatarInput.files[0]; if (!f) return;
      downscale(f, 256, d => {
        avatarData = d;
        avatarPrev.innerHTML = `<img src="${d}" alt=""><button type="button" class="pv-del" id="avatarDel" aria-label="${T("cp.removePhoto")}">✕</button>`;
        const adel = document.getElementById("avatarDel");
        if (adel) adel.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); avatarData = null; avatarPrev.textContent = "+"; });
      });
      avatarInput.value = "";
    });

    // galería (fotos y videos)
    const gallery = document.getElementById("galleryInput");
    const galleryPrev = document.getElementById("galleryPrev");
    const galleryMsg = document.getElementById("galleryMsg");
    const galleryFiles = [];
    const MAX_VIDEO_MB = 20;
    function addPreview(f, isVideo) {
      const wrap = document.createElement("div"); wrap.className = "pv-wrap";
      const del = document.createElement("button");
      del.type = "button"; del.className = "pv-del"; del.textContent = "✕"; del.setAttribute("aria-label", T("cp.removePhoto"));
      del.addEventListener("click", () => { const idx = galleryFiles.indexOf(f); if (idx >= 0) galleryFiles.splice(idx, 1); wrap.remove(); });
      if (isVideo) {
        const v = document.createElement("video"); v.className = "pv"; v.src = URL.createObjectURL(f); v.muted = true; wrap.appendChild(v); wrap.appendChild(del); galleryPrev.appendChild(wrap);
      } else {
        downscale(f, 200, d => { const i = document.createElement("img"); i.className = "pv"; i.src = d; wrap.appendChild(i); wrap.appendChild(del); galleryPrev.appendChild(wrap); });
      }
    }
    if (gallery) gallery.addEventListener("change", () => {
      if (galleryMsg) galleryMsg.textContent = "";
      [...gallery.files].forEach(f => {
        const isVideo = f.type.indexOf("video") === 0;
        if (isVideo && f.size > MAX_VIDEO_MB * 1024 * 1024) {
          if (galleryMsg) { galleryMsg.textContent = T("cp.video.toobig"); galleryMsg.style.color = "var(--gold-2)"; }
          return;
        }
        galleryFiles.push(f);
        addPreview(f, isVideo);
      });
      gallery.value = "";
    });

    // listing builder
    const listWrap = document.getElementById("listingsWrap");
    function addListing() {
      const div = document.createElement("div");
      div.className = "listing-builder";
      div.innerHTML = `
        <div class="top"><b class="serif" style="font-size:17px">${T("cp.lb.heading")}</b><button type="button" class="rm">${T("cp.lb.remove")}</button></div>
        <div class="field"><label>${T("cp.lb.title")}</label><input class="l-title" placeholder="${T("cp.lb.title.ph")}"></div>
        <div class="grid-2">
          <div class="field"><label>${T("cp.lb.kind")}</label><select class="l-kind"><option value="Servicio">${T("cp.lb.kind.service")}</option><option value="Producto">${T("cp.lb.kind.product")}</option><option value="Experiencia">${T("cp.lb.kind.experience")}</option></select></div>
          <div class="field"><label>${T("cp.lb.price")}</label><input class="l-price" type="number" min="0" placeholder="70"></div>
        </div>
        <div class="field"><label>${T("cp.lb.cat")}</label><div class="checks">${["Cuerpo","Mente","Alma","Planeta","Comunidad"].map(cv => `<label class="check"><input type="checkbox" class="l-cat" value="${cv}"><span>${A.catLabel(cv)}</span></label>`).join("")}</div></div>
        <div class="field"><label>${T("cp.lb.desc")}</label><textarea class="l-desc" placeholder="${T("cp.lb.desc.ph")}"></textarea>
          <div class="ai-row"><button type="button" class="btn-ai l-ai">✨ <span>${T("ai.improve")}</span></button><span class="ai-note l-ai-msg" aria-live="polite"></span></div>
        </div>
        <div class="lb-details"><div class="lb-details-h">${T("cp.lb.details")}</div>
          <div class="grid-2">
            <div class="field"><label>${T("cp.lb.objetivo")}</label><input class="l-objetivo" placeholder="${T("cp.lb.objetivo.ph")}"></div>
            <div class="field"><label>${T("cp.lb.duracion")}</label><input class="l-duracion" placeholder="${T("cp.lb.duracion.ph")}"></div>
          </div>
          <div class="field"><label>${T("cp.lb.paraquien")}</label><input class="l-paraquien" placeholder="${T("cp.lb.paraquien.ph")}"></div>
          <div class="field"><label>${T("cp.lb.incluye")}</label><textarea class="l-incluye" placeholder="${T("cp.lb.incluye.ph")}"></textarea></div>
        </div>
        <div class="field"><label>${T("cp.lb.photo")}</label><label class="upload"><span class="l-img-label">${T("cp.lb.photo.add")}</span><input type="file" class="l-img" accept="image/*"></label></div>`;
      div.querySelector(".rm").addEventListener("click", () => div.remove());
      const imgIn = div.querySelector(".l-img");
      imgIn.addEventListener("change", () => {
        const f = imgIn.files[0]; if (!f) return;
        downscale(f, 800, d => { div.__img = d; div.querySelector(".l-img-label").textContent = "✓ " + (f.name || "foto"); });
        imgIn.value = "";
      });
      const aiBtn = div.querySelector(".l-ai"), aiMsg = div.querySelector(".l-ai-msg");
      aiBtn.addEventListener("click", async () => {
        const tIn = div.querySelector(".l-title"), dIn = div.querySelector(".l-desc");
        if (!tIn.value.trim() && !dIn.value.trim()) { aiMsg.style.color = "var(--gold-2)"; aiMsg.textContent = T("ai.need"); return; }
        aiBtn.disabled = true; aiMsg.style.color = "var(--parchment-dim)"; aiMsg.textContent = T("ai.thinking");
        try {
          const cats = [...document.querySelectorAll(".cp-cat:checked")].map(x => x.value).join(", ");
          const out = await callAI({ action: "seller", lang: LANG(), kind: div.querySelector(".l-kind").value, role: val("p-role"), categories: cats, title: tIn.value.trim(), desc: dIn.value.trim() });
          if (out.title) tIn.value = out.title;
          if (out.desc) dIn.value = out.desc;
          aiMsg.style.color = "var(--emerald)"; aiMsg.textContent = T("ai.done");
        } catch (e) { aiMsg.style.color = "var(--gold-2)"; aiMsg.textContent = (e && e.message) || T("ai.err"); }
        aiBtn.disabled = false;
      });
      listWrap.appendChild(div);
    }
    addListing();
    document.getElementById("addListing").addEventListener("click", addListing);

    // Paso del CÓDIGO de activación (registro en un solo flujo): aparece tras enviar el código.
    function renderCodeStep(em, pw, finishProfile) {
      const card = document.querySelector(".form-card");
      const sb = document.getElementById("saveProfile"); if (sb) sb.style.display = "none";
      const consent = card.querySelector(".consent"); if (consent) consent.style.display = "none";
      const acct = document.getElementById("acctFields"); if (acct) acct.style.display = "none";
      const panel = document.createElement("div");
      panel.className = "code-step";
      panel.innerHTML = `
        <div class="divider"></div>
        <h3 style="font-size:19px;margin-bottom:4px">${T("cp.code.h")}</h3>
        <p class="muted" style="margin-bottom:12px">${T("cp.code.p").replace("{email}", esc(em))}</p>
        <div class="field"><label>${T("cp.code.label")}</label><input id="cp-code" inputmode="numeric" autocomplete="one-time-code" placeholder="••••••" maxlength="8"></div>
        <button type="button" class="btn btn-gold btn-lg btn-block" id="cp-code-go">${T("cp.code.verify")}</button>
        <p class="note center mt8"><a href="#" id="cp-code-resend" style="color:var(--gold-2)">${T("cp.code.resend")}</a></p>
        <p id="cp-code-msg" class="note center mt8"></p>`;
      card.appendChild(panel);
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
      const cmsg = panel.querySelector("#cp-code-msg");
      async function doSend() {
        cmsg.style.color = "var(--parchment-dim)"; cmsg.textContent = T("cp.code.sending");
        try { await A.sendSignupCode(em); cmsg.style.color = "var(--emerald)"; cmsg.textContent = T("cp.code.sent").replace("{email}", esc(em)); }
        catch (err) { cmsg.style.color = "var(--gold-2)"; cmsg.textContent = T("cp.code.senderr") + " " + ((err && err.message) || ""); }
      }
      doSend(); // envía el código en cuanto aparece el paso
      panel.querySelector("#cp-code-go").addEventListener("click", async function () {
        const code = (val("cp-code") || "").trim();
        if (!code) { cmsg.style.color = "var(--gold-2)"; cmsg.textContent = T("cp.code.err.empty"); return; }
        this.disabled = true; cmsg.style.color = "var(--parchment-dim)"; cmsg.textContent = T("cp.saving");
        try {
          await A.verifyCode(em, code);
          try { await A.changePassword(pw); } catch (e) {}
          const acctUser = await A.authUser();
          if (!acctUser) throw new Error(T("au.err.generic"));
          if (A.myProfile) { try { const mine = await A.myProfile(); if (mine && mine.id) { location.replace("profile.html?id=" + mine.id); return; } } catch (e) {} }
          await finishProfile(acctUser, em);
        } catch (e) {
          this.disabled = false; cmsg.style.color = "var(--gold-2)";
          cmsg.textContent = (e && e.message) ? e.message : T("cp.code.err.bad");
        }
      });
      panel.querySelector("#cp-code-resend").addEventListener("click", async function (e) {
        e.preventDefault();
        await doSend();
      });
    }

    document.getElementById("saveProfile").addEventListener("click", async () => {
      const name = val("p-name"), role = val("p-role"), loc = val("p-loc"), bio = val("p-bio");
      const instagram = val("p-instagram"), conciencia = val("p-conciencia"), pay = val("p-pay");
      const whatsapp = val("p-whatsapp"), notifyChannel = (document.getElementById("p-notify") && document.getElementById("p-notify").value) || "email";
      const cat = [...document.querySelectorAll(".cp-cat:checked")].map(x => x.value).join(",");
      const languages = [...document.querySelectorAll(".cp-lang:checked")].map(x => x.value).join(",");
      const msg = document.getElementById("formMsg");
      const btn = document.getElementById("saveProfile");
      if (!name || !role || !cat) { msg.textContent = T("cp.err.required"); msg.style.color = "var(--gold-2)"; return; }
      const hasListing = [...listWrap.querySelectorAll(".listing-builder")].some(d => d.querySelector(".l-title").value.trim());
      if (!hasListing) { msg.textContent = T("cp.err.listing"); msg.style.color = "var(--gold-2)"; return; }
      const ck = (id) => !!(document.getElementById(id) && document.getElementById(id).checked);
      const terms = ck("p-terms"), privacy = ck("p-privacy"), ai = ck("p-ai"), age = ck("p-age");
      const news = ck("p-news");
      if (!terms || !privacy || !ai || !age) { msg.textContent = T("cp.err.terms"); msg.style.color = "var(--gold-2)"; return; }
      btn.disabled = true; msg.style.color = "var(--parchment-dim)"; msg.textContent = T("cp.saving");

      // Construye y guarda el perfil. Se ejecuta cuando la cuenta ya está activada.
      const finishProfile = async (acctUser, acctEmail) => {
      try {
        const id = "u-" + Date.now();
        const avatarUrl = avatarData ? await A.uploadPhoto(avatarData, "avatars/" + id + ".jpg") : null;
        const builders = [...listWrap.querySelectorAll(".listing-builder")];
        const listings = [];
        for (let i = 0; i < builders.length; i++) {
          const d = builders[i];
          const t = d.querySelector(".l-title").value.trim();
          if (!t) continue;
          const img = d.__img ? await A.uploadPhoto(d.__img, "listings/" + id + "-" + i + ".jpg") : null;
          listings.push({ id: id + "-" + i, title: t, kind: d.querySelector(".l-kind").value,
            price: Number(d.querySelector(".l-price").value) || 0, g: "grad-" + ((i % 6) + 1),
            cat: [...d.querySelectorAll(".l-cat:checked")].map(x => x.value).join(","),
            desc: composeListingDesc({
              desc: d.querySelector(".l-desc").value,
              objetivo: (d.querySelector(".l-objetivo") || {}).value,
              duracion: (d.querySelector(".l-duracion") || {}).value,
              paraquien: (d.querySelector(".l-paraquien") || {}).value,
              incluye: (d.querySelector(".l-incluye") || {}).value
            }) || T("cp.noDesc"), img: img });
        }
        const media = [];
        for (let i = 0; i < galleryFiles.length; i++) {
          const f = galleryFiles[i];
          const isVideo = f.type.indexOf("video") === 0;
          let url;
          if (isVideo) {
            const ext = (f.name.split(".").pop() || "mp4");
            url = await A.uploadFile(f, "media/" + id + "-" + i + "." + ext);
          } else {
            const d = await new Promise(res => downscale(f, 1000, res));
            url = await A.uploadPhoto(d, "media/" + id + "-" + i + ".jpg");
          }
          if (url) media.push({ type: isVideo ? "video" : "photo", url: url });
        }
        const ini = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
        const profile = { id, name, role, cat, languages, loc: loc || "—", ini, bio: bio || "", avatarImg: avatarUrl,
          email: acctEmail, instagram: instagram, conciencia: conciencia, payUrl: pay, whatsapp: whatsapp, notifyChannel: notifyChannel, currency: val("p-currency") || "EUR", user_id: acctUser.id, newsletter: news, terms: true, media: media, listings: listings };
        await A.saveProfile(profile);
        try { fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ "form-name": "vendedora-nueva", evento: "Perfil completo enviado", nombre: name, email: acctEmail, rol: role, categorias: cat, instagram: instagram, boletin: news ? "Sí, quiere newsletters/descuentos" : "No" }).toString() }); } catch (e) {}
        // Correo de bienvenida + "en espera de aprobación" a la vendedora (función Resend). Fire-and-forget: no bloquea el registro.
        try { fetch("/.netlify/functions/welcome-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: acctEmail, name: name, lang: (window.I18N && window.I18N.lang) || "es" }) }); } catch (e) {}
        document.querySelector(".form-card").innerHTML = `<div class="success-box">
          <div class="check">✓</div>
          <h2 style="font-size:24px">${T("cp.pending.h")}</h2>
          <p class="muted mt8">${T("cp.pending.p")}</p>
          <div class="row mt24" style="justify-content:center"><a class="btn btn-ghost" href="index.html">${T("gr.home")}</a></div>
        </div>`;
      } catch (e) {
        console.warn("saveProfile:", e);
        btn.disabled = false; msg.style.color = "var(--gold-2)";
        msg.textContent = T("cp.err.save") + " " + (e && e.message ? e.message : "");
      }
      };

      // Si ya hay sesión (vendedora logueada), guardamos directo.
      if (user) { await finishProfile(user, (user && user.email) || ""); return; }

      // Si no hay sesión: activamos la cuenta con un CÓDIGO enviado por email (todo en un flujo).
      const em = val("p-email"), pw = val("p-pass"), pw2 = val("p-pass2");
      if (!em || !pw) { btn.disabled = false; msg.style.color = "var(--gold-2)"; msg.textContent = T("cp.err.acct"); return; }
      if (pw.length < 6) { btn.disabled = false; msg.style.color = "var(--gold-2)"; msg.textContent = T("cp.err.pass"); return; }
      if (pw !== pw2) { btn.disabled = false; msg.style.color = "var(--gold-2)"; msg.textContent = T("cp.err.passmatch"); return; }
      // Aviso a Alquimia de que alguien empezó el registro (independiente del envío del código).
      try { fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ "form-name": "vendedora-nueva", evento: "Nueva cuenta de vendedora", email: em }).toString() }); } catch (e) {}
      // Notificación push a Mónica (si tiene la app instalada y avisos activos).
      if (A.pushEvent) A.pushEvent("new-seller", val("p-name") || em);
      // Muestra SIEMPRE el paso del código (él mismo envía el código y muestra su estado/errores).
      msg.textContent = "";
      renderCodeStep(em, pw, finishProfile);
    });
  }

  // ---------- CONNECT PAYOUT (Stripe Connect, modo prueba) ----------
  async function initConnect() {
    const card = document.querySelector(".form-card");
    const steps = document.querySelectorAll(".pstep");
    const done = document.getElementById("connectDone");
    const btn = document.getElementById("connectBtn");
    const msg = document.getElementById("connectMsg");

    // Necesita sesión de vendedora
    const user = (A.authUser ? await A.authUser() : null);
    if (!user) {
      if (card) card.innerHTML = `<p class="note">${T("pa.needLogin")} <a href="create-profile.html" style="color:var(--gold-2)">${T("pa.needLogin.link")}</a></p>`;
      return;
    }
    const mine = (A.myProfile ? await A.myProfile() : null);
    if (!mine || !mine.id) {
      if (card) card.innerHTML = `<p class="note">${T("pa.needProfile")} <a href="create-profile.html" style="color:var(--gold-2)">${T("pa.needProfile.link")}</a></p>`;
      return;
    }

    // ¿Vuelve de Stripe ya conectada?
    if (A.param("connected") === "1" && mine.stripeAccountId) {
      steps.forEach(s => s.classList.add("done"));
      if (done) done.style.display = "block";
      A.setPayoutConnected();
    }

    if (!btn) return;
    btn.addEventListener("click", async () => {
      const sel = card ? card.querySelector(".cn-country") : null;
      const country = sel ? sel.value : "NL";
      btn.disabled = true;
      if (msg) { msg.style.color = "var(--parchment-dim)"; msg.textContent = T("pa.connecting"); }
      try {
        const res = await fetch("/.netlify/functions/connect-stripe", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: mine.stripeAccountId || null,
            email: mine.email || user.email || "",
            country: country,
            returnUrl: location.origin + "/connect-payout.html?connected=1",
            refreshUrl: location.origin + "/connect-payout.html?refresh=1"
          })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "No se pudo conectar.");
        if (data.accountId && data.accountId !== mine.stripeAccountId) {
          try { await A.saveStripeAccount(mine.id, data.accountId); } catch (e) { console.warn("saveStripeAccount:", e); }
        }
        location.href = data.url; // onboarding de Stripe (modo prueba)
      } catch (e) {
        btn.disabled = false;
        if (msg) { msg.style.color = "var(--gold-2)"; msg.textContent = (e && e.message) ? e.message : T("au.err.generic"); }
      }
    });
  }

  // ---------- CHECKOUT ----------
  function initCheckout() {
    const items = A.cartItems();
    const root = document.getElementById("checkoutRoot");
    if (!items.length) { root.innerHTML = `<div class="empty">${T("co.empty")}</div>`; return; }
    const disp = A.displayCurrency();
    const subtotal = items.reduce((a, b) => a + A.convert(b.line, b.currency, disp), 0);
    const fee = A.commissionFor(subtotal);
    const net = Math.round((subtotal - fee) * 100) / 100;
    const pct = Math.round(A.COMMISSION * 100);
    const rows = items.map(it => `<div class="item"><div class="thumb ${gc(it.g)}"></div>
        <div style="flex:1"><div class="serif" style="font-size:16px">${A.fld(it, "title")}</div><div class="note">${A.kindLabel(it.kind)} · ${it.sellerName} · x${it.qty}</div></div>
        <div style="color:var(--gold-2)">${A.priceIn(A.convert(it.line, it.currency, disp), disp)}</div></div>`).join("");
    root.innerHTML = `
      <div>
        <h2 style="font-size:24px;margin-bottom:8px">${T("co.h")}</h2>
        <p class="muted" style="margin-bottom:18px">${T("co.p")}</p>
        <div class="field"><label>${T("co.f.email")}</label><input id="c-email" type="email" placeholder="${T("rg.f.email.ph")}"></div>
        <div class="field"><label>${T("co.f.cardName")}</label><input placeholder="${T("co.f.cardName.ph")}"></div>
        <div class="field"><label>${T("co.f.cardNum")}</label><input inputmode="numeric" placeholder="4242 4242 4242 4242"></div>
        <div class="grid-2">
          <div class="field"><label>${T("co.f.exp")}</label><input placeholder="MM / AA"></div>
          <div class="field"><label>${T("co.f.cvc")}</label><input placeholder="123"></div>
        </div>
        <button class="btn btn-gold btn-lg btn-block mt8" id="payBtn">${T("co.pay")} ${A.priceIn(subtotal, disp)}</button>
        <p class="note center mt16">${T("co.secure")}</p>
      </div>
      <div class="order">
        ${rows}
        <div class="fee-row total"><span>${T("co.total")}</span><span>${A.priceIn(subtotal, disp)}</span></div>
        <div class="divider"></div>
        <div class="note" style="margin-bottom:10px">${T("co.split")}</div>
        <div class="fee-row"><span class="muted">${T("co.fee", { pct: pct })}</span><span>${A.priceIn(fee, disp)}</span></div>
        <div class="fee-row"><span class="muted">${T("co.receive")}</span><span style="color:var(--emerald)">${A.priceIn(net, disp)}</span></div>
      </div>`;
    // Éxito simulado (respaldo cuando Wompi aún no está configurado / no es COP)
    function showSimulatedSuccess() {
      A.clearCart(); updateCartCount();
      root.innerHTML = `<div class="success-box" style="grid-column:1/-1;max-width:540px;margin:0 auto">
        <div class="check">✓</div>
        <h2 style="font-size:26px">${T("co.done.h")}</h2>
        <p class="muted mt8">${T(items.length > 1 ? "co.done.supported.many" : "co.done.supported.one", { n: items.length })}</p>
        <div class="fee-card mt24" style="text-align:left">
          <div class="fee-row total"><span>${T("co.done.total")}</span><span>${A.priceIn(subtotal, disp)}</span></div>
          <div class="fee-row"><span class="muted">${T("co.done.fee")}</span><span>${A.priceIn(fee, disp)}</span></div>
          <div class="fee-row"><span class="muted">${T("co.receive")}</span><span style="color:var(--emerald)">${A.priceIn(net, disp)}</span></div>
        </div>
        <div class="row mt24" style="justify-content:center">
          <a class="btn btn-ghost" href="marketplace.html">${T("co.keepExploring")}</a>
          <a class="btn btn-gold" href="dashboard.html">${T("co.viewDash")}</a>
        </div>
        <p class="note center mt16">${T("co.noMoney")}</p>
      </div>`;
    }

    // Envía al Checkout Web de Wompi mediante un formulario GET con la firma.
    function goToWompi(cfg, email) {
      const f = document.createElement("form");
      f.method = "GET"; f.action = cfg.checkoutUrl;
      const fields = {
        "public-key": cfg.publicKey,
        "currency": cfg.currency,
        "amount-in-cents": cfg.amountInCents,
        "reference": cfg.reference,
        "signature:integrity": cfg.signature,
        "redirect-url": location.origin + "/gracias.html"
      };
      if (cfg.expirationTime) fields["expiration-time"] = cfg.expirationTime;
      if (email) fields["customer-data:email"] = email;
      Object.keys(fields).forEach(k => {
        const i = document.createElement("input");
        i.type = "hidden"; i.name = k; i.value = fields[k];
        f.appendChild(i);
      });
      document.body.appendChild(f);
      f.submit();
    }

    const payBtn = document.getElementById("payBtn");
    payBtn.addEventListener("click", async () => {
      const email = (document.getElementById("c-email") || {}).value || "";
      // Total en COP (Wompi solo cobra en pesos colombianos)
      const copTotal = items.reduce((a, b) => a + A.convert(b.line, b.currency, "COP"), 0);
      const amountInCents = Math.round(copTotal * 100);
      payBtn.disabled = true; payBtn.textContent = T("co.processing") || "Procesando…";
      try {
        const res = await fetch("/.netlify/functions/wompi", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", amountInCents: amountInCents, customerEmail: email })
        });
        if (res.status === 503) { showSimulatedSuccess(); return; } // Wompi sin configurar todavía
        const cfg = await res.json();
        if (!res.ok || !cfg.publicKey) throw new Error(cfg.error || "Error iniciando el pago.");
        goToWompi(cfg, email); // redirige a Wompi (no vuelve aquí hasta pagar)
      } catch (e) {
        payBtn.disabled = false; payBtn.textContent = T("co.pay") + " " + A.priceIn(subtotal, disp);
        const note = document.createElement("p");
        note.className = "note center mt8"; note.style.color = "var(--gold-2)";
        note.textContent = (e && e.message) ? e.message : "Error iniciando el pago.";
        payBtn.parentNode.insertBefore(note, payBtn.nextSibling);
      }
    });
  }

  // ---------- CART ----------
  function initCart() {
    const root = document.getElementById("cartRoot");
    function render() {
      const items = A.cartItems();
      updateCartCount();
      if (!items.length) { root.innerHTML = `<div class="empty">${T("ct.empty")}</div>`; return; }
      const disp = A.displayCurrency();
      const subtotal = items.reduce((a, b) => a + A.convert(b.line, b.currency, disp), 0);
      root.innerHTML = items.map(it => `
        <div class="cart-item" data-id="${it.id}">
          <div class="thumb ${gc(it.g)}"></div>
          <div class="ci-info"><b class="serif" style="font-size:16px">${A.fld(it, "title")}</b><div class="note">${A.kindLabel(it.kind)} · ${it.sellerName}</div></div>
          <div class="qty"><button data-dec aria-label="${T("ct.less")}">−</button><span>${it.qty}</span><button data-inc aria-label="${T("ct.more")}">+</button></div>
          <div class="ci-price">${A.priceIn(A.convert(it.line, it.currency, disp), disp)}</div>
          <button class="ci-rm" data-rm>${T("ct.remove")}</button>
        </div>`).join("") + `
        <div class="cart-summary">
          <div class="fee-row total"><span>${T("ct.subtotal")}</span><span>${A.priceIn(subtotal, disp)}</span></div>
          <a class="btn btn-gold btn-lg btn-block mt16" href="checkout.html">${T("ct.toPay")}</a>
          <a class="btn btn-ghost btn-block mt8" href="marketplace.html">${T("ct.keep")}</a>
        </div>`;
      root.querySelectorAll(".cart-item").forEach(row => {
        const id = row.dataset.id;
        const cur = () => parseInt(row.querySelector(".qty span").textContent, 10);
        row.querySelector("[data-inc]").addEventListener("click", () => { A.setQty(id, cur() + 1); render(); });
        row.querySelector("[data-dec]").addEventListener("click", () => { A.setQty(id, cur() - 1); render(); });
        row.querySelector("[data-rm]").addEventListener("click", () => { A.removeFromCart(id); render(); });
      });
    }
    render();
  }

  // ---------- REGISTRO (tabs comprador/vendedor) ----------
  function initRegistro() {
    const tabs = document.querySelectorAll(".tabs button");
    const panes = document.querySelectorAll(".tabpane");
    function show(name) {
      tabs.forEach(t => t.classList.toggle("active", t.dataset.t === name));
      panes.forEach(p => p.classList.toggle("active", p.dataset.p === name));
    }
    tabs.forEach(t => t.addEventListener("click", () => show(t.dataset.t)));
    show(location.hash.replace("#", "") === "comprador" ? "comprador" : "vendedor");

    // foto de la compradora (se guarda en su cuenta, en este navegador)
    let buyerAvatar = null;
    const bAv = document.getElementById("b-avatar");
    if (bAv) {
      const prev = document.getElementById("b-avatarPrev");
      bAv.addEventListener("change", () => {
        const f = bAv.files[0]; if (!f) return;
        downscale(f, 256, d => { buyerAvatar = d; if (prev) prev.innerHTML = `<img src="${d}" alt="">`; });
      });
    }
    const bForm = document.querySelector('form[name="comprador"]');
    if (bForm) bForm.addEventListener("submit", () => {
      const el = bForm.querySelector('[name="nombre"]');
      const nm = (el ? el.value : "").trim();
      const em = ((bForm.querySelector('[name="email"]') || {}).value || "").trim();
      const intereses = [].slice.call(bForm.querySelectorAll('[name="interes[]"]:checked')).map(function (c) { return c.value; }).join(", ");
      const ini = nm.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
      A.saveBuyer({ name: nm, avatarImg: buyerAvatar, ini: ini });
      // Correo de bienvenida a la suscriptora (Resend). keepalive: sobrevive la navegación a gracias.html.
      if (em) { try { fetch("/.netlify/functions/resend-welcome", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ type: "suscriptora", email: em, name: nm, intereses: intereses }) }); } catch (e) {} }
    });
  }

  // ---------- DASHBOARD ----------
  async function initDashboard() {
    const root = document.getElementById("dashRoot");
    let pid = A.lastProfileId();
    let s = pid ? A.getSeller(pid) : null;
    if (!s && pid && A.fetchSeller) s = await A.fetchSeller(pid);
    // Respaldo: si entró con su cuenta pero este navegador no recuerda su perfil, lo buscamos por su sesión.
    if (!s && A.myProfile) {
      try { const mp = await A.myProfile(); if (mp && mp.id) { s = mp; try { localStorage.setItem("alq_last_profile", mp.id); } catch (e) {} } } catch (e) {}
    }
    if (!s) { root.innerHTML = `<div class="demo-banner"><b>${T("db.demo.b")}</b><span>${T("db.demo.text")}</span></div>`; return; }
    const isDemo = false;
    // ventas simuladas a partir de sus publicaciones
    const sales = (s.listings || []).map((l, i) => {
      const units = [3, 1, 2, 4][i % 4];
      return { title: A.fld(l, "title"), units, gross: l.price * units };
    });
    const gross = sales.reduce((a, b) => a + b.gross, 0);
    const fee = A.commissionFor(gross);
    const net = Math.round((gross - fee) * 100) / 100;
    const payout = A.payoutConnected();
    const pct = Math.round(A.COMMISSION * 100);
    const cur = s.currency || "EUR";
    root.innerHTML = `
      ${isDemo ? `<div class="demo-banner"><b>${T("db.demo.b")}</b><span>${T("db.demo.text")}</span></div>` : ""}
      <div class="profile-head" style="padding-top:10px">
        <label class="av-edit" title="${T("db.changePhotoNow")}">
          ${s.avatarImg ? `<span class="avatar lg"><img src="${s.avatarImg}"></span>` : `<span class="avatar lg">${s.ini}</span>`}
          <span class="av-cam" aria-hidden="true">+</span>
          <input type="file" id="av-quick" accept="image/*">
        </label>
        <div><b class="nm" style="font-size:28px">${s.name}</b><div class="role">${A.fld(s, "role")} · ${s.loc}</div>
          <button type="button" class="av-link" id="av-quick-lbl">${T("db.changePhotoNow")}</button>
          <span class="ai-note" id="av-quick-msg" style="display:block"></span>
        </div>
        <div style="margin-left:auto" class="row">
          <button type="button" class="btn btn-ghost set-gear-btn" id="setGear" title="${T("db.settings.h")}" aria-label="${T("db.settings.h")}">⚙</button>
        </div>
      </div>
      <div class="dash-grid">
        <div class="stat"><div class="k">${T("db.stat.listings")}</div><div class="v">${(s.listings||[]).length}</div></div>
        <div class="stat"><div class="k">${T("db.stat.sales")}</div><div class="v">${sales.reduce((a,b)=>a+b.units,0)}</div></div>
        <div class="stat"><div class="k">${T("db.stat.gross")}</div><div class="v">${A.priceIn(gross, cur)}</div></div>
        <div class="stat"><div class="k">${T("db.stat.net")}</div><div class="v green">${A.priceIn(net, cur)}</div></div>
      </div>
      <div class="section-label">${T("db.recent")}</div>
      <table class="sales"><thead><tr><th>${T("db.th.listing")}</th><th>${T("db.th.units")}</th><th>${T("db.th.gross")}</th><th>${T("db.th.fee")}</th><th>${T("db.th.net")}</th><th>${T("db.th.status")}</th></tr></thead>
        <tbody>${sales.map(r => {
          const f = A.commissionFor(r.gross); const n = Math.round((r.gross - f) * 100) / 100;
          return `<tr><td>${r.title}</td><td class="num">${r.units}</td><td class="num">${A.priceIn(r.gross, cur)}</td>
            <td class="num">${A.priceIn(f, cur)}</td><td class="num" style="color:var(--emerald)">${A.priceIn(n, cur)}</td>
            <td><span class="pill paid">${payout ? T("db.transferred") : T("db.pending")}</span></td></tr>`;
        }).join("")}</tbody></table>
      <p class="note mt16">${T(payout ? "db.note.connected" : "db.note.notConnected", { pct: pct })}</p>

      <div class="section-label">${T("db.manage")}</div>
      <div class="manage">
        <div class="mg-card" style="grid-column:1/-1">
          <div class="ml-row">
            <b class="mg-h" style="margin:0">${T("db.myListings.h")}</b>
            <div class="ml-btns"><button type="button" class="btn btn-gold btn-sm" id="al-toggle">+ ${T("db.addNew")}</button></div>
          </div>
          <div style="margin-top:14px">
          ${(s.listings || []).length ? (s.listings || []).map(l => `
            <div class="ml-item" data-id="${l.id}">
              <div class="ml-row">
                ${l.img ? `<img class="ml-thumb" src="${l.img}" alt="${esc(A.fld(l, "title"))}" loading="lazy" decoding="async">` : `<span class="ml-thumb ml-thumb-empty">${GLYPH}</span>`}
                <div class="ml-info"><b>${esc(A.fld(l, "title"))}</b><span>${A.kindLabel(l.kind)} · ${A.price(l.price, l.currency)}</span></div>
                <div class="ml-btns"><button type="button" class="btn btn-ghost btn-sm ml-edit">${T("db.edit")}</button><button type="button" class="btn btn-ghost btn-sm ml-del">${T("db.delete")}</button></div>
              </div>
              <div class="ml-edit-form" style="display:none">
                <div class="field"><label>${T("cp.lb.title")}</label><input class="me-title" value="${esc(l.title)}"></div>
                <div class="grid-2">
                  <div class="field"><label>${T("cp.lb.kind")}</label><select class="me-kind">${kindOptions(l.kind)}</select></div>
                  <div class="field"><label>${T("cp.lb.price")}</label><input class="me-price" type="number" min="0" value="${l.price}"></div>
                </div>
                <div class="field"><label>${T("cp.lb.cat")}</label><div class="checks">${["Cuerpo","Mente","Alma","Planeta","Comunidad"].map(cv => `<label class="check"><input type="checkbox" class="me-cat" value="${cv}" ${(l.cat || "").split(",").map(x => x.trim()).indexOf(cv) >= 0 ? "checked" : ""}><span>${A.catLabel(cv)}</span></label>`).join("")}</div></div>
                <div class="field"><label>${T("cp.lb.desc")}</label><textarea class="me-desc">${esc(l.desc)}</textarea></div>
                <div class="field"><label>${T("db.changePhoto")}</label><label class="upload"><span class="me-imglbl">${T("cp.lb.photo.add")}</span><input type="file" class="me-img" accept="image/*"></label></div>
                <button type="button" class="btn btn-gold btn-sm me-save">${T("db.saveChanges")}</button>
                <span class="ai-note me-msg" style="display:block;margin-top:8px"></span>
              </div>
            </div>`).join("") : `<p class="note">${T("db.noListingsYet")}</p>`}
          </div>
          <div id="al-form" style="display:none;margin-top:18px;border-top:1px solid var(--line);padding-top:18px">
            <b class="mg-h" style="font-size:16px">${T("db.addListing.h")}</b>
            <div class="field"><label>${T("cp.lb.title")}</label><input id="ml-title" placeholder="${T("cp.lb.title.ph")}"></div>
            <div class="grid-2">
              <div class="field"><label>${T("cp.lb.kind")}</label><select id="ml-kind"><option value="Servicio">${T("cp.lb.kind.service")}</option><option value="Producto">${T("cp.lb.kind.product")}</option><option value="Experiencia">${T("cp.lb.kind.experience")}</option></select></div>
              <div class="field"><label>${T("cp.lb.price")}</label><input id="ml-price" type="number" min="0" placeholder="70"></div>
            </div>
            <div class="field"><label>${T("cp.lb.cat")}</label><div class="checks">${["Cuerpo","Mente","Alma","Planeta","Comunidad"].map(cv => `<label class="check"><input type="checkbox" class="ml-cat" value="${cv}"><span>${A.catLabel(cv)}</span></label>`).join("")}</div></div>
            <div class="field"><label>${T("cp.lb.desc")}</label><textarea id="ml-desc" placeholder="${T("cp.lb.desc.ph")}"></textarea>
              <div class="ai-row"><button type="button" class="btn-ai" id="ml-ai">✨ <span>${T("ai.improve")}</span></button><span class="ai-note" id="ml-aimsg"></span></div>
            </div>
            <div class="lb-details"><div class="lb-details-h">${T("cp.lb.details")}</div>
              <div class="grid-2">
                <div class="field"><label>${T("cp.lb.objetivo")}</label><input id="ml-objetivo" placeholder="${T("cp.lb.objetivo.ph")}"></div>
                <div class="field"><label>${T("cp.lb.duracion")}</label><input id="ml-duracion" placeholder="${T("cp.lb.duracion.ph")}"></div>
              </div>
              <div class="field"><label>${T("cp.lb.paraquien")}</label><input id="ml-paraquien" placeholder="${T("cp.lb.paraquien.ph")}"></div>
              <div class="field"><label>${T("cp.lb.incluye")}</label><textarea id="ml-incluye" placeholder="${T("cp.lb.incluye.ph")}"></textarea></div>
            </div>
            <div class="field"><label>${T("cp.lb.photo")}</label><label class="upload"><span id="ml-imglbl">${T("cp.lb.photo.add")}</span><input type="file" id="ml-img" accept="image/*"></label></div>
            <button type="button" class="btn btn-gold btn-sm" id="ml-save">${T("db.addListing.btn")}</button>
            <span class="ai-note" id="ml-msg" style="display:block;margin-top:8px"></span>
          </div>
        </div>
        <div class="mg-card" style="grid-column:1/-1;display:none">
          <div id="pe-form" style="display:none;margin-top:16px">
            <div class="grid-2">
              <div class="field"><label>${T("cp.f.brand")}</label><input id="pe-name" value="${esc(s.name)}"></div>
              <div class="field"><label>${T("cp.f.role")}</label><input id="pe-role" value="${esc(A.fld(s, "role"))}"></div>
            </div>
            <div class="field"><label>${T("cp.f.cats")}</label><div class="checks">${["Cuerpo", "Mente", "Alma", "Planeta", "Comunidad"].map(cv => `<label class="check"><input type="checkbox" class="pe-cat" value="${cv}" ${A.catList(s.cat).indexOf(cv) >= 0 ? "checked" : ""}><span>${A.catLabel(cv)}</span></label>`).join("")}</div></div>
            <div class="field"><label>${T("cp.f.langs")}</label><div class="checks">${["Español", "English", "Nederlands", "Português", "Français", "Italiano", "Deutsch"].map(lv => `<label class="check"><input type="checkbox" class="pe-lang" value="${lv}" ${(s.languages || "").split(",").map(x => x.trim()).indexOf(lv) >= 0 ? "checked" : ""}><span>${lv}</span></label>`).join("")}</div></div>
            <div class="grid-2">
              <div class="field"><label>${T("cp.f.loc")}</label><input id="pe-loc" value="${esc(s.loc || "")}"></div>
              <div class="field"><label>${T("cp.f.currency")}</label><select id="pe-currency">${currencyOptions(s.currency || "EUR")}</select></div>
            </div>
            <div class="grid-2">
              <div class="field"><label>${T("cp.f.instagram")}</label><input id="pe-ig" value="${esc(s.instagram || "")}"></div>
              <div class="field"><label>${T("cp.f.pay")}</label><input id="pe-pay" value="${esc(s.payUrl || "")}"></div>
              <div class="field"><label>${T("cp.f.whatsapp")}</label><input id="pe-whatsapp" value="${esc(s.whatsapp || "")}" placeholder="+57 300 000 0000"></div>
              <div class="field"><label>${T("cp.f.notify")}</label><select id="pe-notify">
                <option value="email"${(s.notifyChannel||"email")==="email"?" selected":""}>${T("cp.notify.email")}</option>
                <option value="whatsapp"${s.notifyChannel==="whatsapp"?" selected":""}>${T("cp.notify.whatsapp")}</option>
                <option value="instagram"${s.notifyChannel==="instagram"?" selected":""}>${T("cp.notify.instagram")}</option>
              </select></div>
            </div>
            <div class="field"><label>${T("cp.f.story")}</label><textarea id="pe-bio">${esc(s.bio || "")}</textarea></div>
            <div class="field"><label>${T("db.changePhoto")}</label><label class="upload"><span id="pe-imglbl">${T("cp.photo")}</span><input type="file" id="pe-img" accept="image/*"></label></div>
            <button type="button" class="btn btn-gold btn-sm" id="pe-save">${T("db.saveChanges")}</button>
            <span class="ai-note" id="pe-msg" style="display:block;margin-top:8px"></span>
          </div>
        </div>
        <div class="mg-card" style="grid-column:1/-1">
          <b class="mg-h">${T("db.addMedia.h")}</b>
          <p class="note" style="margin-bottom:10px">${T("db.addMedia.s")}</p>
          <label class="upload"><span>${T("cp.gallery.drop")}</span><input type="file" id="mm-input" accept="image/*,video/*" multiple></label>
          <div class="previews" id="mm-prev"></div>
          <span class="ai-note" id="mm-msg" style="display:block;margin-top:8px"></span>
        </div>
        <div class="mg-card set-card set-drawer" id="setCard">
          <div class="set-drawer-head"><b class="mg-h" style="margin:0">⚙ ${T("db.settings.h")}</b><button type="button" class="set-close" id="setClose" aria-label="Cerrar">×</button></div>
          <div class="set-body">

          <label class="set-lbl">${T("db.set.pay")}</label>
          <div class="row" style="margin-bottom:18px">
            <a class="btn ${A.payoutConnected() ? "btn-ghost" : "btn-gold"} btn-sm" href="connect-payout.html">${A.payoutConnected() ? T("db.payConnected") : T("db.connectPay")}</a>
          </div>

          <label class="set-lbl">${T("db.set.notif")}</label>
          <label class="check2"><input type="checkbox" id="se-news" ${s.newsletter ? "checked" : ""}><span>${T("db.set.newsletter")}</span></label>
          <span class="ai-note" id="se-news-msg" style="display:block;margin:4px 0 16px"></span>

          <label class="set-lbl">${T("db.set.legal")}</label>
          <div class="row" style="gap:16px;flex-wrap:wrap;margin-bottom:18px">
            <a href="terminos.html" target="_blank" rel="noopener" style="color:var(--gold-2)">${T("footer.terms")}</a>
            <a href="privacidad.html" target="_blank" rel="noopener" style="color:var(--gold-2)">${T("footer.privacy")}</a>
          </div>

          <label class="set-lbl">${T("db.set.feedback")}</label>
          <div class="field"><textarea id="se-feedback" placeholder="${T("db.set.feedback.ph")}"></textarea></div>
          <button type="button" class="btn btn-ghost btn-sm" id="se-feedback-btn">${T("db.set.send")}</button>
          <span class="ai-note" id="se-feedback-msg" style="display:block;margin:4px 0 18px"></span>

          <label class="set-lbl">${T("db.set.account")}</label>
          <div class="grid-2">
            <div class="field"><label>${T("db.curPass")}</label><input id="se-curpass" type="password" placeholder="${T("cp.acct.pass.ph")}"></div>
            <div class="field"><label>${T("db.newPass")}</label><input id="se-pass" type="password" placeholder="${T("cp.acct.pass.ph")}"></div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm mt8" id="se-pass-btn">${T("db.changePass")}</button>
          <span class="ai-note" id="se-msg" style="display:block;margin:2px 0 12px"></span>
          <div class="row" style="gap:10px;flex-wrap:wrap">
            <button type="button" class="btn btn-ghost btn-sm" id="se-logout">${T("nav.logout")}</button>
            <a class="btn btn-ghost btn-sm" href="mailto:alquimiaespiritu@gmail.com?subject=${encodeURIComponent("Cerrar mi cuenta - " + s.name)}">${T("db.closeAccount")}</a>
          </div>
          </div>
        </div>
      </div>`;
    wireManage(s);
  }

  function wireManage(s) {
    // Engranaje ⚙: abre la configuración como un cajón que entra desde la derecha
    const setGear = document.getElementById("setGear");
    const setCard = document.getElementById("setCard");
    const setClose = document.getElementById("setClose");
    if (setCard) {
      let backdrop = document.getElementById("setBackdrop");
      if (!backdrop) { backdrop = document.createElement("div"); backdrop.id = "setBackdrop"; backdrop.className = "set-backdrop"; document.body.appendChild(backdrop); }
      const openSet = (o) => {
        setCard.classList.toggle("open", o);
        backdrop.classList.toggle("open", o);
        if (setGear) { setGear.classList.toggle("active", o); setGear.setAttribute("aria-expanded", o ? "true" : "false"); }
        document.body.style.overflow = o ? "hidden" : "";
      };
      if (setGear) setGear.addEventListener("click", () => openSet(!setCard.classList.contains("open")));
      if (setClose) setClose.addEventListener("click", () => openSet(false));
      backdrop.addEventListener("click", () => openSet(false));
      document.addEventListener("keydown", e => { if (e.key === "Escape") openSet(false); });
    }
    // FOTO DE PERFIL estilo Instagram: tocar el avatar (o el enlace) la cambia y guarda al instante
    const avQuick = document.getElementById("av-quick");
    const avMsg = document.getElementById("av-quick-msg");
    const avLink = document.getElementById("av-quick-lbl");
    if (avLink && avQuick) avLink.addEventListener("click", () => avQuick.click());
    if (avQuick) avQuick.addEventListener("change", () => {
      const f = avQuick.files[0]; if (!f) return;
      if (avMsg) { avMsg.style.color = "var(--parchment-dim)"; avMsg.textContent = T("cp.saving"); }
      downscale(f, 256, async d => {
        try {
          await A.updateProfile(s.id, { avatarImg: d });
          if (avMsg) { avMsg.style.color = "var(--emerald)"; avMsg.textContent = T("db.saved"); }
          setTimeout(() => location.reload(), 900);
        } catch (e) {
          if (avMsg) { avMsg.style.color = "var(--gold-2)"; avMsg.textContent = T("cp.err.save") + " " + ((e && e.message) || ""); }
        }
      });
    });
    // editar mi perfil (oculto detrás de un botón)
    const peToggle = document.getElementById("pe-toggle"), peForm = document.getElementById("pe-form");
    if (peToggle && peForm) peToggle.addEventListener("click", () => { peForm.style.display = (peForm.style.display === "none") ? "" : "none"; });
    const alToggle = document.getElementById("al-toggle"), alForm = document.getElementById("al-form");
    if (alToggle && alForm) alToggle.addEventListener("click", () => { alForm.style.display = (alForm.style.display === "none") ? "" : "none"; });
    const peImg = document.getElementById("pe-img");
    if (peImg) peImg.addEventListener("change", () => {
      const f = peImg.files[0]; if (!f) return;
      downscale(f, 256, d => { peImg.__data = d; document.getElementById("pe-imglbl").textContent = "✓ " + (f.name || "foto"); });
    });
    const peSave = document.getElementById("pe-save"), peMsg = document.getElementById("pe-msg");
    if (peSave) peSave.addEventListener("click", async () => {
      const name = val("pe-name"), role = val("pe-role");
      const cat = [...document.querySelectorAll(".pe-cat:checked")].map(x => x.value).join(",");
      const languages = [...document.querySelectorAll(".pe-lang:checked")].map(x => x.value).join(",");
      if (!name || !role || !cat) { peMsg.style.color = "var(--gold-2)"; peMsg.textContent = T("cp.err.required"); return; }
      peSave.disabled = true; peMsg.style.color = "var(--parchment-dim)"; peMsg.textContent = T("cp.saving");
      try {
        const ini = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
        await A.updateProfile(s.id, { name: name, role: role, cat: cat, languages: languages, ini: ini, loc: val("pe-loc") || "—", currency: document.getElementById("pe-currency").value, instagram: val("pe-ig"), payUrl: val("pe-pay"), whatsapp: val("pe-whatsapp"), notifyChannel: (document.getElementById("pe-notify") && document.getElementById("pe-notify").value) || "email", bio: val("pe-bio"), avatarImg: peImg ? peImg.__data : null });
        peMsg.style.color = "var(--emerald)"; peMsg.textContent = T("db.saved");
        setTimeout(() => location.reload(), 1000);
      } catch (e) { peSave.disabled = false; peMsg.style.color = "var(--gold-2)"; peMsg.textContent = T("cp.err.save") + " " + ((e && e.message) || ""); }
    });

    const imgIn = document.getElementById("ml-img");
    if (imgIn) imgIn.addEventListener("change", () => {
      const f = imgIn.files[0]; if (!f) return;
      downscale(f, 800, d => { imgIn.__data = d; document.getElementById("ml-imglbl").textContent = "✓ " + (f.name || "foto"); });
    });
    const aiBtn = document.getElementById("ml-ai"), aiMsg = document.getElementById("ml-aimsg");
    if (aiBtn) aiBtn.addEventListener("click", async () => {
      const tIn = document.getElementById("ml-title"), dIn = document.getElementById("ml-desc");
      if (!tIn.value.trim() && !dIn.value.trim()) { aiMsg.style.color = "var(--gold-2)"; aiMsg.textContent = T("ai.need"); return; }
      aiBtn.disabled = true; aiMsg.style.color = "var(--parchment-dim)"; aiMsg.textContent = T("ai.thinking");
      try {
        const out = await callAI({ action: "seller", lang: LANG(), kind: document.getElementById("ml-kind").value, role: A.fld(s, "role"), categories: s.cat, title: tIn.value.trim(), desc: dIn.value.trim() });
        if (out.title) tIn.value = out.title;
        if (out.desc) dIn.value = out.desc;
        aiMsg.style.color = "var(--emerald)"; aiMsg.textContent = T("ai.done");
      } catch (e) { aiMsg.style.color = "var(--gold-2)"; aiMsg.textContent = (e && e.message) || T("ai.err"); }
      aiBtn.disabled = false;
    });
    const saveBtn = document.getElementById("ml-save"), msg = document.getElementById("ml-msg");
    if (saveBtn) saveBtn.addEventListener("click", async () => {
      const title = document.getElementById("ml-title").value.trim();
      if (!title) { msg.style.color = "var(--gold-2)"; msg.textContent = T("cp.err.listing"); return; }
      saveBtn.disabled = true; msg.style.color = "var(--parchment-dim)"; msg.textContent = T("cp.saving");
      try {
        await A.addListing(s.id, {
          title: title, kind: document.getElementById("ml-kind").value,
          price: Number(document.getElementById("ml-price").value) || 0,
          cat: [...document.querySelectorAll(".ml-cat:checked")].map(x => x.value).join(","),
          desc: composeListingDesc({
            desc: document.getElementById("ml-desc").value,
            objetivo: (document.getElementById("ml-objetivo") || {}).value,
            duracion: (document.getElementById("ml-duracion") || {}).value,
            paraquien: (document.getElementById("ml-paraquien") || {}).value,
            incluye: (document.getElementById("ml-incluye") || {}).value
          }) || T("cp.noDesc"),
          img: imgIn ? imgIn.__data : null, g: "grad-" + (((s.listings || []).length % 6) + 1)
        });
        msg.style.color = "var(--emerald)"; msg.textContent = T("db.listingAdded");
        setTimeout(() => location.reload(), 1100);
      } catch (e) { saveBtn.disabled = false; msg.style.color = "var(--gold-2)"; msg.textContent = T("cp.err.save") + " " + ((e && e.message) || ""); }
    });
    const mm = document.getElementById("mm-input"), mmMsg = document.getElementById("mm-msg"), mmPrev = document.getElementById("mm-prev");
    if (mm) mm.addEventListener("change", async () => {
      const files = [...mm.files]; if (!files.length) return;
      mm.disabled = true; mmMsg.style.color = "var(--parchment-dim)"; mmMsg.textContent = T("cp.saving");
      let ok = 0;
      for (const f of files) {
        const isVideo = f.type.indexOf("video") === 0;
        if (isVideo && f.size > 20 * 1024 * 1024) { mmMsg.style.color = "var(--gold-2)"; mmMsg.textContent = T("cp.video.toobig"); continue; }
        try {
          if (isVideo) { await A.addMedia(s.id, f, true); }
          else { const d = await new Promise(res => downscale(f, 1000, res)); await A.addMedia(s.id, d, false); }
          ok++;
        } catch (e) { mmMsg.style.color = "var(--gold-2)"; mmMsg.textContent = (e && e.message) || T("ai.err"); }
      }
      if (ok) { mmMsg.style.color = "var(--emerald)"; mmMsg.textContent = T("db.mediaAdded"); setTimeout(() => location.reload(), 1100); }
      else mm.disabled = false;
    });

    // editar / borrar publicaciones existentes
    document.querySelectorAll(".ml-item").forEach(item => {
      const id = item.dataset.id;
      const editBtn = item.querySelector(".ml-edit"), delBtn = item.querySelector(".ml-del"), form = item.querySelector(".ml-edit-form");
      if (editBtn) editBtn.addEventListener("click", () => { form.style.display = (form.style.display === "none") ? "" : "none"; });
      const meImg = item.querySelector(".me-img");
      if (meImg) meImg.addEventListener("change", () => {
        const f = meImg.files[0]; if (!f) return;
        downscale(f, 800, d => { meImg.__data = d; item.querySelector(".me-imglbl").textContent = "✓ " + (f.name || "foto"); });
        meImg.value = "";
      });
      const saveBtn = item.querySelector(".me-save"), meMsg = item.querySelector(".me-msg");
      if (saveBtn) saveBtn.addEventListener("click", async () => {
        const title = item.querySelector(".me-title").value.trim();
        if (!title) { meMsg.style.color = "var(--gold-2)"; meMsg.textContent = T("cp.err.listing"); return; }
        saveBtn.disabled = true; meMsg.style.color = "var(--parchment-dim)"; meMsg.textContent = T("cp.saving");
        try {
          await A.updateListing(id, { title: title, kind: item.querySelector(".me-kind").value, price: Number(item.querySelector(".me-price").value) || 0, cat: [...item.querySelectorAll(".me-cat:checked")].map(x => x.value).join(","), desc: item.querySelector(".me-desc").value.trim(), img: meImg ? meImg.__data : null });
          meMsg.style.color = "var(--emerald)"; meMsg.textContent = T("db.saved");
          setTimeout(() => location.reload(), 1000);
        } catch (e) { saveBtn.disabled = false; meMsg.style.color = "var(--gold-2)"; meMsg.textContent = T("cp.err.save") + " " + ((e && e.message) || ""); }
      });
      if (delBtn) delBtn.addEventListener("click", async () => {
        if (!window.confirm(T("db.delConfirm"))) return;
        delBtn.disabled = true;
        try { await A.deleteListing(id); location.reload(); } catch (e) { delBtn.disabled = false; }
      });
    });

    // CONFIGURACIÓN
    const seNews = document.getElementById("se-news"), seNewsMsg = document.getElementById("se-news-msg");
    if (seNews) seNews.addEventListener("change", async () => {
      seNewsMsg.style.color = "var(--parchment-dim)"; seNewsMsg.textContent = T("cp.saving");
      try { await A.updateProfile(s.id, { newsletter: seNews.checked }); seNewsMsg.style.color = "var(--emerald)"; seNewsMsg.textContent = T("db.saved"); }
      catch (e) { seNewsMsg.style.color = "var(--gold-2)"; seNewsMsg.textContent = (e && e.message) || T("ai.err"); }
    });
    const sfBtn = document.getElementById("se-feedback-btn"), sfMsg = document.getElementById("se-feedback-msg");
    if (sfBtn) sfBtn.addEventListener("click", async () => {
      const txt = val("se-feedback").trim();
      if (!txt) { sfMsg.style.color = "var(--gold-2)"; sfMsg.textContent = T("db.set.feedback.ph"); return; }
      sfBtn.disabled = true; sfMsg.style.color = "var(--parchment-dim)"; sfMsg.textContent = T("cp.saving");
      try {
        await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ "form-name": "comentarios", nombre: s.name, email: s.email || "", mensaje: txt }).toString() });
        sfMsg.style.color = "var(--emerald)"; sfMsg.textContent = T("db.set.sent"); document.getElementById("se-feedback").value = "";
      } catch (e) { sfMsg.style.color = "var(--gold-2)"; sfMsg.textContent = T("ai.err"); }
      sfBtn.disabled = false;
    });
    const sePassBtn = document.getElementById("se-pass-btn"), seMsg = document.getElementById("se-msg");
    if (sePassBtn) sePassBtn.addEventListener("click", async () => {
      const cur = val("se-curpass"), pw = val("se-pass");
      if (!cur) { seMsg.style.color = "var(--gold-2)"; seMsg.textContent = T("db.err.curpass"); return; }
      if (!pw || pw.length < 6) { seMsg.style.color = "var(--gold-2)"; seMsg.textContent = T("cp.err.pass"); return; }
      sePassBtn.disabled = true; seMsg.style.color = "var(--parchment-dim)"; seMsg.textContent = T("cp.saving");
      try {
        // Verifica la contraseña ACTUAL volviendo a iniciar sesión antes de permitir el cambio.
        try { await A.signIn(s.email, cur); }
        catch (e) { seMsg.style.color = "var(--gold-2)"; seMsg.textContent = T("db.err.curwrong"); sePassBtn.disabled = false; return; }
        await A.changePassword(pw);
        seMsg.style.color = "var(--emerald)"; seMsg.textContent = T("db.passChanged");
        document.getElementById("se-pass").value = ""; document.getElementById("se-curpass").value = "";
      }
      catch (e) { seMsg.style.color = "var(--gold-2)"; seMsg.textContent = (e && e.message) || T("ai.err"); }
      sePassBtn.disabled = false;
    });
    const seLogout = document.getElementById("se-logout");
    if (seLogout) seLogout.addEventListener("click", async () => {
      if (A.signOut) { try { await A.signOut(); } catch (e) {} }
      try { localStorage.removeItem("alq_last_profile"); } catch (e) {}
      location.href = "index.html";
    });
  }

  // ---------- COMPRADOR (perfil) ----------
  function initComprador() {
    const root = document.getElementById("compradorRoot");

    function showForm(b) {
      b = b || {};
      let avatarData = b.avatarImg || null;
      root.innerHTML = `
        <div class="page-head">
          <span class="eyebrow">${T("cb.eyebrow")}</span>
          <h1>${T("cb.setup.title")}</h1>
          <p class="sub">${T("cb.setup.sub")}</p>
        </div>
        <div class="form-card">
          <div class="avatar-pick">
            <span class="avatar lg" id="cbAvatarPrev">${b.avatarImg ? `<img src="${b.avatarImg}" alt="">` : "+"}</span>
            <label class="upload" style="flex:1"><span>${T("cb.photo")}</span><input type="file" id="cbAvatarInput" accept="image/*"></label>
          </div>
          <div class="divider"></div>
          <div class="field"><label>${T("cb.f.name")}</label><input id="cb-name" placeholder="${T("cb.f.name.ph")}"></div>
          <div class="field"><label>${T("cb.f.impact")}</label><textarea id="cb-impact" placeholder="${T("cb.f.impact.ph")}"></textarea></div>
          <button class="btn btn-gold btn-lg btn-block" id="cbSave">${T("cb.save")}</button>
          <p id="cbMsg" class="note center mt16"></p>
        </div>`;
      document.getElementById("cb-name").value = b.name || "";
      document.getElementById("cb-impact").value = b.impact || "";
      const input = document.getElementById("cbAvatarInput");
      input.addEventListener("change", () => {
        const f = input.files[0]; if (!f) return;
        downscale(f, 256, d => { avatarData = d; document.getElementById("cbAvatarPrev").innerHTML = `<img src="${d}" alt="">`; });
      });
      document.getElementById("cbSave").addEventListener("click", () => {
        const name = val("cb-name"), impact = val("cb-impact");
        if (!name) { const m = document.getElementById("cbMsg"); m.textContent = T("cb.err.name"); m.style.color = "var(--gold-2)"; return; }
        const ini = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
        A.saveBuyer({ name, impact, avatarImg: avatarData, ini });
        showProfile(A.getBuyer());
      });
    }

    function showProfile(b) {
      const supported = A.getSupported();
      const cells = supported.map(l => `
        <a class="pf-cell ${gc(l.g)}" href="listing.html?id=${l.id}">
          <span class="kind">${A.kindLabel(l.kind)}</span>
          ${pillarMarks(l.cat)}
          ${l.img ? `<img class="pf-img" src="${l.img}" alt="${esc(A.fld(l, "title"))}" loading="lazy" decoding="async">` : `<div class="glyphmark">${GLYPH}</div>`}
          <div class="over"><div class="ttl">${A.fld(l, "title")}</div><div class="price">${A.price(l.price, l.currency)}</div></div>
        </a>`).join("");
      const avatarInner = b.avatarImg ? `<img src="${b.avatarImg}" alt="">` : `${b.ini || ""}`;
      root.innerHTML = `
        <section class="pf-head">
          <div class="pf-avatar-ring"><div class="inner">${avatarInner}</div></div>
          <div class="pf-info">
            <div class="pf-toprow">
              <span class="pf-handle">${b.name}</span>
              <span class="pf-live"><span class="dot"></span>${T("cb.role")}</span>
              <div class="pf-actions"><button type="button" class="btn btn-ghost btn-sm" id="cbEdit">${T("cb.edit")}</button></div>
            </div>
            ${b.impact ? `<div class="pf-bio"><b class="serif">${T("cb.impact.title")}</b><br>${b.impact}</div>` : ""}
          </div>
        </section>
        <div class="pf-tabbar"><span class="t">${T("cb.supported")}</span></div>
        <section class="pf-grid">${cells || '<div class="empty">' + T("cb.empty") + '</div>'}</section>`;
      document.getElementById("cbEdit").addEventListener("click", () => showForm(b));
    }

    const buyer = A.getBuyer();
    if (buyer) showProfile(buyer); else showForm(null);
  }

  // ---------- GRACIAS ----------
  function initGracias() {
    if (A.param("tipo") === "vendedor") {
      const h = document.querySelector('[data-i18n="gr.h"]');
      const p = document.querySelector('[data-i18n="gr.p"]');
      if (h) h.textContent = T("gr.seller.h");
      if (p) p.textContent = T("gr.seller.p");
    }
    // Vuelta de Wompi tras un pago: ?id=TRANSACTION_ID
    const txId = A.param("id");
    if (txId) {
      const h = document.querySelector('[data-i18n="gr.h"]');
      const p = document.querySelector('[data-i18n="gr.p"]');
      if (h) h.textContent = T("co.checking") || "Confirmando tu pago…";
      if (p) p.textContent = "";
      fetch("/.netlify/functions/wompi", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", transactionId: txId })
      }).then(r => r.json()).then(d => {
        if (d && d.status === "APPROVED") {
          if (A.clearCart) A.clearCart(); updateCartCount();
          if (h) h.textContent = T("co.done.h");
          if (p) p.textContent = T("co.paid.ok") || "Tu pago fue aprobado. ¡Gracias por apoyar a esta emprendedora!";
        } else if (d && (d.status === "PENDING")) {
          if (h) h.textContent = T("co.paid.pending.h") || "Tu pago está en proceso";
          if (p) p.textContent = T("co.paid.pending.p") || "Te avisaremos por correo cuando se confirme.";
        } else {
          if (h) h.textContent = T("co.paid.fail.h") || "El pago no se completó";
          if (p) p.textContent = T("co.paid.fail.p") || "No se realizó ningún cobro. Puedes intentarlo de nuevo.";
        }
      }).catch(() => {
        if (h) h.textContent = T("gr.h");
        if (p) p.textContent = T("gr.p");
      });
    }
  }

  // ---------- ADMIN (puesto de mando) ----------
  // Correos con acceso de administración. Cambia/añade el tuyo aquí:
  const ADMIN_EMAILS = ["alquimiaespiritu@gmail.com"];
  const ADMIN_DIMS = ["Cuerpo", "Mente", "Alma", "Planeta", "Comunidad"];
  function adminCatList(s) { return String(s.cat || "").split(",").map(x => x.trim()).filter(Boolean); }
  function adminDate(d) { if (!d) return "—"; try { return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); } catch (e) { return d; } }

  async function initAdmin() {
    const root = document.getElementById("adminRoot");
    if (!root) return;
    root.innerHTML = `<p class="empty">Comprobando acceso…</p>`;
    let user = null;
    try { user = await A.authUser(); } catch (e) {}
    if (!user) { renderAdminLogin(root); return; }
    if (ADMIN_EMAILS.indexOf(String(user.email || "").toLowerCase()) < 0) {
      root.innerHTML = `<div class="fee-card" style="max-width:460px">
        <p>La cuenta <b>${esc(user.email)}</b> no tiene acceso de administración.</p>
        <button class="btn btn-ghost mt8" id="aOut">Cerrar sesión</button></div>`;
      document.getElementById("aOut").addEventListener("click", async () => { await A.signOut(); location.reload(); });
      return;
    }
    renderAdminPanel(root, user);
  }

  function renderAdminLogin(root) {
    root.innerHTML = `<div class="fee-card" style="max-width:420px;margin:0 auto">
      <h2 style="font-size:20px;margin-bottom:4px">Acceso de administradora</h2>
      <p class="muted" style="margin-bottom:14px">Entra con tu correo de administración para ver el panel.</p>
      <div class="field"><label>Correo</label><input id="ad-email" type="email" placeholder="tu@correo.com"></div>
      <div class="field"><label>Contraseña</label><input id="ad-pass" type="password" placeholder="••••••••"></div>
      <button class="btn btn-gold btn-block mt8" id="ad-in">Entrar</button>
      <button class="btn btn-ghost btn-block mt8" id="ad-new">Crear acceso de admin (primera vez)</button>
      <p class="note center mt8" id="ad-msg"></p></div>`;
    const getVals = () => ({ email: (document.getElementById("ad-email").value || "").trim(), pass: (document.getElementById("ad-pass").value || "").trim() });
    const msg = document.getElementById("ad-msg");
    document.getElementById("ad-in").addEventListener("click", async () => {
      const { email, pass } = getVals(); msg.style.color = ""; msg.textContent = "Entrando…";
      try { await A.signIn(email, pass); location.reload(); }
      catch (e) { msg.style.color = "var(--gold-2)"; msg.textContent = "No se pudo entrar. Revisa correo y contraseña."; }
    });
    document.getElementById("ad-new").addEventListener("click", async () => {
      const { email, pass } = getVals();
      if (ADMIN_EMAILS.indexOf(email.toLowerCase()) < 0) { msg.style.color = "var(--gold-2)"; msg.textContent = "Ese correo no está en la lista de administradoras."; return; }
      if (pass.length < 6) { msg.style.color = "var(--gold-2)"; msg.textContent = "Usa una contraseña de al menos 6 caracteres."; return; }
      msg.style.color = ""; msg.textContent = "Creando acceso…";
      try { await A.signUp(email, pass); await A.signIn(email, pass); location.reload(); }
      catch (e) { msg.style.color = "var(--gold-2)"; msg.textContent = "No se pudo crear: " + (e.message || e); }
    });
  }

  const ADMIN_SECTIONS = [
    { id: "resumen", icon: "◧", label: "Resumen" },
    { id: "vendedoras", icon: "✦", label: "Vendedoras" },
    { id: "ventas", icon: "↗", label: "Ventas" },
    { id: "gastos", icon: "▤", label: "Gastos" },
    { id: "impuestos", icon: "§", label: "Impuestos" },
    { id: "facturacion", icon: "🧾", label: "Facturación" },
    { id: "documentos", icon: "📎", label: "Documentos" },
    { id: "marketing", icon: "✶", label: "Marketing" }
  ];
  let _adminData = null, _adminSection = "resumen";

  async function renderAdminPanel(root, user) {
    root.innerHTML = `<p class="empty">Cargando datos…</p>`;
    try { _adminData = await A.adminSellers(); }
    catch (e) { root.innerHTML = `<div style="background:#fde8e8;color:#a11;padding:12px;border-radius:10px">No se pudieron cargar los datos: ${esc(e.message || e)}</div>`; return; }

    const nav = ADMIN_SECTIONS.map(s => `<button class="ad-navi ${s.id === _adminSection ? "active" : ""}" data-sec="${s.id}"><span class="ad-ico">${s.icon}</span><span class="ad-lbl">${s.label}</span></button>`).join("");
    root.innerHTML = `<div class="ad-shell" id="adShell">
      <aside class="ad-side">
        <button class="ad-collapse" id="adCollapse" title="Plegar/desplegar">☰</button>
        <nav class="ad-nav">${nav}</nav>
        <div class="ad-side-foot"><div class="ad-lbl muted" style="font-size:11px">${esc(user.email)}</div>
          <button class="btn btn-ghost ad-lbl" id="ad-out" style="margin-top:6px">Salir</button></div>
      </aside>
      <div class="ad-right">
        <section class="ad-main" id="adMain"></section>
        <div class="ad-advisor">
          <h3>Asesor IA · CEO + CFO</h3>
          <p class="muted">Pregúntale dónde va un dato o qué hacer con tus números. Acomoda la información en el lugar adecuado.</p>
          <div class="ad-roles">
            <button class="ad-role active" data-role="both">CEO + CFO</button>
            <button class="ad-role" data-role="ceo">CEO</button>
            <button class="ad-role" data-role="cfo">CFO</button>
          </div>
          <div class="ad-ask"><input id="adQ" placeholder="Ej: ¿dónde registro el pago del dominio? ¿cuánto guardo para impuestos?"><button class="btn btn-gold" id="adAsk">Preguntar</button></div>
          <div class="ad-answer" id="adAns"></div>
        </div>
      </div>
    </div>`;

    const main = document.getElementById("adMain");
    function show(sec) {
      _adminSection = sec;
      root.querySelectorAll(".ad-navi").forEach(b => b.classList.toggle("active", b.dataset.sec === sec));
      adminRenderSection(main, sec, user);
    }
    root.querySelectorAll(".ad-navi").forEach(b => b.addEventListener("click", () => show(b.dataset.sec)));
    document.getElementById("adCollapse").addEventListener("click", () => document.getElementById("adShell").classList.toggle("ad-collapsed"));
    document.getElementById("ad-out").addEventListener("click", async () => { await A.signOut(); location.reload(); });
    show(_adminSection);

    // Asesor IA (CEO + CFO)
    let advRole = "both";
    root.querySelectorAll(".ad-role").forEach(b => b.addEventListener("click", () => {
      advRole = b.dataset.role;
      root.querySelectorAll(".ad-role").forEach(x => x.classList.toggle("active", x === b));
    }));
    const askBtn = document.getElementById("adAsk"), qIn = document.getElementById("adQ"), ans = document.getElementById("adAns");
    async function ask() {
      const q = (qIn.value || "").trim(); if (!q) return;
      ans.textContent = "Pensando…";
      try {
        const out = await callAI({ action: "admin", lang: LANG(), role: advRole, section: _adminSection, context: adminContext(), question: q });
        ans.textContent = out.reply || "(sin respuesta)";
      } catch (e) { ans.textContent = "No se pudo consultar al asesor: " + (e.message || e); }
    }
    askBtn.addEventListener("click", ask);
    qIn.addEventListener("keydown", e => { if (e.key === "Enter") ask(); });
  }

  function adminContext() {
    const sellers = _adminData || [];
    const st = adminStats(sellers);
    const byDim = {}; ADMIN_DIMS.forEach(d => byDim[d] = 0);
    sellers.forEach(s => adminCatList(s).forEach(c => { if (byDim[c] != null) byDim[c]++; }));
    const dims = ADMIN_DIMS.map(d => d + ":" + byDim[d]).join(", ");
    return "Vendedoras totales: " + st.total + " (aprobadas: " + st.approved.length + ", por aprobar: " + st.pending.length + "). "
      + "Publicaciones: " + st.listings + ". Fundadoras 0%: " + st.founders + ". Destacadas: " + st.featured + ". Embajadoras: " + st.ambass + ". Quieren boletín: " + st.news + ". "
      + "Por dimensión: " + dims + ". "
      + "Ventas y comisión: aún 0 (Wompi pendiente de activar). "
      + "Costos conocidos: Netlify gratis, Supabase gratis, dominio ~€12-15/año, Groq gratis, Resend gratis, imágenes IA ~€0,04 c/u, Wompi ~2,99%+IVA por venta.";
  }

  function adminStats(sellers) {
    const approved = sellers.filter(s => s.approved);
    const pending = sellers.filter(s => !s.approved);
    return {
      total: sellers.length, approved: approved, pending: pending,
      listings: sellers.reduce((a, s) => a + ((s.listings && s.listings.length) || 0), 0),
      founders: sellers.filter(s => s.commission_free).length,
      featured: sellers.filter(s => s.featured).length,
      ambass: sellers.filter(s => s.ambassador).length,
      news: sellers.filter(s => s.newsletter).length
    };
  }
  const adStat = (n, l, cls) => `<div class="ad-stat ${cls || ""}"><div class="ad-n">${n}</div><div class="ad-l">${l}</div></div>`;
  function adSoon(title, intro, bullets, foot) {
    return `<div class="ad-soon"><h2 class="ad-h2">${title}</h2><p class="muted">${intro}</p>
      <div class="ad-grid">${bullets.map(b => `<div class="ad-stat ghost"><div class="ad-n">—</div><div class="ad-l">${b}</div></div>`).join("")}</div>
      ${foot ? `<p class="note ad-soon-note">${foot}</p>` : ""}</div>`;
  }

  function adminRenderSection(main, sec, user) {
    const sellers = _adminData || [];
    const st = adminStats(sellers);
    if (sec === "resumen") {
      main.innerHTML = `<h2 class="ad-h2">Resumen</h2>
        <div class="ad-grid">${adStat(st.total, "Vendedoras")}${adStat(st.approved.length, "Aprobadas", "good")}${adStat(st.pending.length, "Por aprobar", st.pending.length ? "warn" : "")}${adStat(st.listings, "Publicaciones")}</div>
        <div class="ad-grid">${adStat("€0", "Ventas del mes", "ghost")}${adStat("€0", "Comisión ganada", "ghost")}${adStat(st.founders, "Fundadoras (0%)")}${adStat(st.news, "Quieren boletín")}</div>
        <p class="note">Las ventas y la comisión se activan cuando Wompi registre los pagos. Lo demás son tus datos reales en vivo.</p>`;
    } else if (sec === "vendedoras") {
      adminRenderSellers(main, sellers, st, user);
    } else if (sec === "ventas") {
      main.innerHTML = adSoon("Ventas",
        "Aquí verás tus números de ventas en tiempo real, en cuanto Wompi empiece a registrar pagos.",
        ["Ventas del mes (GMV)", "Nº de transacciones", "Ticket medio", "Comisión ganada (10%)", "Ventas por vendedora", "Ventas por dimensión"],
        "Se enciende cuando conectemos el registro de ventas de Wompi (ver Plan-Pagos-Wompi-Colombia).");
    } else if (sec === "gastos") {
      main.innerHTML = `<h2 class="ad-h2">Gastos</h2>
        <p class="muted">Tus costos actuales de operación (lo que conocemos hoy):</p>
        <div class="ad-table"><div class="ad-tr ad-tr-gasto ad-th"><span>Concepto</span><span>Tipo</span><span>Costo</span></div>
          ${[["Netlify (hosting)", "Fijo", "Gratis (plan free)"],
             ["Supabase (datos)", "Fijo", "Gratis (plan free)"],
             ["Dominio alquimiasoy.com", "Anual", "≈ €12–15 / año"],
             ["Groq (IA)", "Variable", "Gratis (capa free)"],
             ["Resend (correos)", "Variable", "Gratis (capa free)"],
             ["Google Gemini (imágenes)", "Variable", "≈ €0,04 / imagen"],
             ["Comisión Wompi por venta", "Variable", "≈ 2,99% + IVA por transacción"]]
            .map(r => `<div class="ad-tr ad-tr-gasto"><span><b>${r[0]}</b></span><span>${r[1]}</span><span>${r[2]}</span></div>`).join("")}
        </div>
        <p class="note">Próximo paso: poder añadir/editar gastos manualmente (registro de gastos) para llevar tu contabilidad. ¿Lo construimos?</p>`;
    } else if (sec === "impuestos") {
      main.innerHTML = `<h2 class="ad-h2">Impuestos</h2>
        <p class="muted">Aquí calcularemos lo que Alquimia debe reservar para impuestos, según donde quede registrada.</p>
        <div class="ad-grid">${adStat("—", "IVA/BTW sobre comisión", "ghost")}${adStat("—", "Reserva para renta", "ghost")}${adStat("—", "A pagar este periodo", "ghost")}</div>
        <p class="note"><b>Importante:</b> esto no es asesoría fiscal. Depende de tu registro (eenmanszaak en NL y/o registro en Colombia) y debe validarlo tu abogada/contadora. Cuando definas el registro, configuramos el % correcto (p. ej. BTW 21% en NL) y se calcula solo a partir de las ventas.</p>`;
    } else if (sec === "facturacion") {
      main.innerHTML = `<h2 class="ad-h2">Facturación</h2>
        <p class="muted">Gestión de facturas: las que Alquimia emite por su comisión a cada vendedora, y los comprobantes de venta.</p>
        <div class="ad-grid">${adStat("0", "Facturas emitidas", "ghost")}${adStat("€0", "Facturado (comisión)", "ghost")}${adStat("0", "Pendientes de cobro", "ghost")}</div>
        <p class="note">Se activa con las ventas. Modelo previsto: factura mensual de comisión por vendedora (respetando Fundadoras 0% los primeros 3 meses). Requiere tu registro de empresa para emitir facturas formales.</p>`;
    } else if (sec === "documentos") {
      adminRenderDocs(main);
    } else if (sec === "marketing") {
      main.innerHTML = `<h2 class="ad-h2">Marketing</h2>
        <p class="muted">Tu actividad de marketing y comunidad.</p>
        <div class="ad-grid">${adStat(st.news, "Suscriptores al boletín")}${adStat("—", "Posts publicados", "ghost")}${adStat("5", "Noticias en la web")}${adStat("—", "Alcance redes", "ghost")}</div>
        <div class="ad-push">
          <h3 class="ad-h">🔔 Enviar una notificación</h3>
          <p class="muted">Manda un aviso al celular de quienes instalaron la app y activaron notificaciones.</p>
          <label class="ad-lbl">Tu clave de avisos <span class="muted">(se guarda solo en este navegador)</span></label>
          <div class="ad-row"><input id="apToken" type="password" class="inp" placeholder="Pega aquí tu ADMIN_PUSH_TOKEN"><button type="button" class="btn btn-ghost" id="apSaveToken">Guardar</button></div>
          <label class="ad-lbl">¿A quién?</label>
          <select id="apTopic" class="inp">
            <option value="all">Todos</option>
            <option value="news">Los que quieren noticias</option>
            <option value="promo">Los que quieren promociones</option>
            <option value="reto">Los del Reto</option>
          </select>
          <label class="ad-lbl">Título</label>
          <input id="apTitle" class="inp" maxlength="80" placeholder="Nueva noticia en Alquimia ✨">
          <label class="ad-lbl">Mensaje</label>
          <textarea id="apBody" class="inp" rows="3" maxlength="280" placeholder="Escribe aquí el aviso…"></textarea>
          <label class="ad-lbl">Enlace al tocar <span class="muted">(opcional)</span></label>
          <input id="apUrl" class="inp" placeholder="noticias.html">
          <div class="ad-row" style="margin-top:12px">
            <button type="button" class="btn btn-gold" id="apSend">Enviar aviso</button>
            <button type="button" class="btn btn-ghost" id="apTest">Probar (envíame a mí)</button>
          </div>
          <p class="note" id="apStatus"></p>
          <p class="note">La prueba solo te llega a ti si instalaste la app y activaste notificaciones en este dispositivo.</p>
        </div>
        <p class="note">Ya tienes tareas programadas (contenido, newsletter, tendencias) y la sección de Noticias bilingüe en la web. El Reto de Autoconocimiento envía su reflexión diaria solo.</p>`;
      wireAdminPush(main);
    }
  }

  function adminRenderSellers(main, sellers, st, user) {
    const byDim = {}; ADMIN_DIMS.forEach(d => byDim[d] = 0);
    sellers.forEach(s => adminCatList(s).forEach(c => { if (byDim[c] != null) byDim[c]++; }));
    let h = `<h2 class="ad-h2">Vendedoras</h2>
      <div class="ad-grid">${adStat(st.total, "Totales")}${adStat(st.approved.length, "Aprobadas", "good")}${adStat(st.pending.length, "Por aprobar", st.pending.length ? "warn" : "")}${adStat(st.listings, "Publicaciones")}</div>
      <div class="ad-grid">${adStat(st.founders, "Fundadoras (0%)")}${adStat(st.featured, "Destacadas")}${adStat(st.ambass, "Embajadoras")}${adStat(st.news, "Quieren boletín")}</div>
      <h3 class="ad-h">Por dimensión</h3><div class="ad-chips">${ADMIN_DIMS.map(d => `<span class="ad-chip">${d}: <b>${byDim[d]}</b></span>`).join("")}</div>`;

    h += `<h3 class="ad-h">⏳ Por aprobar (${st.pending.length})</h3>`;
    if (!st.pending.length) h += `<p class="empty">No hay vendedoras pendientes. ¡Al día! ✨</p>`;
    else {
      h += `<div class="ad-table"><div class="ad-tr ad-th"><span>Nombre</span><span>Email</span><span>Instagram</span><span>Dimensiones</span><span>Registro</span><span></span></div>`;
      st.pending.forEach(s => {
        h += `<div class="ad-tr"><span><b>${esc(s.name)}</b></span><span>${esc(s.email || "—")}</span><span>${s.instagram ? "@" + esc(String(s.instagram).replace(/^@/, "")) : "—"}</span><span>${esc(adminCatList(s).join(", ") || "—")}</span><span>${adminDate(s.created_at)}</span><span><button class="btn btn-gold ad-approve" data-id="${esc(s.id)}">Aprobar ✓</button></span></div>`;
      });
      h += `</div>`;
    }
    h += `<h3 class="ad-h">✅ Aprobadas (${st.approved.length})</h3>`;
    if (!st.approved.length) h += `<p class="empty">Aún no hay vendedoras aprobadas.</p>`;
    else {
      h += `<div class="ad-table"><div class="ad-tr ad-th3"><span>Nombre</span><span>Dimensiones</span><span>Public.</span><span>Distintivos</span><span>Registro</span><span></span></div>`;
      st.approved.forEach(s => {
        let tags = "";
        if (s.commission_free) tags += `<span class="ad-tag">Fundadora</span>`;
        if (s.featured) tags += `<span class="ad-tag">Destacada</span>`;
        if (s.ambassador) tags += `<span class="ad-tag">Embajadora</span>`;
        h += `<div class="ad-tr ad-tr3"><span><b>${esc(s.name)}</b></span><span>${esc(adminCatList(s).join(", ") || "—")}</span><span>${(s.listings && s.listings.length) || 0}</span><span>${tags || "—"}</span><span>${adminDate(s.created_at)}</span><span><button class="btn btn-ghost ad-hide" data-id="${esc(s.id)}">Ocultar</button></span></div>`;
      });
      h += `</div>`;
    }
    main.innerHTML = h;
    main.querySelectorAll(".ad-approve").forEach(b => b.addEventListener("click", () => adminToggle(b, true, main, user)));
    main.querySelectorAll(".ad-hide").forEach(b => b.addEventListener("click", () => adminToggle(b, false, main, user)));
  }

  async function adminRenderDocs(main) {
    const today = new Date().toISOString().slice(0, 10);
    main.innerHTML = `<h2 class="ad-h2">Documentos</h2>
      <p class="muted">Sube facturas escaneadas, comprobantes y documentos legales. Aquí reunimos todo lo necesario para presentar cuentas — financiero y legal — en un solo lugar.</p>
      <div class="ad-docform">
        <div class="ad-grid">
          <div class="field"><label>Tipo</label><select id="doc-kind">
            <option value="gasto">Gasto / factura</option>
            <option value="venta">Venta / ingreso</option>
            <option value="impuesto">Impuesto</option>
            <option value="legal">Legal</option>
            <option value="otro">Otro</option></select></div>
          <div class="field"><label>Concepto</label><input id="doc-concept" placeholder="Ej: Dominio alquimiasoy.com"></div>
          <div class="field"><label>Valor sin IVA</label><input id="doc-base" inputmode="decimal" placeholder="0,00"></div>
          <div class="field"><label>Valor con IVA</label><input id="doc-amount" inputmode="decimal" placeholder="0,00"></div>
          <div class="field"><label>Moneda</label><select id="doc-cur">${currencyOptions("EUR")}</select></div>
          <div class="field"><label>Fecha</label><input id="doc-date" type="date" value="${today}"></div>
          <div class="field"><label>Archivo (PDF o imagen)</label><input id="doc-file" type="file" accept="image/*,application/pdf"></div>
        </div>
        <button class="btn btn-gold" id="doc-save">Guardar documento</button>
        <span class="note" id="doc-msg" style="margin-left:10px"></span>
      </div>
      <h3 class="ad-h">Archivados</h3>
      <div id="doc-list"><p class="empty">Cargando documentos…</p></div>`;

    const msg = document.getElementById("doc-msg");
    document.getElementById("doc-save").addEventListener("click", async () => {
      const concept = (document.getElementById("doc-concept").value || "").trim();
      const baseRaw = (document.getElementById("doc-base").value || "").trim().replace(",", ".");
      const amountRaw = (document.getElementById("doc-amount").value || "").trim().replace(",", ".");
      const file = document.getElementById("doc-file").files[0] || null;
      if (!concept && !file) { msg.style.color = "var(--gold-2)"; msg.textContent = "Pon al menos un concepto o un archivo."; return; }
      msg.style.color = ""; msg.textContent = "Guardando…";
      try {
        await A.addDocument({
          kind: document.getElementById("doc-kind").value,
          concept: concept,
          base_amount: baseRaw ? parseFloat(baseRaw) : null,
          amount: amountRaw ? parseFloat(amountRaw) : null,
          currency: document.getElementById("doc-cur").value,
          doc_date: document.getElementById("doc-date").value || today
        }, file);
        msg.textContent = "Guardado ✓";
        document.getElementById("doc-concept").value = ""; document.getElementById("doc-amount").value = ""; document.getElementById("doc-base").value = "";
        const fi = document.getElementById("doc-file"); fi.value = "";
        loadDocs();
      } catch (e) { msg.style.color = "var(--gold-2)"; msg.textContent = docErr(e); }
    });

    async function loadDocs() {
      const box = document.getElementById("doc-list");
      try {
        const docs = await A.listDocuments();
        if (!docs.length) { box.innerHTML = `<p class="empty">Aún no hay documentos. Sube tu primera factura arriba.</p>`; return; }
        const r2 = n => Math.round((n || 0) * 100) / 100;
        const ivaTot = {}, conTot = {};
        let h = `<div class="ad-table"><div class="ad-tr ad-tr-doc ad-th"><span>Fecha</span><span>Tipo</span><span>Concepto</span><span>Valores (sin IVA · IVA · con IVA)</span><span>Archivo</span><span></span></div>`;
        docs.forEach(d => {
          const cur = d.currency || "", con = d.amount, sin = d.base_amount;
          let vals;
          if (sin != null && con != null) {
            const iva = r2(con - sin);
            ivaTot[cur] = (ivaTot[cur] || 0) + iva; conTot[cur] = (conTot[cur] || 0) + con;
            vals = `<span style="display:flex;flex-direction:column;font-size:12px;line-height:1.45">
              <span>Sin IVA: ${esc(cur)} ${sin}</span>
              <span style="color:var(--gold-2)">IVA: ${esc(cur)} ${iva}</span>
              <span><b>Con IVA: ${esc(cur)} ${con}</b></span></span>`;
          } else if (con != null) { conTot[cur] = (conTot[cur] || 0) + con; vals = esc(cur) + " " + con; }
          else vals = "—";
          h += `<div class="ad-tr ad-tr-doc">
            <span>${adminDate(d.doc_date)}</span>
            <span>${esc(d.kind || "—")}</span>
            <span><b>${esc(d.concept || "—")}</b></span>
            <span>${vals}</span>
            <span>${d.url ? `<a class="ad-dl" href="${esc(d.url)}" target="_blank">Ver ↗</a>` : "—"}</span>
            <span><button class="btn btn-ghost ad-doc-del" data-id="${esc(d.id)}">Borrar</button></span>
          </div>`;
        });
        h += `</div>`;
        const curs = [...new Set([...Object.keys(ivaTot), ...Object.keys(conTot)])];
        if (curs.length) {
          h += `<div class="ad-grid" style="margin-top:14px">`;
          curs.forEach(c => {
            const suf = curs.length > 1 ? ` (${esc(c)})` : "";
            h += adStat(`${esc(c)} ${r2(ivaTot[c])}`, "Total impuestos (IVA)" + suf, "gold");
            h += adStat(`${esc(c)} ${r2(conTot[c])}`, "Total con IVA" + suf, "ghost");
          });
          h += `</div>`;
        }
        box.innerHTML = h;
        box.querySelectorAll(".ad-doc-del").forEach(b => b.addEventListener("click", async () => {
          if (!confirm("¿Borrar este documento?")) return;
          try { await A.deleteDocument(b.dataset.id); loadDocs(); } catch (e) { alert(docErr(e)); }
        }));
      } catch (e) {
        box.innerHTML = `<div class="ad-setup">${docErr(e)}</div>`;
      }
    }
    function docErr(e) {
      const m = String((e && e.message) || e || "");
      if (/documentos/i.test(m) && /(exist|relation|schema|find)/i.test(m)) {
        return "Falta crear la tabla de documentos en Supabase (una sola vez). Ábrela en SQL Editor y pega:\n\n"
          + "create table if not exists documentos (id uuid primary key default gen_random_uuid(), kind text default 'gasto', concept text, amount numeric, base_amount numeric, currency text default 'EUR', doc_date date, url text, created_at timestamptz default now());\n"
          + "alter table documentos enable row level security;\n"
          + "create policy \"docs admin\" on documentos for all using (true) with check (true);";
      }
      return "No se pudo guardar/cargar: " + m;
    }
    loadDocs();
  }

  async function adminToggle(btn, value, main, user) {
    btn.disabled = true; btn.textContent = "Guardando…";
    try {
      await A.setApproved(btn.dataset.id, value);
      // Al APROBAR: correo de bienvenida "aliada" (Resend). _adminData aún tiene los datos de la vendedora.
      if (value) {
        try {
          var _s = (_adminData || []).find(function (x) { return x.id === btn.dataset.id; }) || {};
          if (_s.email) fetch("/.netlify/functions/resend-welcome", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "aliada", email: _s.email, name: _s.name || "", producto: _s.role || _s.name || "", instagram: _s.instagram || "" }) }).catch(function () {});
        } catch (e) {}
      }
      // Al APROBAR, avisamos a la vendedora por notificación (si el token del panel está guardado).
      if (value && A.pushSellerApproved) {
        let tk = ""; try { tk = localStorage.getItem("alq_push_token") || ""; } catch (e) {}
        if (tk) { A.pushSellerApproved({ token: tk, sellerId: btn.dataset.id }).catch(function () {}); }
      }
      _adminData = await A.adminSellers();
      adminRenderSellers(main, _adminData, adminStats(_adminData), user);
    } catch (e) {
      btn.disabled = false; btn.textContent = value ? "Aprobar ✓" : "Ocultar";
      alert("No se pudo guardar. Para aprobar desde aquí falta dar permiso al admin en Supabase (te paso el SQL). Mientras tanto puedes aprobar en Supabase.\n\nDetalle: " + (e.message || e));
    }
  }

  // Conecta los botones del bloque "Enviar una notificación" del panel de marketing.
  function wireAdminPush(main) {
    const q = sel => main.querySelector(sel);
    const tokEl = q("#apToken");
    if (tokEl) { try { tokEl.value = localStorage.getItem("alq_push_token") || ""; } catch (e) {} }
    const status = m => { const s = q("#apStatus"); if (s) s.textContent = m; };
    const save = q("#apSaveToken");
    if (save) save.addEventListener("click", () => { try { localStorage.setItem("alq_push_token", (tokEl.value || "").trim()); } catch (e) {} status("Clave guardada en este navegador ✓"); });
    async function send(topicOverride, titleOverride, bodyOverride) {
      const token = (tokEl && tokEl.value.trim()) || "";
      if (!token) { status("Primero pega tu clave de avisos y pulsa Guardar."); return; }
      const topic = topicOverride || (q("#apTopic") && q("#apTopic").value) || "all";
      const title = titleOverride || (q("#apTitle") && q("#apTitle").value.trim()) || "";
      const body = bodyOverride || (q("#apBody") && q("#apBody").value.trim()) || "";
      const url = (q("#apUrl") && q("#apUrl").value.trim()) || "index.html";
      if (!title || !body) { status("Escribe un título y un mensaje."); return; }
      status("Enviando…");
      try {
        const r = await A.pushBroadcast({ token, topic, title, body, url });
        status("Enviado a " + r.sent + " dispositivo(s)." + (r.removed ? " (" + r.removed + " caducados eliminados)" : ""));
      } catch (e) { status("Error: " + (e.message || e)); }
    }
    const sendBtn = q("#apSend"); if (sendBtn) sendBtn.addEventListener("click", () => send());
    const testBtn = q("#apTest"); if (testBtn) testBtn.addEventListener("click", () => send("admin", "Prueba de Alquimia ✨", "Si ves esto en tu celular, ¡tus notificaciones funcionan!"));
  }

  // ---- Reto de Autoconocimiento (reto.html) ----
  function retoState() { try { return JSON.parse(localStorage.getItem("alq_reto") || "null"); } catch (e) { return null; } }
  function retoSave(s) { try { localStorage.setItem("alq_reto", JSON.stringify(s)); } catch (e) {} }
  function retoTxt(o) { const L = LANG(); return (o && (o[L] || o.es)) || ""; }
  function todayISO() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  async function initReto() {
    const root = document.getElementById("retoRoot");
    if (!root || !window.ALQ_RETO) return;
    const RETO = window.ALQ_RETO;
    let state = retoState();

    function pushChip() {
      // Muestra el estado de las notificaciones y un botón para activarlas.
      return '<div class="reto-notif" id="retoNotif"></div>';
    }

    async function refreshNotif(joinedStart) {
      const el = document.getElementById("retoNotif");
      if (!el || !window.ALQPUSH) return;
      const st = await window.ALQPUSH.state();
      if (st === "on") { el.innerHTML = '<span class="reto-onchip">🔔 ' + esc(T("reto.notif.on")) + '</span>'; return; }
      if (st === "unsupported") { el.innerHTML = '<p class="muted reto-small">' + esc(T("reto.notif.unsupported")) + '</p>'; return; }
      if (st === "need-install") { el.innerHTML = '<p class="muted reto-small">📲 ' + esc(T("reto.notif.ios")) + '</p>'; return; }
      if (st === "denied") { el.innerHTML = '<p class="muted reto-small">' + esc(T("reto.notif.denied")) + '</p>'; return; }
      el.innerHTML = '<button type="button" class="btn btn-ghost" id="retoEnable">🔔 ' + esc(T("reto.notif.enable")) + '</button>';
      const b = document.getElementById("retoEnable");
      if (b) b.addEventListener("click", async () => {
        b.disabled = true; b.textContent = T("reto.notif.working");
        const r = await window.ALQPUSH.enable({ topics: ["reto", "general"], retoStart: joinedStart || (state && state.start) || todayISO() });
        if (r.status === "ok") refreshNotif(joinedStart);
        else if (r.status === "need-install") { b.outerHTML = '<p class="muted reto-small">📲 ' + esc(T("reto.notif.ios")) + '</p>'; }
        else if (r.status === "denied") { b.outerHTML = '<p class="muted reto-small">' + esc(T("reto.notif.denied")) + '</p>'; }
        else { b.disabled = false; b.textContent = "🔔 " + T("reto.notif.enable"); }
      });
    }

    function renderIntro() {
      root.innerHTML =
        '<span class="eyebrow" style="justify-content:center">☉ ' + esc(T("reto.eyebrow")) + '</span>' +
        '<h1 style="font-size:clamp(30px,5vw,52px);font-weight:400;line-height:1.05;max-width:14em;margin:14px auto 10px">' + esc(T("reto.title")) + '</h1>' +
        '<p class="lede" style="max-width:40ch;margin:0 auto 8px">' + esc(T("reto.lede")) + '</p>' +
        '<div class="reto-steps">' +
          '<div class="reto-step"><span class="rs-n">21</span><span>' + esc(T("reto.f1")) + '</span></div>' +
          '<div class="reto-step"><span class="rs-n">1</span><span>' + esc(T("reto.f2")) + '</span></div>' +
          '<div class="reto-step"><span class="rs-n">✎</span><span>' + esc(T("reto.f3")) + '</span></div>' +
        '</div>' +
        '<button type="button" class="btn btn-gold btn-lg" id="retoJoin" style="margin-top:8px">' + esc(T("reto.join")) + '</button>' +
        '<p class="muted reto-small" style="margin-top:14px">' + esc(T("reto.joinNote")) + '</p>';
      const j = document.getElementById("retoJoin");
      if (j) j.addEventListener("click", async () => {
        const start = todayISO();
        state = { start: start, answers: {} };
        retoSave(state);
        // Intenta activar las notificaciones al unirse (pide permiso).
        if (window.ALQPUSH) { try { await window.ALQPUSH.enable({ topics: ["reto", "general"], retoStart: start }); } catch (e) {} }
        renderDay();
      });
    }

    function renderDay() {
      const day = RETO.dayFor(state.start);
      const total = RETO.days.length;
      const idx = day.d;
      const finished = idx >= total && (RETO.dayFor(state.start).d === total);
      const saved = (state.answers && state.answers[day.d]) || "";
      const pct = Math.round((day.d / total) * 100);
      root.innerHTML =
        '<span class="eyebrow" style="justify-content:center">' + day.sym + ' ' + esc(T("cat." + day.pilar)) + ' · ' + esc(T("reto.dayLabel")) + ' ' + day.d + '/' + total + '</span>' +
        '<div class="reto-progress"><span style="width:' + pct + '%"></span></div>' +
        '<h1 class="reto-daytitle">' + esc(retoTxt(day.title)) + '</h1>' +
        '<p class="reto-refl">' + esc(retoTxt(day.r)) + '</p>' +
        '<div class="reto-qcard">' +
          '<p class="reto-q"><strong>' + esc(T("reto.q")) + '</strong> ' + esc(retoTxt(day.q)) + '</p>' +
          '<textarea id="retoAns" class="inp reto-ans" rows="4" placeholder="' + esc(T("reto.ansPh")) + '">' + esc(saved) + '</textarea>' +
          '<div class="row" style="justify-content:space-between;align-items:center;gap:10px;margin-top:8px">' +
            '<span class="muted reto-small" id="retoSaved">' + (saved ? esc(T("reto.answered")) : "") + '</span>' +
            '<button type="button" class="btn btn-gold" id="retoSaveBtn">' + esc(T("reto.save")) + '</button>' +
          '</div>' +
        '</div>' +
        pushChip() +
        '<p class="muted reto-small" style="margin-top:18px">' + esc(T("reto.tomorrow")) + '</p>' +
        '<button type="button" class="reto-reset" id="retoReset">' + esc(T("reto.restart")) + '</button>';
      const sv = document.getElementById("retoSaveBtn");
      if (sv) sv.addEventListener("click", () => {
        const t = (document.getElementById("retoAns").value || "").trim();
        state.answers = state.answers || {}; state.answers[day.d] = t; retoSave(state);
        const m = document.getElementById("retoSaved"); if (m) m.textContent = T("reto.answered");
        sv.textContent = T("reto.saved"); setTimeout(() => { sv.textContent = T("reto.save"); }, 1600);
      });
      const rs = document.getElementById("retoReset");
      if (rs) rs.addEventListener("click", () => {
        if (confirm(T("reto.restartConfirm"))) { state = null; retoSave(null); try { localStorage.removeItem("alq_reto"); } catch (e) {} renderIntro(); }
      });
      refreshNotif(state.start);
    }

    if (state && state.start) renderDay(); else renderIntro();
  }

  // ---- helpers ----
  function val(id) { const e = document.getElementById(id); return e ? e.value.trim() : ""; }
  function downscale(file, max, cb) {
    const r = new FileReader();
    r.onload = e => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = img.width * sc; c.height = img.height * sc;
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL("image/jpeg", 0.72));
      };
      img.src = e.target.result;
    };
    r.readAsDataURL(file);
  }

  // ---- boot ----
  document.addEventListener("DOMContentLoaded", async () => {
    const page = document.body.dataset.page;
    if (window.I18N) window.I18N.applyStatic();
    // PWA + notificaciones (instalar la app, avisos). Se carga en todas las páginas.
    if (!window.ALQPUSH && !document.getElementById("alq-pwa-js")) {
      const ps = document.createElement("script");
      ps.id = "alq-pwa-js"; ps.src = "assets/pwa.js"; ps.defer = true;
      document.head.appendChild(ps);
    }
    if (A.refreshRates) A.refreshRates();
    chrome(page);
    // carga vendedoras desde Supabase antes de pintar las páginas con datos
    if (A.load && ["marketplace","listing","profile","dashboard","comprador","cart","checkout"].indexOf(page) >= 0) {
      try { await A.load(); } catch (e) {}
    }
    ({ index: initIndex, marketplace: initMarketplace, listing: initListing, profile: initProfile,
       create: initCreate, connect: initConnect, checkout: initCheckout, dashboard: initDashboard,
       cart: initCart, registro: initRegistro, gracias: initGracias, pilar: initPilar,
       reset: initReset, comprador: initComprador, admin: initAdmin, reto: initReto }[page] || function(){})();
    // Latido contextual del logo: en una página de pilar, solo late ese elemento
    if (document.body.dataset.pillar) setMarkPulse([document.body.dataset.pillar]);
    // Botón "Me interesa": activa el listener global (modal de contacto por correo)
    wireInterest();
    // Ojo de ver/ocultar en todos los campos de contraseña (también los que se crean después)
    enhancePasswordFields(document);
    try {
      new MutationObserver(muts => {
        for (const m of muts) for (const n of m.addedNodes) {
          if (n.nodeType === 1) { if (n.matches && n.matches('input[type="password"]')) enhancePasswordFields(n.parentNode || document); else enhancePasswordFields(n); }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    // Logo animado "vivo" en cualquier página que lo incluya (.logo-full)
    initLiveLogo();
    // Flor de pilares (quiénes somos)
    initFlower();
    // Partículas de oro flotando (quiénes somos + valores)
    initGoldParticles();
  });
})();
