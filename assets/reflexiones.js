/* Alquimia — Reflexión del día.
   Rota sola cada día (según la fecha). Cada reflexión: pilar + frase + pregunta.
   El marco (título, "Para hoy", botón) se traduce con i18n; la frase va en español (voz de marca). */
(function () {
  var R = [
    { p: "Cuerpo",  sym: "🜔", r: "Tu cuerpo no es un proyecto que arreglar. Es una casa que habitar.", q: "¿Cómo puedes habitar tu cuerpo hoy con un poco más de ternura?" },
    { p: "Mente",   sym: "🜁", r: "Descansar no es rendirse. Es darle a tu mente el silencio donde nacen las ideas.", q: "¿Qué pensamiento sueltas hoy para hacer espacio?" },
    { p: "Alma",    sym: "☉", r: "El propósito no grita. Susurra en lo que haces cuando nadie te ve.", q: "¿Qué haces que te hace perder la noción del tiempo?" },
    { p: "Planeta", sym: "🜃", r: "Cuidar el planeta empieza en lo pequeño: lo que compras y a quién se lo compras.", q: "¿Una elección consciente que puedas hacer hoy?" },
    { p: "Cuerpo",  sym: "🜔", r: "Beber agua, moverte, dormir. Lo aburrido es lo que sostiene todo lo demás.", q: "¿Cuál de las tres tienes olvidada?" },
    { p: "Mente",   sym: "🜁", r: "No necesitas tener todas las respuestas para dar el primer paso.", q: "¿Qué paso pequeño puedes dar hoy, aunque no lo veas todo claro?" },
    { p: "Alma",    sym: "☉", r: "Vivir de tu propósito no es un lujo. Es una decisión que se toma muchas veces.", q: "¿Qué decides hoy a favor de tu propósito?" },
    { p: "Planeta", sym: "🜃", r: "Consumir con sentido es votar por el mundo que quieres.", q: "¿A qué negocio con alma quieres apoyar esta semana?" },
    { p: "Cuerpo",  sym: "🜔", r: "Tu energía es tu primer activo. Protégela como proteges tu tiempo.", q: "¿Qué te está drenando que puedas soltar?" },
    { p: "Mente",   sym: "🜁", r: "La comparación te roba lo que ya tienes.", q: "¿Qué tienes hoy que hace un año pedías?" },
    { p: "Alma",    sym: "☉", r: "No naciste para encajar. Naciste para transformar.", q: "¿En qué parte de tu vida estás encajando cuando podrías transformar?" },
    { p: "Planeta", sym: "🜃", r: "Lo sostenible también es sostener tu ritmo, no solo el del planeta.", q: "¿Tu ritmo de hoy es sostenible?" },
    { p: "Cuerpo",  sym: "🜔", r: "El descanso es productivo: ahí se repara todo lo demás.", q: "¿Cómo vas a descansar hoy, de verdad?" },
    { p: "Mente",   sym: "🜁", r: "Emprender te encanta; tu cabeza no siempre opina lo mismo. Y está bien pedir apoyo.", q: "¿A quién podrías pedirle apoyo esta semana?" },
    { p: "Alma",    sym: "☉", r: "Lo que ofreces al mundo cambia cuando lo haces desde tus valores.", q: "¿Tu trabajo de hoy refleja lo que crees?" },
    { p: "Planeta", sym: "🜃", r: "Cada compra consciente es una semilla: no ves el bosque, pero lo estás plantando.", q: "¿Qué semilla plantas hoy?" },
    { p: "Cuerpo",  sym: "🜔", r: "Moverte no es castigo. Es celebrar que estás viva.", q: "¿Cómo quieres mover tu cuerpo hoy, por gusto?" },
    { p: "Mente",   sym: "🜁", r: "El foco es decir 'no' a mil cosas buenas por la única que importa.", q: "¿A qué le dices 'no' hoy?" },
    { p: "Alma",    sym: "☉", r: "La comunidad no es un extra: es un pilar. Nadie transforma en soledad.", q: "¿Con quién quieres caminar este camino?" },
    { p: "Planeta", sym: "🜃", r: "Prosperar y cuidar el mundo no se pelean. Alquimia existe para demostrarlo.", q: "¿Cómo se ve tu prosperidad con propósito?" },
    { p: "Cuerpo",  sym: "🜔", r: "Pequeño y constante le gana a intenso y abandonado en febrero.", q: "¿Qué hábito pequeño empiezas hoy?" }
  ];

  function esc(s) { var d = document.createElement("div"); d.textContent = (s == null ? "" : String(s)); return d.innerHTML; }

  function render() {
    var el = document.getElementById("reflexionCard");
    if (!el) return;
    var now = new Date();
    var day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    var x = R[((day % R.length) + R.length) % R.length];
    var T = (window.I18N && window.I18N.t) ? window.I18N.t : function (k) { return k; };
    el.innerHTML =
      '<span class="eyebrow" style="justify-content:center">' + x.sym + ' ' + esc(T("cat." + x.p)) + ' · ' + esc(T("ref.eyebrow")) + '</span>' +
      '<p class="serif" style="font-size:clamp(22px,3.2vw,32px);font-style:italic;max-width:20em;margin:16px auto 14px;line-height:1.3;color:var(--parchment)">' + esc(x.r) + '</p>' +
      '<p class="muted" style="max-width:42ch;margin:0 auto 22px"><strong>' + esc(T("ref.q")) + ':</strong> ' + esc(x.q) + '</p>' +
      '<a href="registro.html" class="btn btn-gold btn-lg">' + esc(T("ref.cta")) + '</a>';
  }

  if (document.readyState !== "loading") render();
  else document.addEventListener("DOMContentLoaded", render);
})();
