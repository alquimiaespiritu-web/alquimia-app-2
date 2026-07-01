/* ===== Alquimia — datos de demostración + helpers (en memoria + localStorage) ===== */
window.ALQ = (function () {
  const COMMISSION = 0.10; // 10% de comisión de la plataforma
  const CURRENCY = "€"; // (legado)

  // ---- Monedas: euro + monedas de Latinoamérica ----
  const CURRENCIES = {
    EUR: { symbol: "€", code: "EUR", locale: "es-ES" },
    COP: { symbol: "$", code: "COP", locale: "es-CO" },   // Peso colombiano
    USD: { symbol: "$", code: "USD", locale: "en-US" },   // Dólar (varios países)
    MXN: { symbol: "$", code: "MXN", locale: "es-MX" },   // Peso mexicano
    ARS: { symbol: "$", code: "ARS", locale: "es-AR" },   // Peso argentino
    CLP: { symbol: "$", code: "CLP", locale: "es-CL" },   // Peso chileno
    PEN: { symbol: "S/ ", code: "PEN", locale: "es-PE" }, // Sol peruano
    BRL: { symbol: "R$ ", code: "BRL", locale: "pt-BR" }  // Real brasileño
  };
  // Tasas aproximadas por 1 EUR (respaldo). Se refrescan en vivo si hay conexión.
  let RATES = { EUR: 1, COP: 4600, USD: 1.08, MXN: 19.5, ARS: 1050, CLP: 1010, PEN: 4.05, BRL: 5.9 };
  try { const cr = JSON.parse(localStorage.getItem("alq_rates") || "null"); if (cr && cr.r) RATES = Object.assign({}, RATES, cr.r); } catch (e) {}

  async function refreshRates() {
    try {
      const cr = JSON.parse(localStorage.getItem("alq_rates") || "null");
      if (cr && cr.t && (Date.now() - cr.t) < 12 * 3600 * 1000) return; // cache 12h
      const res = await fetch("https://open.er-api.com/v6/latest/EUR");
      const j = await res.json();
      if (j && j.rates) {
        const r = {}; Object.keys(CURRENCIES).forEach(k => { if (j.rates[k]) r[k] = j.rates[k]; });
        RATES = Object.assign({}, RATES, r);
        localStorage.setItem("alq_rates", JSON.stringify({ t: Date.now(), r: RATES }));
      }
    } catch (e) {}
  }
  function displayCurrency() { try { return localStorage.getItem("alq_display_cur") || "EUR"; } catch (e) { return "EUR"; } }
  function setDisplayCurrency(c) { try { localStorage.setItem("alq_display_cur", c); } catch (e) {} }
  function currencyList() { return Object.keys(CURRENCIES); }
  function convert(amount, from, to) {
    from = from || "EUR"; to = to || "EUR";
    if (from === to) return amount;
    const f = RATES[from] || 1, t = RATES[to] || 1;
    return Number(amount || 0) * (t / f);
  }
  function fmt(n, cur) {
    cur = cur || "EUR";
    const c = CURRENCIES[cur] || CURRENCIES.EUR;
    const s = c.symbol + Number(n || 0).toLocaleString(c.locale, { maximumFractionDigits: 0 });
    return cur === "EUR" ? s : s + " " + c.code;
  }

  const categories = ["Cuerpo", "Mente", "Alma", "Planeta", "Comunidad"];

  // ---- Supabase (base de datos + fotos en la nube) ----
  const SB_URL = "https://cxmpypestxedhwymxsdl.supabase.co";
  const SB_KEY = "sb_publishable_yCJOMWSvHdNlCk1EWk_MbA_WWqMBQcp";
  let sb = null, _remote = [];
  async function ensureClient() {
    if (sb) return sb;
    if (!window.supabase || !window.supabase.createClient) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
    }
    sb = window.supabase.createClient(SB_URL, SB_KEY);
    // Si el enlace que se abrió es de RECUPERAR CONTRASEÑA, llevamos SIEMPRE a la
    // pantalla de clave nueva (reset.html) antes de dejar entrar a la cuenta.
    try {
      sb.auth.onAuthStateChange(function (event) {
        if (event === "PASSWORD_RECOVERY" && !/reset\.html$/.test(location.pathname)) {
          location.replace("reset.html");
        }
      });
    } catch (e) {}
    return sb;
  }

  // Vendedores base (perfiles de ejemplo) — con traducción EN (campos *En)
  const baseSellers = [
    { id: "lina", name: "Lina Restrepo", role: "Coach de propósito", roleEn: "Purpose coach", cat: "Coaching", loc: "Medellín · CO", ini: "LR",
      bio: "Acompaño a fundadoras conscientes a alinear su negocio con lo que de verdad quieren construir. Programas de 8 semanas, sesiones 1:1 y círculos de propósito.",
      bioEn: "I help conscious founders align their business with what they truly want to build. 8-week programs, 1:1 sessions and purpose circles.",
      media: [{t:"photo",g:1,l:"Círculo de propósito",lEn:"Purpose circle"},{t:"photo",g:3,l:"Sesión 1:1",lEn:"1:1 session"},{t:"video",g:5,l:"Vivir de tu propósito",lEn:"Living from your purpose",d:"4:12"}],
      listings: [
        { id:"l-lina-1", title:"Sesión de propósito 1:1", titleEn:"1:1 purpose session", kind:"Servicio", price:70, g:5, desc:"Una sesión individual de 75 minutos para ganar claridad sobre tu próximo paso.", descEn:"A 75-minute one-on-one session to gain clarity on your next step." },
        { id:"l-lina-2", title:"Programa Propósito · 8 semanas", titleEn:"Purpose Program · 8 weeks", kind:"Servicio", price:480, g:1, desc:"Acompañamiento de dos meses para estructurar tu negocio alrededor de lo que te mueve.", descEn:"Two months of guidance to build your business around what moves you." }
      ]},
    { id: "daniel", name: "Daniel Vélez", role: "Terapeuta holístico", roleEn: "Holistic therapist", cat: "Bienestar", loc: "Bogotá · CO", ini: "DV",
      bio: "Sesiones de respiración y trabajo somático para personas en procesos de cambio. Atiendo presencial en Bogotá y también en línea.",
      bioEn: "Breathwork and somatic sessions for people going through change. I work in person in Bogotá and online.",
      media: [{t:"photo",g:3,l:"El espacio",lEn:"The space"},{t:"photo",g:1,l:"Taller de respiración",lEn:"Breathwork workshop"},{t:"video",g:5,l:"Respiración guiada",lEn:"Guided breathing",d:"6:30"}],
      listings: [
        { id:"l-dani-1", title:"Sesión de respiración consciente", titleEn:"Conscious breathwork session", kind:"Servicio", price:55, g:3, desc:"Sesión guiada de respiración y trabajo somático, presencial u online.", descEn:"Guided breathwork and somatic session, in person or online." },
        { id:"l-dani-2", title:"Taller somático en grupo", titleEn:"Group somatic workshop", kind:"Servicio", price:30, g:6, desc:"Encuentro grupal mensual para soltar tensión y reconectar con el cuerpo.", descEn:"Monthly group gathering to release tension and reconnect with the body." }
      ]},
    { id: "marta", name: "Marta Kuijpers", role: "Cerámica consciente", roleEn: "Conscious ceramics", cat: "Arte", loc: "Utrecht · NL", ini: "MK",
      bio: "Piezas hechas a mano con arcilla local y cero desperdicio. Doy talleres de cerámica en grupos pequeños en mi estudio de Utrecht.",
      bioEn: "Handmade pieces with local clay and zero waste. I run small-group ceramics workshops in my Utrecht studio.",
      media: [{t:"photo",g:2,l:"Colección Tierra",lEn:"Earth collection"},{t:"photo",g:3,l:"El estudio",lEn:"The studio"},{t:"photo",g:1,l:"Taller en grupo",lEn:"Group workshop"},{t:"video",g:5,l:"Cómo nace una pieza",lEn:"How a piece is born",d:"3:45"}],
      listings: [
        { id:"l-marta-1", title:"Cuenco de cerámica artesanal", titleEn:"Handcrafted ceramic bowl", kind:"Producto", price:38, g:2, desc:"Pieza única en arcilla local, esmaltada a mano. Cada cuenco es distinto.", descEn:"One-of-a-kind piece in local clay, hand-glazed. Every bowl is different." },
        { id:"l-marta-2", title:"Taller de cerámica (medio día)", titleEn:"Ceramics workshop (half day)", kind:"Servicio", price:65, g:3, desc:"Aprende a modelar tu primera pieza en un grupo de máximo 6 personas.", descEn:"Learn to shape your first piece in a group of up to 6 people." }
      ]},
    { id: "sofia", name: "Sofía Mendoza", role: "Marca textil sostenible", roleEn: "Sustainable textile brand", cat: "Sostenibilidad", loc: "Medellín · CO", ini: "SM",
      bio: "Ropa en algodón orgánico y tintes naturales, producida en talleres con condiciones justas. Cada prenda con trazabilidad completa.",
      bioEn: "Clothing in organic cotton and natural dyes, made in fair-condition workshops. Every garment fully traceable.",
      media: [{t:"photo",g:4,l:"Colección cápsula",lEn:"Capsule collection"},{t:"photo",g:2,l:"Tintes naturales",lEn:"Natural dyes"},{t:"photo",g:3,l:"El taller",lEn:"The workshop"},{t:"video",g:5,l:"De la semilla a la prenda",lEn:"From seed to garment",d:"5:10"}],
      listings: [
        { id:"l-sofia-1", title:"Camiseta de algodón orgánico", titleEn:"Organic cotton t-shirt", kind:"Producto", price:42, g:4, desc:"Algodón orgánico certificado, tinte natural, costura en taller justo.", descEn:"Certified organic cotton, natural dye, sewn in a fair workshop." },
        { id:"l-sofia-2", title:"Tote bag teñido a mano", titleEn:"Hand-dyed tote bag", kind:"Producto", price:24, g:2, desc:"Bolsa resistente teñida con pigmentos vegetales. Edición limitada.", descEn:"Sturdy bag dyed with plant pigments. Limited edition." }
      ]},
    { id: "tomas", name: "Tomás Iriarte", role: "Facilitador de círculos", roleEn: "Circle facilitator", cat: "Educación", loc: "Ámsterdam · NL", ini: "TI",
      bio: "Diseño espacios de aprendizaje colectivo para equipos y comunidades. Facilitación de círculos, retiros y procesos de grupo.",
      bioEn: "I design collective learning spaces for teams and communities. Circle facilitation, retreats and group processes.",
      media: [{t:"photo",g:1,l:"Retiro de equipo",lEn:"Team retreat"},{t:"photo",g:3,l:"Círculo abierto",lEn:"Open circle"},{t:"video",g:5,l:"Qué es un círculo",lEn:"What a circle is",d:"7:20"}],
      listings: [
        { id:"l-tomas-1", title:"Facilitación de círculo (2h)", titleEn:"Circle facilitation (2h)", kind:"Servicio", price:180, g:1, desc:"Diseño y facilito un círculo de diálogo para tu equipo o comunidad.", descEn:"I design and facilitate a dialogue circle for your team or community." },
        { id:"l-tomas-2", title:"Retiro de fin de semana", titleEn:"Weekend retreat", kind:"Servicio", price:350, g:6, desc:"Dos días de procesos de grupo en un entorno natural. Cupos limitados.", descEn:"Two days of group processes in a natural setting. Limited spots." }
      ]},
    { id: "valentina", name: "Valentina Cruz", role: "Nutrición integrativa", roleEn: "Integrative nutrition", cat: "Salud", loc: "Cali · CO", ini: "VC",
      bio: "Planes de alimentación que parten de la historia y el contexto de cada persona, no de fórmulas genéricas. Acompañamiento de tres meses.",
      bioEn: "Nutrition plans built from each person's history and context, not generic formulas. Three-month guidance.",
      media: [{t:"photo",g:4,l:"Cocina viva",lEn:"Living kitchen"},{t:"photo",g:3,l:"La consulta",lEn:"The consultation"},{t:"video",g:5,l:"Mi enfoque",lEn:"My approach",d:"4:50"}],
      listings: [
        { id:"l-vale-1", title:"Valoración inicial", titleEn:"Initial assessment", kind:"Servicio", price:60, g:4, desc:"Primera consulta para entender tu contexto y trazar un punto de partida.", descEn:"First consultation to understand your context and set a starting point." },
        { id:"l-vale-2", title:"Acompañamiento · 3 meses", titleEn:"Guidance · 3 months", kind:"Servicio", price:390, g:3, desc:"Seguimiento cercano durante tres meses, ajustado a tu vida real.", descEn:"Close follow-up over three months, tailored to your real life." }
      ]}
  ];

  // ---- carga de vendedoras desde Supabase ----
  function mapSeller(s) {
    return {
      id: s.id, name: s.name, role: s.role, cat: s.cat, loc: s.loc, ini: s.ini,
      bio: s.bio, avatarImg: s.avatar_url || null, instagram: s.instagram || null, payUrl: s.pay_url || null,
      notifyChannel: s.notify_channel || "email", whatsapp: s.whatsapp || null,
      email: s.email || null, stripeAccountId: s.stripe_account_id || null,
      commissionFree: !!s.commission_free, featured: !!s.featured, ambassador: !!s.ambassador,
      currency: s.currency || "EUR", languages: s.languages || "",
      media: (s.media || []).map(m => ({ t: m.type, url: m.url })),
      listings: (s.listings || []).map(l => ({
        id: l.id, title: l.title, kind: l.kind, price: Number(l.price) || 0,
        desc: l.descr, g: l.g || "grad-1", img: l.img_url || null, currency: s.currency || "EUR",
        cat: l.cat || null
      }))
    };
  }
  async function load() {
    try {
      const c = await ensureClient();
      const { data, error } = await c.from("sellers").select("*, listings(*), media(*)").eq("approved", true).order("created_at", { ascending: false });
      if (error) { console.warn("Supabase load:", error.message); return; }
      _remote = (data || []).map(mapSeller);
    } catch (e) { console.warn("Supabase load:", e); }
  }

  // ADMIN: trae TODAS las vendedoras (aprobadas y pendientes) con el conteo de publicaciones
  async function adminSellers() {
    const c = await ensureClient();
    const { data, error } = await c.from("sellers").select("*, listings(id)").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }
  // ADMIN: aprueba o desaprueba una vendedora (requiere sesión con permiso adecuado en Supabase)
  async function setApproved(sellerId, value) {
    const c = await ensureClient();
    const { error } = await c.from("sellers").update({ approved: !!value }).eq("id", sellerId);
    if (error) throw error;
  }
  // ADMIN: documentos (facturas escaneadas, comprobantes, legal). Tabla `documentos`.
  async function listDocuments() {
    const c = await ensureClient();
    const { data, error } = await c.from("documentos").select("*").order("doc_date", { ascending: false });
    if (error) throw error;
    return data || [];
  }
  async function addDocument(meta, file) {
    const c = await ensureClient();
    let url = null;
    if (file) {
      const safe = String(file.name || "doc").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = "documentos/" + Date.now() + "-" + safe;
      const { error: ue } = await c.storage.from("fotos").upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
      if (ue) throw ue;
      url = c.storage.from("fotos").getPublicUrl(path).data.publicUrl;
    }
    const row = {
      kind: meta.kind || "gasto", concept: meta.concept || "", amount: meta.amount != null ? meta.amount : null,
      currency: meta.currency || "EUR", doc_date: meta.doc_date || new Date().toISOString().slice(0, 10), url: url
    };
    const { error } = await c.from("documentos").insert(row);
    if (error) throw error;
  }
  async function deleteDocument(id) {
    const c = await ensureClient();
    const { error } = await c.from("documentos").delete().eq("id", id);
    if (error) throw error;
  }

  // sube una foto (dataURL) al bucket 'fotos' y devuelve su URL pública
  async function uploadPhoto(dataUrl, path) {
    if (!dataUrl) return null;
    const c = await ensureClient();
    const blob = await (await fetch(dataUrl)).blob();
    const { error } = await c.storage.from("fotos").upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
    if (error) throw new Error("foto: " + error.message);
    return c.storage.from("fotos").getPublicUrl(path).data.publicUrl;
  }

  // sube un archivo (File/Blob, p.ej. video) tal cual al bucket 'fotos'
  async function uploadFile(file, path) {
    if (!file) return null;
    const c = await ensureClient();
    const { error } = await c.storage.from("fotos").upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
    if (error) throw new Error("video: " + error.message);
    return c.storage.from("fotos").getPublicUrl(path).data.publicUrl;
  }

  // guarda la vendedora + sus publicaciones en Supabase
  async function saveProfile(profile) {
    const c = await ensureClient();
    const base = {
      id: profile.id, name: profile.name, role: profile.role, cat: profile.cat,
      loc: profile.loc, ini: profile.ini, bio: profile.bio, avatar_url: profile.avatarImg || null,
      email: profile.email || null, instagram: profile.instagram || null,
      conciencia: profile.conciencia || null, pay_url: profile.payUrl || null,
      currency: profile.currency || "EUR",
      user_id: profile.user_id || null, approved: false
    };
    // newsletter + términos + idiomas + canal de avisos (si las columnas aún no existen, se reintenta sin ellas)
    const extra = { newsletter: !!profile.newsletter, terms_accepted: !!profile.terms, languages: profile.languages || null,
      notify_channel: profile.notifyChannel || "email", whatsapp: profile.whatsapp || null };
    let { error: e1 } = await c.from("sellers").insert(Object.assign({}, base, extra));
    if (e1 && /column|newsletter|terms_accepted|languages|notify_channel|whatsapp|schema|does not exist/i.test(e1.message || "")) {
      ({ error: e1 } = await c.from("sellers").insert(base));
    }
    if (e1) throw e1;
    const rows = (profile.listings || []).map(l => ({
      id: l.id, seller_id: profile.id, title: l.title, kind: l.kind,
      price: l.price, descr: l.desc, img_url: l.img || null, g: l.g, cat: l.cat || null
    }));
    if (rows.length) {
      let { error: e2 } = await c.from("listings").insert(rows);
      if (e2 && /cat|column|does not exist|schema/i.test(e2.message || "")) {
        ({ error: e2 } = await c.from("listings").insert(rows.map(r => { const x = Object.assign({}, r); delete x.cat; return x; })));
      }
      if (e2) throw e2;
    }
    const mrows = (profile.media || []).map((m, i) => ({ id: profile.id + "-m" + i, seller_id: profile.id, type: m.type, url: m.url }));
    if (mrows.length) { const { error: e3 } = await c.from("media").insert(mrows); if (e3) throw e3; }
    localStorage.setItem("alq_last_profile", profile.id);
    return profile;
  }
  function lastProfileId() { return localStorage.getItem("alq_last_profile"); }

  // Añade UNA publicación (producto/servicio) a un perfil ya creado.
  async function addListing(sellerId, listing) {
    const c = await ensureClient();
    const id = sellerId + "-" + Date.now();
    let imgUrl = null;
    if (listing.img) imgUrl = await uploadPhoto(listing.img, "listings/" + id + ".jpg");
    const row = { id: id, seller_id: sellerId, title: listing.title, kind: listing.kind,
      price: Number(listing.price) || 0, descr: listing.desc || null, img_url: imgUrl, g: listing.g || "grad-1", cat: listing.cat || null };
    let { error } = await c.from("listings").insert(row);
    if (error && /cat|column|does not exist|schema/i.test(error.message || "")) {
      delete row.cat; ({ error } = await c.from("listings").insert(row));
    }
    if (error) throw error;
    return id;
  }

  // Edita el perfil de la vendedora (nombre, rol, categorías, ubicación, moneda, etc.).
  async function updateProfile(sellerId, fields) {
    const c = await ensureClient();
    const row = {};
    ["name", "role", "cat", "loc", "ini", "bio", "instagram", "conciencia"].forEach(k => { if (fields[k] !== undefined) row[k] = fields[k]; });
    if (fields.payUrl !== undefined) row.pay_url = fields.payUrl;
    if (fields.currency !== undefined) row.currency = fields.currency;
    if (fields.languages !== undefined) row.languages = fields.languages;
    if (fields.newsletter !== undefined) row.newsletter = !!fields.newsletter;
    if (fields.notifyChannel !== undefined) row.notify_channel = fields.notifyChannel;
    if (fields.whatsapp !== undefined) row.whatsapp = fields.whatsapp;
    if (fields.avatarImg) row.avatar_url = await uploadPhoto(fields.avatarImg, "avatars/" + sellerId + "-" + Date.now() + ".jpg");
    let { error } = await c.from("sellers").update(row).eq("id", sellerId);
    if (error && /newsletter|languages|notify_channel|whatsapp|column|does not exist|schema/i.test(error.message || "")) {
      delete row.newsletter; delete row.languages; delete row.notify_channel; delete row.whatsapp;
      ({ error } = await c.from("sellers").update(row).eq("id", sellerId));
    }
    if (error) throw error;
    return sellerId;
  }

  // Cambia la contraseña de la cuenta (vendedora con sesión iniciada).
  async function changePassword(newPass) {
    const c = await ensureClient();
    const { error } = await c.auth.updateUser({ password: newPass });
    if (error) throw error;
    return true;
  }

  // Envía un CÓDIGO de activación de 6 dígitos al email (registro en un solo flujo).
  async function sendSignupCode(email) {
    const c = await ensureClient();
    const { error } = await c.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
    if (error) throw error;
    return true;
  }
  // Verifica el código de activación; si es correcto, deja la cuenta activada y con sesión.
  async function verifyCode(email, token) {
    const c = await ensureClient();
    const { data, error } = await c.auth.verifyOtp({ email: email, token: token, type: "email" });
    if (error) throw error;
    return data;
  }

  // Envía un email de recuperación de contraseña. El enlace lleva a reset.html,
  // donde la persona pone una clave nueva.
  async function resetPassword(email) {
    const c = await ensureClient();
    const redirectTo = location.origin + "/reset.html";
    const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
    if (error) throw error;
    return true;
  }

  // Edita una publicación existente (título, tipo, precio, descripción, y foto opcional).
  async function updateListing(listingId, fields) {
    const c = await ensureClient();
    const row = { title: fields.title, kind: fields.kind, price: Number(fields.price) || 0, descr: fields.desc || null };
    if (fields.cat !== undefined) row.cat = fields.cat;
    if (fields.img) row.img_url = await uploadPhoto(fields.img, "listings/" + listingId + "-" + Date.now() + ".jpg");
    let { error } = await c.from("listings").update(row).eq("id", listingId);
    if (error && /cat|column|does not exist|schema/i.test(error.message || "")) {
      delete row.cat; ({ error } = await c.from("listings").update(row).eq("id", listingId));
    }
    if (error) throw error;
    return listingId;
  }

  // Elimina una publicación existente.
  async function deleteListing(listingId) {
    const c = await ensureClient();
    const { error } = await c.from("listings").delete().eq("id", listingId);
    if (error) throw error;
    return true;
  }

  // Añade un elemento a la galería (imagen promocional o vídeo educativo) de un perfil ya creado.
  async function addMedia(sellerId, file, isVideo) {
    const c = await ensureClient();
    const id = sellerId + "-m" + Date.now();
    let url;
    if (isVideo) {
      const ext = (file.name && file.name.split(".").pop()) || "mp4";
      url = await uploadFile(file, "media/" + id + "." + ext);
    } else {
      url = await uploadPhoto(file, "media/" + id + ".jpg");
    }
    if (!url) throw new Error("No se pudo subir el archivo.");
    const { error } = await c.from("media").insert({ id: id, seller_id: sellerId, type: isVideo ? "video" : "photo", url: url });
    if (error) throw error;
    return url;
  }

  // guarda el id de la cuenta Stripe conectada de la vendedora (requiere su sesión)
  async function saveStripeAccount(sellerId, acctId) {
    const c = await ensureClient();
    const { error } = await c.from("sellers").update({ stripe_account_id: acctId }).eq("id", sellerId);
    if (error) throw error;
    return acctId;
  }

  // trae UNA vendedora por id (aunque esté pendiente de aprobación) — para que la dueña vea su perfil
  async function fetchSeller(id) {
    if (!id) return null;
    const demo = baseSellers.find(s => s.id === id);
    if (demo) return demo;
    try {
      const c = await ensureClient();
      const { data, error } = await c.from("sellers").select("*, listings(*), media(*)").eq("id", id).maybeSingle();
      if (error || !data) return null;
      return mapSeller(data);
    } catch (e) { return null; }
  }

  // ---- autenticación (logins de vendedoras) con Supabase Auth ----
  async function authUser() { try { const c = await ensureClient(); const { data } = await c.auth.getUser(); return data.user || null; } catch (e) { return null; } }
  async function signUp(email, password) { const c = await ensureClient(); const { data, error } = await c.auth.signUp({ email: email, password: password }); if (error) throw error; return data; }
  async function signIn(email, password) { const c = await ensureClient(); const { data, error } = await c.auth.signInWithPassword({ email: email, password: password }); if (error) throw error; return data; }
  async function signOut() { try { const c = await ensureClient(); await c.auth.signOut(); } catch (e) {} }
  async function myProfile() {
    const u = await authUser(); if (!u) return null;
    try {
      const c = await ensureClient();
      const { data } = await c.from("sellers").select("*, listings(*), media(*)").eq("user_id", u.id).maybeSingle();
      return data ? mapSeller(data) : null;
    } catch (e) { return null; }
  }

  function getSellers() { return _remote.slice(); } // solo vendedoras reales aprobadas (sin ejemplos)
  function getSeller(id) { return getSellers().find(s => s.id === id); }
  function getListings() {
    const out = [];
    getSellers().forEach(s => (s.listings || []).forEach(l => out.push(Object.assign({}, l, { sellerId: s.id, sellerName: s.name, cat: (l.cat || s.cat), loc: s.loc, featured: s.featured, sellerAmbassador: s.ambassador }))));
    return out;
  }
  function getListing(id) { return getListings().find(l => l.id === id); }

  // ---- idioma ----
  function L() { return (window.I18N && window.I18N.lang) || "es"; }
  function tr(key) { return (window.I18N ? window.I18N.t(key) : key); }
  // Devuelve el campo en el idioma activo (usa <campo>En si existe y el idioma es EN)
  function fld(obj, f) { return (L() === "en" && obj[f + "En"]) ? obj[f + "En"] : obj[f]; }
  // Etiquetas traducidas de categoría y tipo
  function catLabel(c) { return tr("cat." + c); }
  // varias categorías separadas por coma -> "Arte · Salud"
  function catsLabel(c) { return String(c || "").split(",").filter(Boolean).map(x => tr("cat." + x.trim())).join(" · "); }
  function catList(c) { return String(c || "").split(",").map(x => x.trim()).filter(Boolean); }
  function kindLabel(k) { return tr("kind." + k); }

  // Precio nativo en la moneda de la vendedora + conversión aproximada a la moneda elegida por quien mira
  function price(n, cur) {
    cur = cur || "EUR";
    const native = fmt(n, cur);
    const disp = displayCurrency();
    if (disp === cur) return native;
    return native + ' <span class="cur-approx">≈ ' + fmt(convert(n, cur, disp), disp) + '</span>';
  }
  // Formato simple (sin conversión) — para totales ya convertidos a una sola moneda
  function priceIn(n, cur) { return fmt(n, cur); }
  function commissionFor(n) { return Math.round(n * COMMISSION * 100) / 100; }

  // ---- checkout (en memoria/local) ----
  function setCheckout(listingId) { localStorage.setItem("alq_checkout", listingId); }
  function getCheckout() { return getListing(localStorage.getItem("alq_checkout")); }

  function payoutConnected() { return localStorage.getItem("alq_payout") === "1"; }
  function setPayoutConnected() { localStorage.setItem("alq_payout", "1"); }

  function param(name) { return new URLSearchParams(location.search).get(name); }

  // ---- perfil del comprador (localStorage, por navegador) ----
  function getBuyer() { try { return JSON.parse(localStorage.getItem("alq_buyer") || "null"); } catch (e) { return null; } }
  function saveBuyer(p) { localStorage.setItem("alq_buyer", JSON.stringify(p)); return p; }
  // ---- lo que apoya el comprador ----
  function getSupportedIds() { try { return JSON.parse(localStorage.getItem("alq_supported") || "[]"); } catch (e) { return []; } }
  function addSupport(id) { const a = getSupportedIds(); if (!a.includes(id)) { a.push(id); localStorage.setItem("alq_supported", JSON.stringify(a)); } }
  function getSupported() { return getSupportedIds().map(id => getListing(id)).filter(Boolean); }

  // ---- carrito de compras (localStorage) ----
  function getCart() { try { return JSON.parse(localStorage.getItem("alq_cart") || "[]"); } catch (e) { return []; } }
  function saveCart(c) { localStorage.setItem("alq_cart", JSON.stringify(c)); }
  function addToCart(id, qty) { const c = getCart(); const it = c.find(x => x.id === id); if (it) it.qty += (qty || 1); else c.push({ id, qty: qty || 1 }); saveCart(c); addSupport(id); return cartCount(); }
  function setQty(id, qty) { const c = getCart(); const it = c.find(x => x.id === id); if (it) { it.qty = Math.max(1, qty); saveCart(c); } }
  function removeFromCart(id) { saveCart(getCart().filter(x => x.id !== id)); }
  function clearCart() { localStorage.removeItem("alq_cart"); }
  function cartCount() { return getCart().reduce((a, b) => a + b.qty, 0); }
  function cartItems() { return getCart().map(x => { const l = getListing(x.id); return l ? Object.assign({}, l, { qty: x.qty, line: l.price * x.qty }) : null; }).filter(Boolean); }

  return {
    COMMISSION, CURRENCY, categories,
    getSellers, getSeller, fetchSeller, getListings, getListing,
    authUser, signUp, signIn, signOut, myProfile,
    saveProfile, updateProfile, changePassword, resetPassword, sendSignupCode, verifyCode, addListing, updateListing, deleteListing, addMedia, lastProfileId, saveStripeAccount, load, adminSellers, setApproved, listDocuments, addDocument, deleteDocument, uploadPhoto, uploadFile,
    L, fld, catLabel, catsLabel, catList, kindLabel,
    price, priceIn, commissionFor,
    CURRENCIES, currencyList, displayCurrency, setDisplayCurrency, convert, refreshRates,
    setCheckout, getCheckout,
    payoutConnected, setPayoutConnected,
    getCart, addToCart, setQty, removeFromCart, clearCart, cartCount, cartItems,
    getBuyer, saveBuyer, getSupported, addSupport,
    param
  };
})();
