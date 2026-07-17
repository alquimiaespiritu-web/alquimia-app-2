# Cuenta de comprador con clave — pasos para activarlo

Ahora el comprador tiene **cuenta real con correo + contraseña** (igual de segura que la vendedora), usa el mismo login de Supabase, y recibe correo de bienvenida.

Reglas aplicadas:
- La **vendedora puede comprar** (si entra a "Mi cuenta" se le crea su ficha de compradora automáticamente).
- La **compradora puede postularse como vendedora** en un **registro aparte**: su perfil de vendedora queda **pendiente de aprobación** con su mismo usuario. **Al aceptar su producto/servicio, las cuentas se sincronizan** (la misma persona pasa a tener ambos roles). Antes de la aprobación sigue siendo solo compradora.
- Cada perfil queda protegido por sesión (correo + clave) — importante porque los pagos quedan en el perfil.

---

## 1) SQL en Supabase (una sola vez)
SQL Editor → pega y ejecuta:

```sql
-- Tabla de compradores (1 fila por usuario de Auth)
create table if not exists public.buyers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text,
  email      text,
  intereses  text,
  impact     text,
  avatar_url text,
  ini        text,
  supported  jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Seguridad por fila: cada quien solo ve/edita SU ficha
alter table public.buyers enable row level security;

drop policy if exists "buyers self read"   on public.buyers;
drop policy if exists "buyers self insert" on public.buyers;
drop policy if exists "buyers self update" on public.buyers;

create policy "buyers self read"   on public.buyers for select using (auth.uid() = user_id);
create policy "buyers self insert" on public.buyers for insert with check (auth.uid() = user_id);
create policy "buyers self update" on public.buyers for update using (auth.uid() = user_id);
```

## 2) Correo de bienvenida (Resend)
El registro dispara el evento `suscriptora.bienvenida` en Resend. Para que el correo **llegue de verdad**, en el panel de Resend deben existir:
- `RESEND_API_KEY` configurada en Netlify (variables de entorno).
- Una **plantilla publicada** de bienvenida (ES/EN).
- Una **automatización** que escuche el evento `suscriptora.bienvenida` y envíe esa plantilla.

Sin esto, la cuenta se crea igual (no se rompe), pero no sale el correo. (Esto explica por qué antes no te llegó.)

## 3) Desplegar
`git push` para que Netlify publique. Luego `Cmd+Shift+R`.

---

## Cómo probarlo
1. Entra a **registro.html** → pestaña "Busco con propósito" → "Crear mi cuenta de comprador" (te lleva a `comprador.html`).
2. Llena nombre, correo, **clave** (mín. 6), impacto → "Crear mi cuenta".
3. Te llega un **código** al correo → lo escribes → queda tu cuenta creada con clave y sesión iniciada.
4. Cierra sesión y vuelve a entrar con correo + clave (link "¿Ya tienes cuenta? Entrar").
5. Prueba la sincronización de roles: estando con cuenta de comprador, entra a `create-profile.html` → te deja llenar el registro de vendedora (aparte); queda **pendiente**. Cuando la apruebas desde el panel admin, esa misma cuenta pasa a tener ambos roles (comprador + vendedor).

## Archivos tocados
- `assets/data.js`: `myBuyer`, `saveBuyerAccount`, `updateBuyer` (tabla buyers) + export.
- `assets/app.js`: `initComprador` reescrito (entrar / crear cuenta con código + clave / bienvenida / cerrar sesión / vendedora-también-compra) + regla comprador≠vendedora en `initCreate`.
- `registro.html`: la pestaña de comprador ahora enlaza a `comprador.html` (un solo flujo de alta).
- `assets/i18n.js`: claves nuevas ES/EN/NL (cb.*, cp.buyerBlock.*, rg.buyer.*).

Nota: como no puedo probar el login real contra tu Supabase desde aquí, verifica el flujo en el sitio desplegado. La lógica reutiliza el mismo mecanismo probado de las vendedoras (código de activación + clave).
