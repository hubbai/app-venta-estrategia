/* types.ts — La estrategia post-pago.

   El shape sale de desarmar el entregable real de RESILIENT
   (fs.hubb.mx/r/resilient-estrategia): contexto de marca, dos escenarios,
   entregables lado a lado, función de cada contenido, los 10 pasos del
   servicio, las líneas creativas, la comparativa y el portafolio de creadores.

   Todo es opcional salvo el título: no toda propuesta trae los dos escenarios
   ni todas las secciones, y una sección vacía simplemente no se renderiza. */

export type Stat = { value: string; label: string };
export type Row = { label: string; value: string };

/* Un escenario de trabajo (ej. "10 creadores UGC" vs "UGC Ads + micros"). */
export type Escenario = {
  tag: string; // "Escenario 1"
  title: string; // "10 creadores UGC — UGC Ads + Stories"
  paragraphs: string[];
  badges: string[]; // "10 creadores", "Enfoque en pauta"
  /* La tira de "Recibe → Produce → Entrega" o "Grupo A + Grupo B = Total". */
  breakdown?: { label: string; value: string; caption: string }[];
  breakdownTitle?: string;
  breakdownSeparators?: string[]; // "→" o "+", "="
  note?: string;
};

/* Los entregables de cada escenario, para la comparación lado a lado. */
export type Panel = {
  tag: string;
  title: string;
  entregables: Row[];
  operativos: Row[];
};

/* Qué trabajo hace cada tipo de pieza. */
export type Funcion = { count: string; title: string; desc: string; scope: string };

/* Un paso del servicio. Las variantes son las diferencias por escenario. */
export type Paso = {
  phase: string; // "Paso 1 · Arranque"
  tag: string; // "Henry"
  title: string;
  desc: string;
  chips?: string[];
  variantes?: { label: string; text: string }[];
};

export type Linea = { title: string; desc: string };

export type Comparativa = { headers: string[]; rows: string[][] };

/* Un creador del portafolio. Es un snapshot de lo que devolvió hubb: si el
   creador cambia allá, la propuesta que ya mandaste no se altera. */
export type Creador = {
  id: string;
  name: string;
  location?: string;
  price?: string;
  categories?: string[];
  instagram?: string; // "1.6k"
  tiktok?: string; // "3.2k"
  videos?: number;
  avatar?: string | null;
  verified?: boolean;
  portfolioUrl?: string;
};

export type Estrategia = {
  title: string; // "Propuesta de Colaboración — Resilient"
  brand: string;
  intro?: string;

  contexto?: {
    title?: string;
    paragraphs: string[];
    atributos: string[];
    stats: Stat[];
  };

  escenarios: Escenario[];
  panelsTitle?: string;
  panelsSubtitle?: string;
  panels: Panel[];
  panelsNote?: string;

  funcionesTitle?: string;
  funcionesSubtitle?: string;
  funciones: Funcion[];

  pasosTitle?: string;
  pasosSubtitle?: string;
  pasos: Paso[];

  lineasTitle?: string;
  lineasSubtitle?: string;
  lineas: Linea[];

  comparativaTitle?: string;
  comparativaSubtitle?: string;
  comparativa?: Comparativa;

  creadoresTitle?: string;
  creadoresSubtitle?: string;
  creadoresNote?: string;
  creadores: Creador[];

  sourceDocName?: string;
  parsedAt?: string;
  engine?: string;
};

export function emptyEstrategia(brand: string): Estrategia {
  return {
    title: `Propuesta de Colaboración — ${brand}`,
    brand,
    escenarios: [],
    panels: [],
    funciones: [],
    pasos: [],
    lineas: [],
    creadores: [],
  };
}
