# Alquimia — estudio de video (Remotion)

Piezas de video hechas con React: reels, historias y clips para la web.
Es un proyecto aparte: no afecta al prototipo HTML de la raíz ni a la plataforma Next.js de `platform/`.

## Cómo trabajar

Abrir el estudio (previsualización en vivo, se recarga al guardar):

```bash
cd video && npm run studio
```

Exportar un video a MP4:

```bash
cd video && npx remotion render Reel out/reel.mp4
```

Composiciones disponibles:

- `Reel` — 1080×1920 (vertical, Instagram/TikTok), 10 s a 30 fps
- `Reel-Horizontal` — 1920×1080 (YouTube/web), 10 s a 30 fps

## Estructura

- `src/Root.tsx` — registra las composiciones (formato, duración, textos por defecto)
- `src/Reel.tsx` — el diseño y las animaciones de la pieza
- `src/theme.ts` — paleta de Alquimia y los cinco pilares con su símbolo
- `remotion.config.ts` — opciones de render

## Nota de licencia

Remotion es gratis para personas y para empresas de hasta 3 personas. Si el equipo
de Alquimia llega a 4 o más, hace falta una licencia de empresa:
https://remotion.dev/license
