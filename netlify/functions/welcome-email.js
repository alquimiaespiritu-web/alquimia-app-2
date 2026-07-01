/* Alquimia — Correo de bienvenida a la vendedora
   Se dispara automáticamente al terminar el registro. Envía un email cálido
   diciéndole que ya está registrada y que su perfil está EN ESPERA DE APROBACIÓN
   (curación de la comunidad). Bilingüe ES/EN según el idioma con el que se registró.

   Usa Resend (https://resend.com) — gratis hasta 3.000 emails/mes.
   Variables de entorno (Netlify → Project configuration → Environment variables):
     · RESEND_API_KEY  (obligatoria) — tu llave de Resend. NUNCA va en el código.
     · RESEND_FROM     (opcional)    — remitente. Por defecto "Alquimia <onboarding@resend.dev>"
                                       (el de pruebas de Resend). Cuando verifiques el dominio
                                       alquimiasoy.com en Resend, ponlo a "Alquimia <hola@alquimiasoy.com>".
*/

const FROM = process.env.RESEND_FROM || "Alquimia <onboarding@resend.dev>";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function buildEmail(name, lang) {
  const isEn = lang === "en";
  const hi = esc(name || (isEn ? "there" : "hola"));
  const subject = isEn
    ? "Welcome to Alquimia ✨ your profile is on its way"
    : "Bienvenida a Alquimia ✨ tu perfil ya está en camino";

  const body = isEn ? `
    <p style="margin:0 0 16px">Hi ${hi},</p>
    <p style="margin:0 0 16px">We're so happy you're here! You've just joined <strong>Alquimia</strong>, the community of entrepreneurs with purpose.</p>
    <p style="margin:0 0 16px">Your profile is created and now goes through a <strong>quick review</strong>. We want to make sure everyone who joins shares the essence of Alquimia: building with awareness to care for the body, mind, soul, planet and community. It's not an exam — it's how we protect the community, so that when you come in you're surrounded by people who share your spark.</p>
    <p style="margin:0 0 16px">We'll write to you as soon as your profile is <strong>approved</strong> (usually within 1–3 days). In the meantime, start gathering your best photos and the story of what you do: you'll shine brighter.</p>
    <p style="margin:0 0 8px">Thank you for bringing your purpose to Alquimia. This is just the beginning.</p>
    <p style="margin:0 0 20px;font-size:18px;letter-spacing:3px">🜔 🜁 ☉ 🜃 🜄</p>
    <p style="margin:0">With love,<br><strong>The Alquimia team</strong></p>`
  : `
    <p style="margin:0 0 16px">Hola ${hi},</p>
    <p style="margin:0 0 16px">¡Qué alegría tenerte aquí! Acabas de registrarte en <strong>Alquimia</strong>, la comunidad de emprendedoras y emprendedores con propósito.</p>
    <p style="margin:0 0 16px">Tu perfil ya está creado y ahora pasa por una <strong>pequeña revisión</strong>. Queremos asegurarnos de que cada persona que entra comparte la esencia de Alquimia: emprender con conciencia para cuidar el cuerpo, la mente, el alma, el planeta y la comunidad. No es un examen — es nuestra forma de cuidar la comunidad, para que cuando entres estés rodeada de gente que vibra como tú.</p>
    <p style="margin:0 0 16px">Te escribiremos en cuanto tu perfil esté <strong>aprobado</strong> (suele ser cuestión de 1–3 días). Mientras tanto, ve preparando tus mejores fotos y la historia de lo que haces: brillarás más.</p>
    <p style="margin:0 0 8px">Gracias por traer tu propósito a Alquimia. Esto apenas empieza.</p>
    <p style="margin:0 0 20px;font-size:18px;letter-spacing:3px">🜔 🜁 ☉ 🜃 🜄</p>
    <p style="margin:0">Con cariño,<br><strong>El equipo de Alquimia</strong></p>`;

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#2a1430;padding:24px 0;font-family:Georgia,'Times New Roman',serif;color:#3a2a1a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ECE3CF;border-radius:16px;overflow:hidden">
        <tr><td style="background:#4B244A;padding:28px 32px;text-align:center">
          <div style="color:#C6A15B;font-size:24px;letter-spacing:6px;font-weight:bold">ALQUIMIA</div>
          <div style="color:#ECE3CF;font-size:12px;letter-spacing:2px;opacity:.85;margin-top:4px">${isEn ? "BUSINESS WITH PURPOSE" : "EMPRENDER CON PROPÓSITO"}</div>
        </td></tr>
        <tr><td style="padding:30px 32px;font-size:15.5px;line-height:1.6">${body}</td></tr>
        <tr><td style="background:#4B244A;padding:18px 32px;text-align:center">
          <a href="https://alquimiasoy.com" style="color:#C6A15B;text-decoration:none;font-size:13px;letter-spacing:1px">alquimiasoy.com</a>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  return { subject, html };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!process.env.RESEND_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Falta configurar RESEND_API_KEY en Netlify." }) };
  }
  let data = {};
  try { data = JSON.parse(event.body || "{}"); } catch (e) {}
  const to = (data.email || "").trim();
  if (!to) return { statusCode: 400, body: JSON.stringify({ error: "Falta el email de destino." }) };

  const { subject, html } = buildEmail(data.name, data.lang === "en" ? "en" : "es");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: subject, html: html })
    });
    const out = await res.json();
    if (!res.ok) return { statusCode: 502, body: JSON.stringify({ error: (out && (out.message || out.name)) || "Error de Resend" }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true, id: out.id || null }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
