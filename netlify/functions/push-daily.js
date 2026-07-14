/* Alquimia — Envío DIARIO del Reto de Autoconocimiento.
   Es una función PROGRAMADA (se ejecuta sola cada día, ver la hora en netlify.toml).
   A cada persona apuntada al reto le manda la reflexión y la pregunta del día que le
   toca según CUÁNDO se apuntó (día 1, día 2, … hasta el 21).

   Usa las mismas variables de entorno que push-send.js (VAPID_* y SUPABASE_SERVICE_ROLE_KEY). */
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");
const RETO = require("../../assets/reto.js");

const SB_URL = process.env.SUPABASE_URL || "https://cxmpypestxedhwymxsdl.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

function dayIndex(startISO, todayISO) {
  const a = new Date(startISO + "T00:00:00Z").getTime();
  const b = new Date(todayISO + "T00:00:00Z").getTime();
  return Math.floor((b - a) / 86400000);
}

function payloadForDay(day, lang) {
  const L = (lang === "en" || lang === "nl") ? "en" : "es";
  const pilar = day.pilar;
  const total = RETO.days.length;
  const title = (L === "en" ? "Challenge · Day " : "Reto · Día ") + day.d + "/" + total + " — " + (day.title[L] || day.title.es);
  const refl = day.r[L] || day.r.es;
  const preg = day.q[L] || day.q.es;
  const body = day.sym + " " + refl + "\n\n" + (L === "en" ? "🤔 " : "🤔 ") + preg;
  return { title: title, body: body, url: "reto.html", icon: "icons/icon-192.png", tag: "reto-dia-" + day.d, lang: L };
}

exports.handler = async () => {
  const headers = { "Content-Type": "application/json" };
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Faltan llaves VAPID" }) };
  }
  if (!SB_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }) };
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:alquimiaespiritu@gmail.com",
    process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY
  );
  const client = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await client.from("push_subscriptions").select("*").contains("topics", ["reto"]).not("reto_start", "is", null);
  if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };

  let sent = 0, done = 0, removed = 0;
  await Promise.all((data || []).map(async (row) => {
    const idx = dayIndex(String(row.reto_start).slice(0, 10), today);
    if (idx < 0 || idx >= RETO.days.length) { done++; return; } // aún no empieza o ya terminó
    const payload = payloadForDay(RETO.days[idx], row.lang || "es");
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(payload));
      sent++;
    } catch (e) {
      const code = e && e.statusCode;
      if (code === 404 || code === 410) { removed++; try { await client.from("push_subscriptions").delete().eq("endpoint", row.endpoint); } catch (x) {} }
    }
  }));
  return { statusCode: 200, headers, body: JSON.stringify({ day: today, sent: sent, finished: done, removed: removed }) };
};
