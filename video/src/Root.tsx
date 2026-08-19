import React from "react";
import { Composition } from "remotion";
import { Reel } from "./Reel";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Vertical, para reels e historias */}
      <Composition
        id="Reel"
        component={Reel}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          titulo: "Alquimia",
          bajada: "Un espacio seguro para cuidarte, a tu ritmo.",
        }}
      />

      {/* Horizontal, para YouTube o la web */}
      <Composition
        id="Reel-Horizontal"
        component={Reel}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          titulo: "Alquimia",
          bajada: "Un espacio seguro para cuidarte, a tu ritmo.",
        }}
      />
    </>
  );
};
