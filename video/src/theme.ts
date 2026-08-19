// Paleta de Alquimia (misma que index.html)
export const colores = {
  beige: "#F1E7D4",
  beigeHondo: "#E9DBC1",
  crema: "#FBF5EA",
  lavanda: "#ECE4F1",
  linea: "#E4D7BF",
  oro: "#C6A15B",
  oroOscuro: "#A9803F",
  oroClaro: "#E0C385",
  amatista: "#7A4E9B",
  amatistaSuave: "#8E5BB0",
  plum: "#4B244A",
  tinta: "#41313F",
  muted: "#8C7B86",
} as const;

// Los cinco pilares, con su símbolo alquímico
export const pilares = [
  { nombre: "Cuerpo", simbolo: "🜔" },
  { nombre: "Mente", simbolo: "🜁" },
  { nombre: "Alma", simbolo: "☉" },
  { nombre: "Planeta", simbolo: "🜃" },
  { nombre: "Comunidad", simbolo: "🜄" },
] as const;
