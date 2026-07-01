/* Alquimia — Asistente de IA (modelo OPEN SOURCE)
   Una sola función con dos acciones:
     · action:"seller"  -> mejora el título y la descripción de un producto/servicio
     · action:"buyer"   -> recomienda los perfiles/publicaciones que mejor encajan
                            con lo que el cliente busca, explicando por qué.

   Usa un modelo de código abierto (por defecto Llama 3.3 70B vía Groq, que es
   GRATIS y muy rápido). Como habla el formato estándar "OpenAI-compatible",
   puedes cambiar a otro proveedor open source (OpenRouter, Mistral, Together,
   tu propio servidor…) SOLO cambiando variables de entorno, sin tocar el código.

   Variables de entorno (Netlify → Project configuration → Environment variables):
     · AI_API_KEY   (obligatoria) — tu llave del proveedor (p. ej. la de Groq, gratis)
     · AI_BASE_URL  (opcional)    — por defecto https://api.groq.com/openai/v1
     · AI_MODEL     (opcional)    — por defecto llama-3.3-70b-versatile
   La llave NUNCA va en el código.
*/

const BASE = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
const MODEL = process.env.AI_MODEL || "llama-3.3-70b-versatile";

async function call(system, messages, maxTokens, json) {
  const body = {
    model: MODEL,
    max_tokens: maxTokens || 700,
    temperature: 0.6,
    messages: [{ role: "system", content: system }].concat(messages || [])
  };
  if (json) body.response_format = { type: "json_object" };
  const res = await fetch(BASE + "/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + process.env.AI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && (data.error.message || data.error)) || "Error de la IA");
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
}

async function ask(system, user, maxTokens) {
  return call(system, [{ role: "user", content: user }], maxTokens, true);
}

// Extrae el primer objeto JSON de un texto (por si el modelo añade algo alrededor).
function parseJson(text) {
  try { return JSON.parse(text); } catch (e) {}
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch (e) {} }
  return null;
}

function clip(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) : s; }

async function seller(p) {
  const lang = p.lang === "en" ? "en" : "es";
  const sys = lang === "en"
    ? "You are a warm, honest copywriter for Alquimia, a marketplace for conscious entrepreneurs (body, mind, soul, planet, community). Improve the TITLE and DESCRIPTION of a product/service so it is clear, appealing and trustworthy, with a conscious, human, non-hype tone. Do NOT invent facts (price, certifications, results) that are not provided. Keep the title under 60 characters. Description: 2-4 short sentences. Reply with ONLY a valid JSON object, no markdown: {\"title\":\"...\",\"desc\":\"...\"}"
    : "Eres un copywriter cálido y honesto de Alquimia, marketplace de emprendedores conscientes (cuerpo, mente, alma, planeta, comunidad). Mejora el TÍTULO y la DESCRIPCIÓN de un producto/servicio para que sea claro, atractivo y de confianza, con tono consciente, humano y sin exageraciones. NO inventes datos (precio, certificaciones, resultados) que no se den. Título de máximo 60 caracteres. Descripción: 2-4 frases cortas. Responde SOLO con un objeto JSON válido, sin markdown: {\"title\":\"...\",\"desc\":\"...\"}";
  const user = (lang === "en" ? "Type: " : "Tipo: ") + clip(p.kind, 40) + "\n"
    + (lang === "en" ? "Role/craft: " : "Oficio/rol: ") + clip(p.role, 80) + "\n"
    + (lang === "en" ? "Categories: " : "Categorías: ") + clip(p.categories, 120) + "\n"
    + (lang === "en" ? "Draft title: " : "Título borrador: ") + clip(p.title, 200) + "\n"
    + (lang === "en" ? "Draft description: " : "Descripción borrador: ") + clip(p.desc, 1200);
  const out = parseJson(await ask(sys, user, 500));
  if (!out || (!out.title && !out.desc)) throw new Error("La IA no devolvió un resultado válido.");
  return { title: clip(out.title, 120), desc: clip(out.desc, 900) };
}

async function buyer(p) {
  const lang = p.lang === "en" ? "en" : "es";
  const items = Array.isArray(p.items) ? p.items.slice(0, 60) : [];
  if (!items.length) return { message: lang === "en" ? "There are no listings yet to recommend." : "Aún no hay publicaciones para recomendar.", results: [] };
  const list = items.map(function (it) {
    return "- id:" + it.id + " | " + clip(it.title, 90) + " | " + clip(it.cat, 40) + " | " + clip(it.kind, 30) + " | " + clip(it.seller, 60) + " | " + clip(it.desc, 200);
  }).join("\n");
  const sys = lang === "en"
    ? "You are Alquimia's assistant. A client describes what they need; you recommend the 1-4 listings from the LIST that fit best and explain briefly why each one fits. Only use ids that appear in the list. If nothing fits well, say so kindly and suggest browsing. Reply with ONLY a valid JSON object, no markdown: {\"message\":\"one warm sentence\",\"results\":[{\"id\":\"...\",\"reason\":\"why it fits, max 20 words\"}]}"
    : "Eres el asistente de Alquimia. Un cliente describe lo que necesita; recomienda las 1-4 publicaciones de la LISTA que mejor encajen y explica brevemente por qué cada una encaja. Usa solo ids que aparezcan en la lista. Si nada encaja bien, dilo con amabilidad y sugiere explorar. Responde SOLO con un objeto JSON válido, sin markdown: {\"message\":\"una frase cálida\",\"results\":[{\"id\":\"...\",\"reason\":\"por qué encaja, máx 20 palabras\"}]}";
  const user = (lang === "en" ? "Client need: " : "Necesidad del cliente: ") + clip(p.query, 600) + "\n\n" + (lang === "en" ? "LIST:\n" : "LISTA:\n") + list;
  const out = parseJson(await ask(sys, user, 700));
  if (!out) throw new Error("La IA no devolvió un resultado válido.");
  const valid = {}; items.forEach(function (it) { valid[it.id] = true; });
  const results = (out.results || []).filter(function (r) { return r && valid[r.id]; }).slice(0, 4);
  return { message: clip(out.message, 300), results: results };
}

async function coach(p) {
  const lang = p.lang === "en" ? "en" : "es";
  const sys = lang === "en"
    ? "You are a warm personal-brand coach for Alquimia, a marketplace for conscious entrepreneurs (body, mind, soul, planet, community). You help the person create their profile: their name/brand, their craft, their story (bio), why they are a conscious entrepreneur, and what they offer (titles, descriptions, prices). Be encouraging and human, never hype. Ask ONE focused question at a time and build on their answers. When useful, offer a short ready-to-paste draft they can copy into a field (clearly labeled). Also suggest that they upload to their Alquimia gallery the best photos and videos they already share on Instagram or TikTok, so their profile stands out. Keep replies short (2-5 sentences). Plain text, no markdown headers."
    : "Eres un coach cálido de marca personal de Alquimia, marketplace de emprendedores conscientes (cuerpo, mente, alma, planeta, comunidad). Ayudas a la persona a crear su perfil: su nombre/marca, su oficio, su historia (bio), por qué es un emprendedor consciente y lo que ofrece (títulos, descripciones, precios). Eres alentador y humano, sin exageraciones. Haz UNA pregunta concreta cada vez y construye sobre sus respuestas. Cuando sea útil, ofrece un borrador corto listo para pegar en un campo (indícalo claramente). Sugiérele también subir a su galería de Alquimia las mejores fotos y vídeos que ya comparte en Instagram o TikTok, para que su perfil destaque. Respuestas breves (2-5 frases). Texto plano, sin encabezados markdown.";
  const msgs = (p.messages || []).slice(-14)
    .filter(m => m && m.content)
    .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: clip(String(m.content), 2000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") {
    msgs.push({ role: "user", content: lang === "en" ? "Help me get started." : "Ayúdame a empezar." });
  }
  const text = await call(sys, msgs, 500, false);
  return { reply: clip(text, 1500) };
}

async function admin(p) {
  const lang = p.lang === "en" ? "en" : "es";
  const role = (p.role === "ceo" || p.role === "cfo") ? p.role : "both";
  const section = clip(p.section, 40);
  const context = clip(p.context, 2500);
  const question = clip(p.question, 800);
  const roleEs = role === "ceo"
    ? "Respondes con la voz del CEO: visión, estrategia, crecimiento, prioridades, comunidad, posicionamiento."
    : role === "cfo"
      ? "Respondes con la voz del CFO: finanzas, números, márgenes, costos, caja, impuestos, riesgos."
      : "Respondes como un equipo de CEO y CFO: primero la mirada estratégica (CEO) y luego la financiera (CFO), bien diferenciadas.";
  const roleEn = role === "ceo"
    ? "You answer in the CEO's voice: vision, strategy, growth, priorities, community, positioning."
    : role === "cfo"
      ? "You answer in the CFO's voice: finance, numbers, margins, costs, cash, taxes, risk."
      : "You answer as a CEO + CFO team: first the strategic view (CEO), then the financial one (CFO), clearly separated.";
  const sys = lang === "en"
    ? "You are the executive team (CEO + CFO) of Alquimia, a marketplace for conscious entrepreneurs. " + roleEn + " You help Mónica (the founder) read her admin dashboard and, crucially, ORGANIZE information into the right place. Dashboard sections: Resumen, Vendedoras, Ventas, Gastos, Impuestos, Facturación, Marketing. When she gives a piece of info or a question, tell her which section it belongs to and what to do. Be concrete, actionable, honest. You are NOT giving binding legal/tax advice; recommend a professional when relevant. Concise. Plain text, no markdown headers."
    : "Eres el equipo directivo (CEO + CFO) de Alquimia, un marketplace de emprendedores conscientes. " + roleEs + " Ayudas a Mónica (la fundadora) a leer su panel de administración y, sobre todo, a ORGANIZAR la información en el lugar adecuado. Secciones del panel: Resumen, Vendedoras, Ventas, Gastos, Impuestos, Facturación, Marketing. Cuando te dé un dato o una pregunta, dile a qué sección pertenece y qué hacer. Sé concreto, accionable y honesto. NO das asesoría legal/fiscal vinculante; recomienda validar con un profesional cuando aplique. Conciso. Texto plano, sin encabezados markdown.";
  const u = (lang === "en" ? "Current section: " : "Sección actual: ") + (section || "—") + "\n"
    + (lang === "en" ? "Dashboard data:\n" : "Datos del panel:\n") + (context || "—") + "\n\n"
    + (lang === "en" ? "Mónica asks: " : "Mónica pregunta: ") + (question || (lang === "en" ? "What should I focus on?" : "¿En qué debería enfocarme?"));
  const text = await call(sys, [{ role: "user", content: u }], 700, false);
  return { reply: clip(text, 2000) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const headers = { "Content-Type": "application/json" };
  if (!process.env.AI_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Falta configurar AI_API_KEY en Netlify." }) };
  }
  try {
    const p = JSON.parse(event.body || "{}");
    let out;
    if (p.action === "seller") out = await seller(p);
    else if (p.action === "buyer") out = await buyer(p);
    else if (p.action === "coach") out = await coach(p);
    else if (p.action === "admin") out = await admin(p);
    else return { statusCode: 400, headers, body: JSON.stringify({ error: "Acción no válida." }) };
    return { statusCode: 200, headers, body: JSON.stringify(out) };
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: e.message }) };
  }
};
