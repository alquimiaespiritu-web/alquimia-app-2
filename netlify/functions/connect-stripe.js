/* Alquimia — Fase 1 de pagos
   Crea (o reutiliza) una cuenta Stripe Express para una vendedora y devuelve
   el enlace de onboarding de Stripe para que ella complete sus datos.

   No usa librerías: llama directo a la API REST de Stripe con fetch, así
   funciona aunque el sitio se suba a Netlify arrastrando la carpeta (sin build).

   La clave SECRETA de Stripe NUNCA va en el código: se lee de la variable de
   entorno STRIPE_SECRET_KEY, que se configura en Netlify (Project configuration
   → Environment variables). Usa la de prueba (sk_test_...) hasta pasar a real.
*/

const STRIPE = "https://api.stripe.com/v1";

// Convierte un objeto (con anidados) al formato form-urlencoded que pide Stripe:
// { capabilities: { transfers: { requested: true } } } -> capabilities[transfers][requested]=true
function toForm(obj, prefix, out) {
  out = out || new URLSearchParams();
  for (const k in obj) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    const key = prefix ? prefix + "[" + k + "]" : k;
    if (typeof v === "object" && !Array.isArray(v)) toForm(v, key, out);
    else out.append(key, v);
  }
  return out;
}

async function stripe(path, body) {
  const res = await fetch(STRIPE + path, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.STRIPE_SECRET_KEY,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: toForm(body).toString()
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || "Error de Stripe");
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Falta configurar STRIPE_SECRET_KEY en Netlify." }) };
  }
  try {
    const { accountId, email, country, returnUrl, refreshUrl } = JSON.parse(event.body || "{}");

    // 1) Si la vendedora aún no tiene cuenta conectada, se la creamos (Express).
    let acct = accountId;
    if (!acct) {
      const account = await stripe("/accounts", {
        type: "express",
        email: email || undefined,
        country: country || "NL",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        }
      });
      acct = account.id;
    }

    // 2) Generamos el enlace de onboarding (Stripe aloja el formulario).
    const link = await stripe("/account_links", {
      account: acct,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding"
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: acct, url: link.url })
    };
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message })
    };
  }
};
