/* Alquimia — Conexión con Resend + disparo de eventos (triggers).

   Dos flujos:
     type "suscriptora" → al registrarse una compradora.  payload evento: { intereses }
     type "aliada"      → al aprobar YO a una vendedora.   payload evento: { producto, instagram }

   Qué hace (SOLO conexión + trigger; el ENVÍO lo hacen tus automatizaciones de Resend):
   1) CONEXIÓN: crea/actualiza el contacto en Resend (POST /contacts) con first_name + propiedades
      (perfil + intereses  o  producto + instagram). Así la plantilla resuelve {{{FIRST_NAME}}}.
   2) TRIGGER: dispara el evento (POST /events/send) con su payload. La automatización montada
      en Resend (suscriptora.bienvenida / aliada.aprobada) envía la plantilla publicada.

   Env: RESEND_API_KEY (obligatoria) — nunca va en el frontend.
   Fire-and-forget desde la web: si Resend falla, el registro/aprobación igual se completa. */

const API = "https://api.resend.com";

async function api(path, body, method) {
  const res = await fetch(API + path, {
    method: method || "POST",
    headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  let out = {}; try { out = await res.json(); } catch (e) {}
  return { ok: res.ok, status: res.status, out: out };
}

function firstName(name) { return String(name || "").trim().split(" ")[0] || ""; }

// CONEXIÓN: crea el contacto; si ya existe, lo actualiza por email.
async function upsertContact(email, name, properties) {
  const fn = firstName(name);
  let r = await api("/contacts", { email: email, first_name: fn, unsubscribed: false, properties: properties });
  if (!r.ok) r = await api("/contacts/" + encodeURIComponent(email), { first_name: fn, properties: properties }, "PATCH");
  return r;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!process.env.RESEND_API_KEY) return { statusCode: 200, body: JSON.stringify({ skipped: "Falta RESEND_API_KEY" }) };

  let d = {}; try { d = JSON.parse(event.body || "{}"); } catch (e) {}
  const type = d.type === "aliada" ? "aliada" : "suscriptora";
  const email = (d.email || "").trim();
  if (!email) return { statusCode: 400, body: JSON.stringify({ error: "Falta el email." }) };

  const props = type === "aliada"
    ? { perfil: "aliada", producto: d.producto || "", instagram: d.instagram || "" }
    : { perfil: "suscriptora", intereses: d.intereses || "" };
  const evName = type === "aliada" ? "aliada.aprobada" : "suscriptora.bienvenida";
  const payload = type === "aliada"
    ? { producto: d.producto || "", instagram: d.instagram || "" }
    : { intereses: d.intereses || "" };

  try {
    // 1) CONEXIÓN: sincroniza el contacto (nombre + propiedades).
    try { await upsertContact(email, d.name, props); } catch (e) {}
    // 2) TRIGGER: dispara el evento → tu automatización de Resend envía la plantilla.
    const r = await api("/events/send", { event: evName, email: email, payload: payload });
    if (!r.ok) return { statusCode: 502, body: JSON.stringify({ error: (r.out && (r.out.message || r.out.name)) || "Error de Resend", detail: r.out }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true, event: evName }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
