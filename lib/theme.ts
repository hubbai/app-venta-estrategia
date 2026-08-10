/* Guía de marca Hubb para los entregables publicados. Hex de 6 dígitos sin "#"
   (se interpolan dentro del CSS embebido). Copiado de research-pitch/src/theme.js
   para que lo ya publicado y lo nuevo se vean idénticos. */
export const C = {
  cream: "FFFBF2",
  ink: "1A1A1A",
  gold: "E3A335",
  goldDark: "C4841E",
  goldLight: "FDF0D5",
  gray: "6B6B6B",
  grayLight: "9A9A9A",
  white: "FFFFFF",
  border: "EDE4CF",
  greenBg: "DFF3E6",
  greenText: "1F9254",
  neutralBg: "F1EEE7",
};

/* Escapa para insertar texto dentro de HTML. Todo lo que venga del research o
   de Claude pasa por aquí antes de tocar el markup. */
export function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

/* Para meter una URL dentro de url('…') en un style inline. */
export function escUrl(u: unknown): string {
  return String(u ?? "").replace(/["'\\\s<>]/g, encodeURIComponent);
}

export const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet">`;
