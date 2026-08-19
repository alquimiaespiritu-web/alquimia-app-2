import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as cargarFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as cargarNunito } from "@remotion/google-fonts/Nunito";
import { colores, pilares } from "./theme";

// Solo los pesos y el subconjunto que usamos: carga más rápida al renderizar
const { fontFamily: serif } = cargarFraunces("normal", {
  weights: ["600"],
  subsets: ["latin"],
});
const { fontFamily: sans } = cargarNunito("normal", {
  weights: ["400", "600"],
  subsets: ["latin"],
});

export type PropsReel = {
  titulo: string;
  bajada: string;
};

export const Reel: React.FC<PropsReel> = ({ titulo, bajada }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Entrada suave del título
  const entradaTitulo = spring({ frame, fps, config: { damping: 200 } });
  const entradaBajada = spring({
    frame: frame - 15,
    fps,
    config: { damping: 200 },
  });

  // Salida al final, para que el loop no corte en seco
  const salida = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${colores.crema} 0%, ${colores.beige} 55%, ${colores.lavanda} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        padding: 120,
        opacity: salida,
      }}
    >
      <div
        style={{
          fontFamily: serif,
          fontSize: 118,
          lineHeight: 1.08,
          color: colores.plum,
          textAlign: "center",
          opacity: entradaTitulo,
          transform: `translateY(${interpolate(entradaTitulo, [0, 1], [40, 0])}px)`,
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          fontFamily: sans,
          fontSize: 46,
          lineHeight: 1.4,
          color: colores.tinta,
          textAlign: "center",
          marginTop: 48,
          maxWidth: 820,
          opacity: entradaBajada,
        }}
      >
        {bajada}
      </div>

      {/* Los cinco pilares, apareciendo uno a uno */}
      <div
        style={{
          display: "flex",
          gap: 56,
          marginTop: 110,
          alignItems: "flex-start",
        }}
      >
        {pilares.map((pilar, i) => {
          const aparece = spring({
            frame: frame - 40 - i * 6,
            fps,
            config: { damping: 200 },
          });
          return (
            <div
              key={pilar.nombre}
              style={{
                textAlign: "center",
                opacity: aparece,
                transform: `scale(${interpolate(aparece, [0, 1], [0.7, 1])})`,
              }}
            >
              {/* Alto fijo: los símbolos tienen tamaños distintos y si no,
                  los nombres quedan a alturas diferentes */}
              <div
                style={{
                  fontSize: 68,
                  color: colores.oroOscuro,
                  height: 96,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {pilar.simbolo}
              </div>
              <div
                style={{
                  fontFamily: sans,
                  fontSize: 26,
                  color: colores.amatista,
                  marginTop: 10,
                  letterSpacing: 1,
                }}
              >
                {pilar.nombre}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
