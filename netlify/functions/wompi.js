/* Alquimia — Pagos con Wompi (Colombia)
   ----------------------------------------------------------------------------
   Esta función es el "motor" seguro del cobro con Wompi. Maneja los SECRETOS
   (que NUNCA van en el navegador) y hace tres cosas:

     · action:"create"  -> genera la referencia única + la FIRMA DE INTEGRIDAD
                           para abrir el Checkout Web de Wompi (cobro real).
     · action:"status"  -> consulta el estado de una transacción tras el pago
                           (cuando Wompi devuelve al cliente a la web).
     · webhook (evento) -> cuando Wompi POSTea un evento "transaction.updated",
                           verifica la firma (checksum) y deja la venta lista
                           para dispersar el 90% a la vendedora.

   Wompi SOLO cobra en COP (pesos colombianos). Para Europa usaremos Stripe
   Connect en una función aparte.

   Variables de entorno (Netlify → Project configuration → Environment variables):
     · WOMPI_PUBLIC_KEY      (obligatoria) pub_test_... (sandbox) o pub_prod_... (real)
     · WOMPI_INTEGRITY_SECRET(obligatoria) el "secreto de integridad" del dashboard
     · WOMPI_EVENTS_SECRET   (para el webhook) el "secreto de eventos" del dashboard
     · WOMPI_BASE_URL        (opcional) por defecto se deduce de la llave:
                              pub_test_ -> https://sandbox.wompi.co/v1
                              pub_prod_ -> https://production.wompi.co/v1
   Las llaves NUNCA van en el código.
*/

const crypto = require("crypto");

const PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || "";
const INTEGRITY = process.env.WOMPI_INTEGRITY_SECRET || "";
const EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || "";

function apiBase() {
  if (process.env.WOMPI_BASE_URL) return process.env.WOMPI_BASE_URL.replace(/\/$/, "");
  return PUBLIC_KEY.indexOf("pub_prod_") === 0
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

// Referencia única para cada compra (no se puede repetir en Wompi).
function makeReference() {
  return "ALQ-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex");
}

// Lee un valor anidado tipo "transaction.status" desde el objeto data del evento.
function dig(obj, path) {
  return path.split(".").reduce(function (o, k) { return (o == null ? undefined : o[k]); }, obj);
}

const J = { "Content-Type": "application/json" };

// ---- 1) CREAR: referencia + firma de integridad para abrir el checkout ----
function create(p) {
  if (!PUBLIC_KEY || !INTEGRITY) {
    return { _status: 503, body: { error: "Wompi aún no está configurado (faltan WOMPI_PUBLIC_KEY / WOMPI_INTEGRITY_SECRET)." } };
  }
  const currency = "COP"; // Wompi solo cobra en COP
  const amountInCents = Math.round(Number(p.amountInCents) || 0);
  if (!amountInCents || amountInCents < 100) {
    return { _status: 400, body: { error: "Monto inválido." } };
  }
  const reference = (p.reference && String(p.reference).slice(0, 60)) || makeReference();
  const expiration = p.expirationTime ? String(p.expirationTime) : "";
  // El ORDEN importa: reference + amount + currency + (expiration?) + integritySecret
  const concat = reference + amountInCents + currency + expiration + INTEGRITY;
  const signature = sha256(concat);
  return {
    _status: 200,
    body: {
      publicKey: PUBLIC_KEY,
      currency: currency,
      amountInCents: amountInCents,
      reference: reference,
      signature: signature,
      expirationTime: expiration || undefined,
      // URL del Checkout Web de Wompi (el front arma el formulario/redirección)
      checkoutUrl: "https://checkout.wompi.co/p/"
    }
  };
}

// ---- 2) ESTADO: consultar una transacción tras el pago ----
async function status(p) {
  const id = String(p.transactionId || p.id || "").trim();
  if (!id) return { _status: 400, body: { error: "Falta el id de la transacción." } };
  const res = await fetch(apiBase() + "/transactions/" + encodeURIComponent(id));
  const data = await res.json();
  if (!res.ok) return { _status: 400, body: { error: "No se pudo consultar la transacción." } };
  const t = (data && data.data) || {};
  return {
    _status: 200,
    body: {
      id: t.id,
      status: t.status,                 // APPROVED | DECLINED | VOIDED | ERROR | PENDING
      reference: t.reference,
      amountInCents: t.amount_in_cents,
      currency: t.currency,
      paymentMethod: t.payment_method_type,
      customerEmail: t.customer_email
    }
  };
}

// ---- 3) WEBHOOK: verificar la firma del evento de Wompi ----
// Wompi concatena los valores de signature.properties (en orden) + timestamp +
// el secreto de eventos, y manda el SHA256 en signature.checksum.
function verifyEvent(body) {
  if (!EVENTS_SECRET) return { ok: false, reason: "Falta WOMPI_EVENTS_SECRET" };
  const sig = body && body.signature;
  if (!sig || !Array.isArray(sig.properties) || !sig.checksum) return { ok: false, reason: "Evento sin firma" };
  let concat = "";
  for (const prop of sig.properties) {
    const v = dig(body.data, prop);
    if (v === undefined || v === null) return { ok: false, reason: "Propiedad firmada ausente: " + prop };
    concat += String(v);
  }
  concat += String(body.timestamp != null ? body.timestamp : "");
  concat += EVENTS_SECRET;
  const expected = sha256(concat);
  const ok = expected.toLowerCase() === String(sig.checksum).toLowerCase();
  return { ok: ok, reason: ok ? "" : "Checksum no coincide" };
}

async function handleEvent(body) {
  const v = verifyEvent(body);
  // Respondemos 200 SIEMPRE para que Wompi no reintente en bucle; solo actuamos
  // si la firma es válida.
  if (!v.ok) {
    console.warn("Wompi webhook rechazado:", v.reason);
    return { _status: 200, body: { received: true, valid: false } };
  }
  const t = (body.data && body.data.transaction) || {};
  if (body.event === "transaction.updated" && t.status === "APPROVED") {
    // TODO (siguiente paso): registrar la venta en Supabase y dejar pendiente
    // la dispersión del 90% a la vendedora (Pagos a Terceros).
    console.log("Venta aprobada Wompi:", t.reference, t.amount_in_cents, t.customer_email);
  }
  return { _status: 200, body: { received: true, valid: true } };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: J, body: JSON.stringify({ error: "Method not allowed" }) };
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { return { statusCode: 400, headers: J, body: JSON.stringify({ error: "JSON inválido" }) }; }

  try {
    // Si el cuerpo trae "event" + "signature", es un webhook de Wompi.
    if (body.event && body.signature) {
      const r = await handleEvent(body);
      return { statusCode: r._status, headers: J, body: JSON.stringify(r.body) };
    }
    let r;
    if (body.action === "create") r = create(body);
    else if (body.action === "status") r = await status(body);
    else return { statusCode: 400, headers: J, body: JSON.stringify({ error: "Acción no válida." }) };
    return { statusCode: r._status, headers: J, body: JSON.stringify(r.body) };
  } catch (e) {
    return { statusCode: 400, headers: J, body: JSON.stringify({ error: e.message }) };
  }
};
