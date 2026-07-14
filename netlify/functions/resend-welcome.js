/* Alquimia — Bienvenidas automáticas por Resend.
   Dos flujos:
     type "suscriptora" → al registrarse una compradora. payload: { email, name, intereses }
     type "aliada"      → al aprobar YO a una vendedora.   payload: { email, name, producto, instagram }

   Qué hace:
   1) Crea/actualiza el contacto en Resend (POST /contacts) con propiedades:
        perfil ("suscriptora"/"aliada") + intereses  (o)  producto + instagram.
   2) Envía la bienvenida (POST /emails):
        · Si hay plantilla publicada configurada (RESEND_TPL_SUSCRIPTORA / RESEND_TPL_ALIADA)
          → la envía con variables (INTERESES  o  PRODUCTO + INSTAGRAM).
        · Si no, envía un HTML de respaldo personalizado (para que SIEMPRE llegue el correo).

   Variables de entorno (Netlify → Environment variables):
     · RESEND_API_KEY          (obligatoria) — nunca va en el frontend.
     · RESEND_FROM             (opcional)    — por defecto "ALQUIMIA <hola@alquimiasoy.com>".
     · RESEND_TPL_SUSCRIPTORA  (opcional)    — ID de la plantilla publicada de la suscriptora.
     · RESEND_TPL_ALIADA       (opcional)    — ID de la plantilla publicada de la aliada.

   Se llama fire-and-forget desde la web: si Resend falla, el registro/aprobación igual se completa. */

const API = "https://api.resend.com";
const FROM = process.env.RESEND_FROM || "ALQUIMIA <hola@alquimiasoy.com>";

function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function firstName(name) { return String(name || "").trim().split(" ")[0] || ""; }

async function api(path, body, method) {
  const res = await fetch(API + path, {
    method: method || "POST",
    headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  let out = {}; try { out = await res.json(); } catch (e) {}
  return { ok: res.ok, status: res.status, out: out };
}

// Crea el contacto; si ya existe, lo actualiza por email.
async function upsertContact(email, name, properties) {
  const fn = firstName(name);
  let r = await api("/contacts", { email: email, first_name: fn, unsubscribed: false, properties: properties });
  if (!r.ok) r = await api("/contacts/" + encodeURIComponent(email), { first_name: fn, properties: properties }, "PATCH");
  return r;
}

function shell(bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#2a1430;padding:24px 0;font-family:Georgia,'Times New Roman',serif;color:#3a2a1a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ECE3CF;border-radius:16px;overflow:hidden">
        <tr><td style="background:#4B244A;padding:28px 32px;text-align:center">
          <div style="color:#C6A15B;font-size:24px;letter-spacing:6px;font-weight:bold">ALQUIMIA</div>
          <div style="color:#ECE3CF;font-size:12px;letter-spacing:2px;opacity:.85;margin-top:4px">DONDE EL PROPÓSITO SE VUELVE ORO</div>
        </td></tr>
        <tr><td style="padding:30px 32px;font-size:15.5px;line-height:1.6">${bodyHtml}</td></tr>
        <tr><td style="background:#4B244A;padding:18px 32px;text-align:center"><a href="https://alquimiasoy.com" style="color:#C6A15B;text-decoration:none;font-size:13px;letter-spacing:1px">alquimiasoy.com</a></td></tr>
      </table>
    </td></tr></table></body></html>`;
}

function buildSuscriptora(name, intereses) {
  const hi = esc(firstName(name) || "hola");
  const int = esc(intereses || "");
  const body = `
    <p style="margin:0 0 16px">Hola ${hi},</p>
    <p style="margin:0 0 16px">¡Qué alegría tenerte en <strong>Alquimia</strong>! 🌿 Ya eres parte de una comunidad que cuida el cuerpo, la mente, el alma y el planeta — y apoya a negocios con propósito.</p>
    ${int ? `<p style="margin:0 0 16px">Vimos que te interesa: <strong>${int}</strong>. Te iremos mostrando lo mejor de esos temas.</p>` : ""}
    <p style="margin:0 0 16px">Cada día publicamos una <strong>reflexión</strong> y curamos negocios conscientes para ti. Pásate cuando quieras: <a href="https://alquimiasoy.com" style="color:#8E5BB0">alquimiasoy.com</a>.</p>
    <p style="margin:0 0 20px;font-size:18px;letter-spacing:3px">🜔 🜁 ☉ 🜃 🜄</p>
    <p style="margin:0">Con cariño,<br><strong>El equipo de Alquimia</strong></p>`;
  return { subject: "Bienvenida a Alquimia ✨", html: shell(body) };
}

function buildAliada(name, producto, instagram) {
  const hi = esc(firstName(name) || "hola");
  const prod = esc(producto || ""); const ig = esc(instagram || "");
  const body = `
    <p style="margin:0 0 16px">Hola ${hi},</p>
    <p style="margin:0 0 16px">¡Felicidades! 🎉 Tu perfil en <strong>Alquimia</strong> fue <strong>aprobado</strong>. Ya eres parte de nuestra comunidad curada de emprendedoras y emprendedores con propósito.</p>
    ${prod ? `<p style="margin:0 0 16px">Tu oferta — <strong>${prod}</strong> — ya puede brillar ante clientes alineados con tus valores.</p>` : ""}
    ${ig ? `<p style="margin:0 0 16px">Te seguiremos en <strong>${ig}</strong> para amplificar tu voz. 💛</p>` : ""}
    <p style="margin:0 0 16px">Entra a tu panel, sube tus mejores fotos y cuenta tu historia: <a href="https://alquimiasoy.com/dashboard.html" style="color:#8E5BB0">tu panel en Alquimia</a>.</p>
    <p style="margin:0 0 20px;font-size:18px;letter-spacing:3px">🜔 🜁 ☉ 🜃 🜄</p>
    <p style="margin:0">Con cariño,<br><strong>El equipo de Alquimia</strong></p>`;
  return { subject: "¡Tu perfil en Alquimia fue aprobado! ✨", html: shell(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!process.env.RESEND_API_KEY) return { statusCode: 200, body: JSON.stringify({ skipped: "Falta RESEND_API_KEY" }) };

  let d = {}; try { d = JSON.parse(event.body || "{}"); } catch (e) {}
  const type = d.type === "aliada" ? "aliada" : "suscriptora";
  const email = (d.email || "").trim();
  if (!email) return { statusCode: 400, body: JSON.stringify({ error: "Falta el email." }) };
  const name = d.name || "";

  // 1) Contacto (best-effort; no rompe si falla).
  const props = type === "aliada"
    ? { perfil: "aliada", producto: d.producto || "", instagram: d.instagram || "" }
    : { perfil: "suscriptora", intereses: d.intereses || "" };
  try { await upsertContact(email, name, props); } catch (e) {}

  // 2) Envío de la bienvenida usando las plantillas publicadas de Resend (IDs por defecto,
  //    se pueden sobrescribir con env vars). FIRST_NAME lo resuelve Resend desde el contacto.
  const tpl = type === "aliada"
    ? (process.env.RESEND_TPL_ALIADA || "88da14cf-21f0-487c-8eef-bd29d41b8df6")
    : (process.env.RESEND_TPL_SUSCRIPTORA || "25da5b87-3385-4cd9-9c8a-90de9b64def3");
  const variables = type === "aliada"
    ? { PRODUCTO: d.producto || "", INSTAGRAM: d.instagram || "" }
    : { INTERESES: d.intereses || "" };

  try {
    // Intento con la plantilla publicada.
    let r = await api("/emails", { from: FROM, to: [email], template: tpl, variables: variables });
    let mode = "template";
    // Respaldo: si la plantilla falla por lo que sea, enviamos un HTML propio para que SIEMPRE llegue.
    if (!r.ok) {
      const built = type === "aliada" ? buildAliada(name, d.producto, d.instagram) : buildSuscriptora(name, d.intereses);
      r = await api("/emails", { from: FROM, to: [email], subject: built.subject, html: built.html });
      mode = "html-fallback";
    }
    if (!r.ok) return { statusCode: 502, body: JSON.stringify({ error: (r.out && (r.out.message || r.out.name)) || "Error de Resend", detail: r.out }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true, id: r.out.id || null, mode: mode }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
