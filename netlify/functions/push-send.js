/* Alquimia — Envío de notificaciones push.
   Se usa desde el PANEL de administración (admin.html) para:
     · "broadcast": mandar un aviso a todo el mundo o a un tema (noticias, promos…). Requiere TOKEN.
     · "seller-approved": avisar a una vendedora que su perfil ya está publicado. Requiere TOKEN.
     · "event": avisos automáticos a Mónica (nueva vendedora / nueva venta). Sin token, mensaje fijo.

   Variables de entorno en Netlify (Project configuration → Environment variables):
     · VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (obligatorias) — las llaves de notificaciones.
     · VAPID_SUBJECT        (opcional) — por defecto mailto:alquimiaespiritu@gmail.com
     · SUPABASE_URL         (opcional) — por defecto el proyecto de Alquimia.
     · SUPABASE_SERVICE_ROLE_KEY (obligatoria) — para leer las suscripciones (secreta).
     · ADMIN_PUSH_TOKEN     (obligatoria) — clave que autoriza los envíos del panel.
*/
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const SB_URL = process.env.SUPABASE_URL || "https://cxmpypestxedhwymxsdl.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

function sb() { return createClient(SB_URL, SB_KEY, { auth: { persistSession: false } }); }

function vapidReady() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:alquimiaespiritu@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return true;
}

function subObject(row) {
  return { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
}

// Envía a una lista de filas de suscripción; borra las que ya no existen (410/404).
async function sendTo(rows, payloadFor) {
  const client = sb();
  let ok = 0, gone = 0, fail = 0;
  await Promise.all((rows || []).map(async (row) => {
    const payload = typeof payloadFor === "function" ? payloadFor(row) : payloadFor;
    if (!payload) return;
    try {
      await webpush.sendNotification(subObject(row), JSON.stringify(payload));
      ok++;
    } catch (e) {
      const code = e && e.statusCode;
      if (code === 404 || code === 410) {
        gone++;
        try { await client.from("push_subscriptions").delete().eq("endpoint", row.endpoint); } catch (x) {}
      } else { fail++; }
    }
  }));
  return { sent: ok, removed: gone, failed: fail };
}

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  if (!vapidReady()) return { statusCode: 500, headers, body: JSON.stringify({ error: "Faltan las llaves VAPID en Netlify." }) };
  if (!SB_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en Netlify." }) };

  let p;
  try { p = JSON.parse(event.body || "{}"); } catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: "JSON inválido" }) }; }

  const client = sb();
  const ADMIN = process.env.ADMIN_PUSH_TOKEN || "";
  const authed = ADMIN && p.token && p.token === ADMIN;

  try {
    // ---- avisos automáticos a Mónica (sin token, mensaje fijo) ----
    if (p.action === "event") {
      const name = String(p.name || "").slice(0, 80);
      const templates = {
        "new-seller": { title: "Nueva vendedora en Alquimia ✨", body: (name ? name + " " : "Alguien ") + "acaba de registrarse. Revísala para aprobarla.", url: "admin.html" },
        "new-order":  { title: "Nueva venta en Alquimia 🎉", body: "Acaba de entrar un pedido. Míralo en tu panel.", url: "admin.html" }
      };
      const tpl = templates[p.type];
      if (!tpl) return { statusCode: 400, headers, body: JSON.stringify({ error: "Tipo de evento no válido" }) };
      const { data } = await client.from("push_subscriptions").select("*").contains("topics", ["admin"]);
      const res = await sendTo(data || [], Object.assign({ icon: "icons/icon-192.png", tag: p.type }, tpl));
      return { statusCode: 200, headers, body: JSON.stringify(res) };
    }

    // ---- a partir de aquí, todo requiere el token del panel ----
    if (!authed) return { statusCode: 401, headers, body: JSON.stringify({ error: "No autorizado (token incorrecto)." }) };

    if (p.action === "broadcast") {
      const topic = String(p.topic || "general");
      const title = String(p.title || "Alquimia").slice(0, 100);
      const body = String(p.body || "").slice(0, 300);
      const url = String(p.url || "index.html").slice(0, 300);
      let q = client.from("push_subscriptions").select("*");
      if (topic !== "all") q = q.contains("topics", [topic]);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const res = await sendTo(data || [], { title, body, url, icon: "icons/icon-192.png", tag: "broadcast-" + topic });
      return { statusCode: 200, headers, body: JSON.stringify(res) };
    }

    if (p.action === "seller-approved") {
      const sellerId = String(p.sellerId || "");
      if (!sellerId) return { statusCode: 400, headers, body: JSON.stringify({ error: "Falta sellerId" }) };
      const title = String(p.title || "¡Tu perfil ya está en Alquimia! ✨").slice(0, 100);
      const body = String(p.body || "Tu perfil fue aprobado y ya es visible para toda la comunidad.").slice(0, 300);
      const url = String(p.url || ("profile.html?id=" + sellerId)).slice(0, 300);
      const { data, error } = await client.from("push_subscriptions").select("*").eq("seller_id", sellerId);
      if (error) throw new Error(error.message);
      const res = await sendTo(data || [], { title, body, url, icon: "icons/icon-192.png", tag: "approved" });
      return { statusCode: 200, headers, body: JSON.stringify(res) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Acción no válida" }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
