/* types.ts — El research de la llamada de venta.

   Hereda el shape de full_service/lib/research/types.ts (que ya está probado
   contra RESILIENT) y lo extiende con lo que pediste de más: perfiles de IG y
   TikTok, los mejores videos propios, lo que sale al buscar la marca en TikTok,
   y el análisis de creadores externos. */

export type Network = {
  name: string;
  active: boolean;
  followers?: string;
  content?: string;
  reach?: string;
};

export type Ad = {
  text: string;
  started?: string;
  isVideo?: boolean;
  duration?: string | null;
  image?: string | null; // URL en Blob
};

/* De quién es un video que salió en el buscador. Es la pregunta que abre la
   llamada, así que se guarda por resultado y se puede corregir a mano: la
   slide 1 afirma cosas sobre esto frente al cliente. */
export type Owner = "marca" | "competencia" | "creador";

/* Un video, venga del perfil de la marca, del buscador o de un creador. */
export type Clip = {
  url?: string;
  views?: string;
  viewsNum?: number;
  image?: string | null; // miniatura en Blob
  author?: string;
  title?: string;
  /* Solo en los resultados del buscador. */
  owner?: Owner;
  /* Por qué se clasificó así, para que puedas juzgar si está bien. */
  ownerWhy?: string;
};

/* El perfil tal cual se ve: la "screenshot" reconstruida con datos reales. */
export type Profile = {
  handle?: string;
  name?: string;
  avatar?: string | null;
  bio?: string;
  followers?: string;
  followersNum?: number;
  posts?: string;
  verified?: boolean;
  /* Screenshot subida a mano, por si prefieres la captura real del perfil. */
  screenshot?: string | null;
};

export type Research = {
  brand: string;
  site?: string;
  industry: string;

  // ── Paid media ──
  adLibraryUrl?: string;
  adPageId?: string;
  adCount: number;
  adVideoCount?: number;
  adImageCount?: number;
  adHooks?: string;
  adFormat?: string;
  adOldest?: string;
  ads?: Ad[];

  // ── Orgánico ──
  instagram?: Profile;
  tiktok?: Profile;
  networks: Network[];
  /* Los 2 mejores videos propios y los 2 mejores de creadores externos. */
  organic?: { brand: Clip[]; creators: Clip[] };
  /* Lo que sale al buscar la marca en TikTok (el "screenshot del buscador").
     Es la slide 1: lo más importante de la llamada. */
  search?: { query: string; results: Clip[]; screenshot?: string | null };
  /* Nombres o handles de la competencia, escritos a mano en el editor. Sin
     esto no hay forma de distinguir a otra marca de un creador: las dos son
     cuentas de terceros publicando sobre la categoría. */
  competitors?: string[];

  bestContent: "creador" | "marca" | "nodata";
  bestViews?: string;
  ownViews?: string;
  notes?: string;

  scrapedAt?: string;
  /* Qué bloques se trajeron solos y cuáles fallaron, para avisarte en el form. */
  sources?: Record<string, "ok" | "fallo" | "manual">;
  /* Por qué falló cada bloque, en palabras. Se guarda junto con el research
     para que al volver al editor mañana siga explicando el hueco. */
  sourceErrors?: Record<string, string>;
};

/* El copy que escribe Claude. 3 slides, en el orden en que se proyectan.

   El buscador va primero porque es lo que abre la llamada: antes de hablar de
   pauta o de seguidores, el cliente ve qué sale cuando lo buscan en TikTok. */
export type Deck = {
  buscador: {
    subtitle: string;
    /* Una línea por pregunta. El número y el sí/no los calcula el render con
       los datos; esto es qué significa. */
    veredictos: { marca: string; competencia: string; creadores: string };
  };
  paid: { subtitle: string; cards: { title: string; desc: string }[] };
  organico: {
    subtitle: string;
    win: { label?: string; title: string; desc: string };
    own: { label?: string; title: string; desc: string };
    closing: { title: string; text: string };
  };
};

/* Los decks que se guardaron antes de mover el buscador al frente usan s1/s2/s3.
   Se traducen al vuelo para que un borrador viejo siga abriendo en el editor. */
type DeckLegacy = {
  s1?: { subtitle?: string; cards?: { title: string; desc: string }[] };
  s2?: { subtitle?: string };
  s3?: {
    subtitle?: string;
    win?: { label?: string; title: string; desc: string };
    own?: { label?: string; title: string; desc: string };
    closing?: { title: string; text: string };
  };
};

export function normalizeDeck(d: Deck | DeckLegacy | null | undefined): Deck | null {
  if (!d) return null;
  if ("buscador" in d && d.buscador) return d as Deck;

  const old = d as DeckLegacy;
  if (!old.s1 && !old.s2 && !old.s3) return null;
  const vacio = { title: "", desc: "" };
  return {
    buscador: {
      subtitle: old.s3?.subtitle ?? "",
      veredictos: { marca: "", competencia: "", creadores: "" },
    },
    paid: { subtitle: old.s1?.subtitle ?? "", cards: old.s1?.cards ?? [] },
    organico: {
      subtitle: old.s2?.subtitle ?? "",
      win: old.s3?.win ?? vacio,
      own: old.s3?.own ?? vacio,
      closing: { title: old.s3?.closing?.title ?? "", text: old.s3?.closing?.text ?? "" },
    },
  };
}

export function emptyResearch(brand: string): Research {
  return {
    brand,
    industry: "",
    adCount: 0,
    networks: [
      { name: "Instagram", active: false },
      { name: "TikTok", active: false },
    ],
    organic: { brand: [], creators: [] },
    bestContent: "nodata",
  };
}
