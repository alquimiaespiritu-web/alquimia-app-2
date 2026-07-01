/* Alquimia — Aviso de "Me interesa" (lead) a la vendedora por correo.
   Lo usa el botón "Me interesa" cuando la vendedora eligió el canal "email".
   Recibe { sellerId, buyerName, buyerContact, message, listingTitle, lang },
   busca el correo de la vendedora en Supabase (para NO exponerlo en el navegador)
   y le envía un email con los datos del interesado, vía Resend.

   Variables de entorno (Netlify):
     · RESEND_API_KEY (obligatoria)
     · RESEND_FROM    (opcional) — por defecto "Alquimia <onboarding@resend.dev>"
*/

const SB_URL = "https://cxmpypestxedhwymxsdl.supabase.co";
const SB_KEY = "sb_publishable_yCJOMWSvHdNlCk1EWk_MbA_WWqMBQcp";
const FROM = process.env.RESEND_FROM || "Alquimia <onboarding@resend.dev>";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

async function getSeller(id) {
  const url = SB_URL + "/rest/v1/sellers?id=eq." + encodeURIComponent(id) + "&select=email,name";
  const res = await fetch(url, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!process.env.RESEND_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: "Falta configurar RESEND_API_KEY en Netlify." }) };

  let d = {};
  try { d = JSON.parse(event.body || "{}"); } catch (e) {}
  if (!d.sellerId || !d.buyerName || !d.buyerContact) return { statusCode: 400, body: JSON.stringify({ error: "Faltan datos del interesado." }) };

  let seller;
  try { seller = await getSeller(d.sellerId); } catch (e) { return { statusCode: 502, body: JSON.stringify({ error: "No se pudo localizar a la vendedora." }) }; }
  if (!seller || !seller.email) return { statusCode: 404, body: JSON.stringify({ error: "La vendedora no tiene correo configurado." }) };

  const isEn = d.lang === "en";
  const subject = isEn ? "✨ Someone is interested in your offer on Alquimia"
                       : "✨ Alguien está interesado en tu oferta en Alquimia";
  const line = (k, v) => `<p style="margin:0 0 8px"><strong>${k}:</strong> ${esc(v)}</p>`;
  const intro = isEn
    ? `Good news, ${esc(seller.name || "")}! Someone just showed interest through your Alquimia profile. Here are their details so you can get in touch:`
    : `¡Buenas noticias, ${esc(seller.name || "")}! Alguien mostró interés a través de tu perfil en Alquimia. Aquí tienes sus datos para que le escribas:`;
  const tail = isEn
    ? `Tip: reply soon — fast responses close more sales. 🜔🜁☉🜃🜄`
    : `Consejo: responde pronto — las respuestas rápidas cierran más ventas. 🜔🜁☉🜃🜄`;

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#2a1430;padding:24px 0;font-family:Georgia,serif;color:#3a2a1a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ECE3CF;border-radius:16px;overflow:hidden">
        <tr><td style="background:#4B244A;padding:26px 32px;text-align:center">
          <div style="color:#C6A15B;font-size:24px;letter-spacing:6px;font-weight:bold">ALQUIMIA</div>
          <div style="color:#ECE3CF;font-size:12px;letter-spacing:2px;opacity:.85;margin-top:4px">${isEn ? "A NEW LEAD" : "UN NUEVO INTERESADO"}</div>
        </td></tr>
        <tr><td style="padding:28px 32px;font-size:15.5px;line-height:1.6">
          <p style="margin:0 0 16px">${intro}</p>
          <div style="background:#fff;border:1px solid #d8cbb0;border-radius:10px;padding:14px 16px;margin:0 0 16px">
            ${line(isEn ? "Name" : "Nombre", d.buyerName)}
            ${line(isEn ? "Contact" : "Contacto", d.buyerContact)}
            ${d.listingTitle ? line(isEn ? "Interested in" : "Le interesa", d.listingTitle) : ""}
            ${d.message ? line(isEn ? "Message" : "Mensaje", d.message) : ""}
          </div>
          <p style="margin:0;color:#6a5a48;font-size:13.5px">${tail}</p>
        </td></tr>
        <tr><td style="background:#4B244A;padding:16px 32px;text-align:center">
          <a href="https://alquimiasoy.com" style="color:#C6A15B;text-decoration:none;font-size:13px;letter-spacing:1px">alquimiasoy.com</a>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [seller.email], reply_to: d.buyerContact, subject: subject, html: html })
    });
    const out = await res.json();
    if (!res.ok) return { statusCode: 502, body: JSON.stringify({ error: (out && (out.message || out.name)) || "Error de Resend" }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true, id: out.id || null }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
