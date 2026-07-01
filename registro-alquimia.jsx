import React, { useState, useEffect, useRef } from "react";

const C = {
  ink: "#1B1322",
  panel: "#261A30",
  panelEdge: "#3A2A47",
  gold: "#C6A15B",
  goldSoft: "#E0C079",
  plum: "#4B244A",
  text: "#ECE3D6",
  textMuted: "#A99CB4",
  bubbleAI: "#2C2038",
  bubbleUser: "#3A2746",
};

const display = 'Fraunces, Georgia, "Times New Roman", serif';
const body = '"Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const mono = '"Spline Sans Mono", ui-monospace, monospace';

const EMPTY = {
  nombre: "",
  rol: "",
  categoria: "",
  ubicacion: "",
  bio: "",
  pub_titulo: "",
  pub_tipo: "Producto",
  pub_precio: "",
  pub_descripcion: "",
};

const SYSTEM = `Eres el asistente de perfil de Alquimia, un marketplace de emprendedores conscientes: productos y servicios con propósito. Ayudas a un emprendedor a completar su perfil conversando con calidez, una pregunta a la vez. Voz cálida, humana, breve, inspiradora; nunca robótica ni de ventas. Tema de marca: la transmutación, el propósito que se vuelve oro.

Te paso el estado actual del formulario en cada turno. Pregunta por lo que falte, en orden natural, y redacta tú la bio y la descripción con la voz de la persona a partir de lo que cuente.

Devuelves SOLO un objeto JSON válido, sin markdown ni texto extra, con esta forma exacta:
{"reply":"tu mensaje conversacional","fields":{"nombre":"","rol":"","categoria":"","ubicacion":"","bio":"","pub_titulo":"","pub_tipo":"Producto","pub_descripcion":"","pub_precio":""},"complete":false}

Reglas:
- UNA pregunta por turno en "reply". Mensajes cortos.
- En "fields" incluye SOLO los campos que tengas información nueva o mejorada para escribir; omite el resto. "pub_tipo" solo "Producto" o "Servicio".
- Mínimo para completar: nombre, rol, categoria, ubicacion, bio, y una publicación (pub_titulo, pub_tipo, pub_precio, pub_descripcion).
- Al tener el mínimo, pule bio y descripción, pon "complete":true y cierra cálidamente.`;

function extractJSON(text) {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e === -1) return null;
  try {
    return JSON.parse(text.slice(s, e + 1));
  } catch {
    return null;
  }
}

function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" stroke={C.gold} strokeWidth="3" strokeLinejoin="round">
        <circle cx="50" cy="48" r="42" />
        <polygon points="50,12 14,76 86,76" />
        <rect x="28" y="34" width="44" height="44" />
        <circle cx="50" cy="52" r="20" />
      </g>
    </svg>
  );
}

export default function App() {
  const [form, setForm] = useState(EMPTY);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [apiHistory, setApiHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const scrollRef = useRef(null);
  const [highlight, setHighlight] = useState([]);

  useEffect(() => {
    const id = "alquimia-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link");
      l.id = id;
      l.rel = "stylesheet";
      l.href =
        "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&family=Hanken+Grotesk:wght@400;500;600&family=Spline+Sans+Mono:wght@400&display=swap";
      document.head.appendChild(l);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function applyFields(fields) {
    if (!fields) return;
    const changed = [];
    setForm((f) => {
      const next = { ...f };
      Object.keys(fields).forEach((k) => {
        if (k in next && fields[k] && String(fields[k]).trim()) {
          if (next[k] !== fields[k]) changed.push(k);
          next[k] = fields[k];
        }
      });
      return next;
    });
    if (changed.length) {
      setHighlight(changed);
      setTimeout(() => setHighlight([]), 1200);
    }
  }

  async function call(history) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM,
        messages: history,
      }),
    });
    const data = await res.json();
    return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  }

  function stateLine() {
    return `(Estado actual del formulario: ${JSON.stringify(form)})`;
  }

  async function begin() {
    setChatOpen(true);
    setStarted(true);
    setLoading(true);
    const kickoff = `${stateLine()}\n(El emprendedor pidió ayuda. Saluda breve y pregunta por el primer campo que falte.)`;
    const hist = [{ role: "user", content: kickoff }];
    setApiHistory(hist);
    try {
      const raw = await call(hist);
      const parsed = extractJSON(raw);
      setApiHistory((h) => [...h, { role: "assistant", content: raw }]);
      setMessages([{ role: "ai", text: parsed?.reply || "Hola, ¿cómo te llamas y qué creas?" }]);
      applyFields(parsed?.fields);
    } catch {
      setMessages([{ role: "ai", text: "No pude iniciar. Revisa la conexión e intenta de nuevo." }]);
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userTurn = `${text}\n${stateLine()}`;
    const next = [...apiHistory, { role: "user", content: userTurn }];
    setApiHistory(next);
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const raw = await call(next);
      const parsed = extractJSON(raw);
      setApiHistory((h) => [...h, { role: "assistant", content: raw }]);
      setMessages((m) => [...m, { role: "ai", text: parsed?.reply || raw || "¿Me lo cuentas de otra forma?" }]);
      applyFields(parsed?.fields);
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "Algo falló. Inténtalo otra vez." }]);
    } finally {
      setLoading(false);
    }
  }

  const hl = (k) => highlight.includes(k);

  return (
    <div
      style={{
        background: `radial-gradient(circle at 50% -10%, ${C.plum}44, ${C.ink} 58%)`,
        padding: "26px 20px 30px",
        fontFamily: body,
        color: C.text,
        borderRadius: 14,
        minHeight: 560,
      }}
    >
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
          <Logo />
          <div>
            <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: C.gold }}>
              Alquimia · crear perfil de vendedor
            </div>
          </div>
        </div>

        {/* FORMULARIO — elemento principal */}
        <div style={{ background: "#FBF8F1", borderRadius: 14, border: "1px solid #E4DAC6", padding: 22, color: "#2A2233" }}>
          <Field label="Nombre" hl={hl("nombre")}>
            <input style={inp} value={form.nombre} onChange={set("nombre")} placeholder="Tu nombre o el de tu marca" />
          </Field>
          <Field label="Oficio o propósito" hl={hl("rol")}>
            <input style={inp} value={form.rol} onChange={set("rol")} placeholder="Ej. ceramista, terapeuta, tostadora de café" />
          </Field>
          <div style={{ display: "flex", gap: 12 }}>
            <Field label="Categoría" hl={hl("categoria")} style={{ flex: 1 }}>
              <input style={inp} value={form.categoria} onChange={set("categoria")} placeholder="Bienestar, arte…" />
            </Field>
            <Field label="Ubicación" hl={hl("ubicacion")} style={{ flex: 1 }}>
              <input style={inp} value={form.ubicacion} onChange={set("ubicacion")} placeholder="Utrecht" />
            </Field>
          </div>
          <Field label="Tu historia" hl={hl("bio")}>
            <textarea style={{ ...inp, minHeight: 80, resize: "vertical", lineHeight: 1.5 }} value={form.bio} onChange={set("bio")} placeholder="¿Qué te mueve? ¿Cómo empezó todo?" />
          </Field>

          <div style={{ borderTop: "1px solid #EADFC9", margin: "18px 0 4px" }} />
          <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A89A78", margin: "8px 0 12px" }}>
            Tu primera publicación
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Field label="Título" hl={hl("pub_titulo")} style={{ flex: 2 }}>
              <input style={inp} value={form.pub_titulo} onChange={set("pub_titulo")} placeholder="Lo que ofreces" />
            </Field>
            <Field label="Tipo" hl={hl("pub_tipo")} style={{ width: 120 }}>
              <select style={{ ...inp, cursor: "pointer" }} value={form.pub_tipo} onChange={set("pub_tipo")}>
                <option>Producto</option>
                <option>Servicio</option>
              </select>
            </Field>
          </div>
          <Field label="Precio" hl={hl("pub_precio")}>
            <input style={inp} value={form.pub_precio} onChange={set("pub_precio")} placeholder="€18 – €45" />
          </Field>
          <Field label="Descripción" hl={hl("pub_descripcion")}>
            <textarea style={{ ...inp, minHeight: 64, resize: "vertical", lineHeight: 1.5 }} value={form.pub_descripcion} onChange={set("pub_descripcion")} placeholder="Describe lo que ofreces y su propósito" />
          </Field>

          <button style={{ ...btnGold, width: "100%", marginTop: 16 }}>Publicar mi perfil</button>
        </div>

        {/* ASISTENTE — apoyo secundario, abajo y plegable */}
        <div style={{ marginTop: 16, border: `1px solid ${C.panelEdge}`, borderRadius: 12, background: C.panel, overflow: "hidden" }}>
          <button
            onClick={() => (started ? setChatOpen((v) => !v) : begin())}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "none",
              border: "none",
              padding: "13px 16px",
              cursor: "pointer",
              color: C.text,
              fontFamily: body,
              fontSize: 13.5,
              textAlign: "left",
            }}
          >
            <span style={{ color: C.gold, fontSize: 16, lineHeight: 1 }}>✦</span>
            <span style={{ flex: 1 }}>
              ¿Prefieres que te ayude? Lo llenamos conversando.
            </span>
            <span style={{ color: C.textMuted, fontSize: 12 }}>{chatOpen ? "ocultar" : "abrir"}</span>
          </button>

          {chatOpen && (
            <div style={{ padding: "0 14px 14px" }}>
              <div
                ref={scrollRef}
                style={{
                  background: "#1F1528",
                  border: `1px solid ${C.panelEdge}`,
                  borderRadius: 10,
                  padding: 12,
                  height: 230,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                }}
              >
                {messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "86%",
                      background: m.role === "user" ? C.bubbleUser : C.bubbleAI,
                      color: C.text,
                      borderRadius: 11,
                      borderTopRightRadius: m.role === "user" ? 3 : 11,
                      borderTopLeftRadius: m.role === "user" ? 11 : 3,
                      padding: "8px 11px",
                      fontSize: 13.5,
                      lineHeight: 1.5,
                    }}
                  >
                    {m.text}
                  </div>
                ))}
                {loading && (
                  <div style={{ alignSelf: "flex-start", color: C.textMuted, fontSize: 12.5, fontStyle: "italic", padding: "2px" }}>
                    pensando…
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  disabled={loading}
                  placeholder="Escribe tu respuesta…"
                  style={{
                    flex: 1,
                    background: "#160F1D",
                    border: `1px solid ${C.panelEdge}`,
                    borderRadius: 8,
                    padding: "9px 12px",
                    color: C.text,
                    fontFamily: body,
                    fontSize: 13.5,
                    outline: "none",
                  }}
                />
                <button onClick={send} disabled={loading || !input.trim()} style={{ ...btnGold, padding: "9px 16px", fontSize: 14, opacity: loading || !input.trim() ? 0.45 : 1 }}>
                  Enviar
                </button>
              </div>
              <p style={{ fontSize: 11.5, color: C.textMuted, margin: "9px 2px 0", lineHeight: 1.5 }}>
                Lo que cuentes se va escribiendo arriba, en el formulario. Puedes editar cualquier campo a mano.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inp = {
  width: "100%",
  boxSizing: "border-box",
  background: "#FFFFFF",
  border: "1px solid #E2D8C2",
  borderRadius: 8,
  padding: "10px 12px",
  fontFamily: body,
  fontSize: 14,
  color: "#2A2233",
  outline: "none",
  marginTop: 5,
};

const btnGold = {
  background: "#C6A15B",
  color: "#241803",
  border: "none",
  borderRadius: 9,
  padding: "12px 20px",
  fontFamily: 'Fraunces, Georgia, serif',
  fontSize: 15,
  cursor: "pointer",
};

function Field({ label, children, hl, style }) {
  return (
    <div style={{ marginTop: 12, transition: "background 0.4s", background: hl ? "#FBF1D8" : "transparent", borderRadius: 8, ...style }}>
      <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A89A78", fontWeight: 500 }}>
        {label}
      </span>
      {children}
    </div>
  );
}
