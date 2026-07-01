# Alquimia — Prototipo de la app

Marketplace de emprendedores conscientes: compra y venta de productos y servicios con propósito, perfiles tipo red social y pagos con comisión.

---

## Cómo abrirlo

La forma más confiable (para que la creación de perfiles y los pagos simulados funcionen bien):

1. Abre una terminal en esta carpeta.
2. Ejecuta un servidor local sencillo, por ejemplo:
   - Con Python: `python3 -m http.server 8000`
   - Con Node: `npx serve`
3. Entra a `http://localhost:8000` en tu navegador.

> También puedes abrir `index.html` directamente con doble clic; casi todo funciona, pero un servidor local evita pequeños problemas con el guardado local de perfiles en algunos navegadores.

---

## Publicar en Netlify y recibir inscripciones

La página de registro (`registro.html`) trae **dos formularios conectados a Netlify Forms**: uno para compradores y otro para vendedores. Para ponerlos a funcionar:

1. Crea una cuenta gratis en **netlify.com**.
2. Entra a **app.netlify.com/drop** y **arrastra la carpeta `alquimia-app`** completa. En segundos tendrás una URL pública con HTTPS.
3. Activa las notificaciones por correo:
   - En tu sitio: **Forms** (o *Site configuration → Forms*).
   - Verás dos formularios: **`comprador`** y **`vendedor`**.
   - Ve a **Form notifications → Add notification → Email notification**.
   - Pon el correo: **alquimiaespiritu@gmail.com**
4. Listo: cada inscripción te llega a ese Gmail y queda guardada en el panel **Forms** (en `comprador` o `vendedor`). Si quieres aviso de los dos, añade la notificación para cada formulario.

> Si el formulario no aparece tras el primer deploy, revisa que **"Form detection"** esté activado en *Site configuration → Forms* y vuelve a desplegar.

**Cómo funciona el registro:** en `registro.html` la persona elige **comprador** o **vendedor**. El comprador deja nombre, correo e interés y pasa a `gracias.html`. El vendedor deja sus datos y pasa directo a `create-profile.html` para armar su perfil. Netlify guarda ambos.

**Carrito de compras:** desde cualquier publicación se puede *Añadir al carrito* o *Comprar ahora*. El carrito (`cart.html`) vive en el navegador (localStorage), permite cambiar cantidades y quitar, y al pagar (`checkout.html`) muestra el total y el reparto de la comisión. En producción esto se conecta a Stripe/Mollie.

> Nota: el formulario solo captura datos de verdad **una vez publicado en Netlify**. Si lo abres en tu computador localmente, el envío no se guarda (no hay Netlify detrás todavía).

### Cuando crezca el tráfico
El plan gratis de Netlify funciona por créditos (~15 GB/mes, 1 usuario). Para esta etapa va sobrado. Cuando tengas mucho tráfico, subes a un plan de pago o cambias de hospedaje — sin rehacer nada. Y cuando quieras perfiles compartidos entre usuarios y cobros reales, le sumas **Supabase** (base de datos) y **Stripe/Mollie** (pagos); Netlify sigue de hospedaje.

---

## Páginas incluidas

| Archivo | Qué es |
|---|---|
| `index.html` | Portada / marketing. Explica qué es Alquimia y lleva a explorar o publicar. |
| `registro.html` | Registro como **comprador** o **vendedor** (dos formularios Netlify). |
| `marketplace.html` | El feed tipo Facebook Marketplace / Instagram: buscar, filtrar por categoría y ver publicaciones. |
| `listing.html` | Detalle de un producto o servicio, con botón de añadir al carrito o comprar. |
| `cart.html` | Carrito de compras: cantidades, quitar, subtotal e ir al pago. |
| `profile.html` | Perfil público del proveedor: bio, galería de fotos/video y lo que vende. |
| `create-profile.html` | Creación de perfil: foto, historia, galería y publicaciones con precio. |
| `connect-payout.html` | El proveedor conecta su cuenta para recibir pagos (estilo Stripe Connect). |
| `checkout.html` | Pago del cliente, con el desglose de la comisión de la plataforma. |
| `dashboard.html` | Panel del proveedor: publicaciones, ventas, ingresos y comisión. |
| `gracias.html` | Página de agradecimiento tras un registro exitoso. |
| `assets/` | `styles.css` (diseño), `data.js` (datos de ejemplo), `app.js` (lógica). |

---

## Qué es real y qué está simulado

**Funciona de verdad (en el navegador):**
- Toda la navegación entre páginas.
- Buscar y filtrar el marketplace.
- Crear un perfil con foto y publicaciones — se guarda en tu navegador (localStorage) y **aparece de inmediato en el marketplace**.
- El reparto de la comisión se calcula de verdad (10% configurable).

**Simulado a propósito (necesita backend en producción):**
- Los **pagos**: el checkout y la conexión de cuenta son demostraciones de interfaz. No se cobra ni se transfiere dinero real, ni se piden datos bancarios reales.
- Las **ventas** del panel son cifras de ejemplo.
- Las **fotos/videos** se guardan solo en tu navegador (la foto de perfil reducida; la galería como vista previa). En producción van a un almacenamiento en la nube.

---

## El camino a producción

Cuando valides que la gente compra, esto se convierte en app real así:

1. **Base de datos y cuentas reales** → mover los perfiles y publicaciones de localStorage a una base como **Supabase**. Herramientas como **Lovable** o **Base44** pueden tomar este prototipo como referencia y generarlo con backend incluido.
2. **Pagos con comisión** → **Stripe Connect** (o **Mollie**, muy usado en Países Bajos). El proveedor crea su cuenta conectada, el cliente paga el total, y la plataforma separa su comisión y transfiere el neto. Necesita un servidor (las claves de pago nunca van en el navegador).
3. **Almacenamiento de medios** → Cloudinary o el storage de Supabase, con límites por perfil (p. ej. 8 fotos + 2 videos al inicio) para controlar costos.

### Antes de procesar el primer euro (importante)
Cuando el dinero pasa por tu plataforma, Alquimia se vuelve intermediario y asume obligaciones reales en la UE/Países Bajos: verificación de vendedores (KYC), IVA, protección al consumidor, devoluciones y disputas. **No es asesoría legal** — conviene confirmarlo con un abogado de plataformas digitales antes de lanzar pagos.

---

## Ajustes rápidos

- **Comisión:** cambia `COMMISSION` al inicio de `assets/data.js` (ahora 0.10 = 10%).
- **Moneda:** `CURRENCY` en el mismo archivo.
- **Categorías y perfiles de ejemplo:** edita los arrays en `assets/data.js`.
- **Colores y tipografía:** variables al inicio de `assets/styles.css`.

---

*Nota: el logo dice "ALQUMIA" — conviene corregirlo a "ALQUIMIA" antes de usarlo en todas partes.*
