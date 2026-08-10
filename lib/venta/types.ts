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

/* Un video, venga del perfil de la marca, del buscador o de un creador. */
export type Clip = {
  url?: string;
  views?: string;
  viewsNum?: number;
  image?: string | null; // miniatura en Blob
  author?: string;
  title?: string;
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
  /* Lo que sale al buscar la marca en TikTok (el "screenshot del buscador"). */
  search?: { query: string; results: Clip[]; screenshot?: string | null };

  bestContent: "creador" | "marca" | "nodata";
  bestViews?: string;
  ownViews?: string;
  notes?: string;

  scrapedAt?: string;
  /* Qué bloques se trajeron solos y cuáles fallaron, para avisarte en el form. */
  sources?: Record<string, "ok" | "fallo" | "manual">;
};

/* El copy que escribe Claude. 3 slides. */
export type Deck = {
  s1: { subtitle: string; cards: { title: string; desc: string }[] };
  s2: { subtitle: string; insight: { title: string; desc: string } };
  s3: {
    subtitle: string;
    win: { label?: string; title: string; desc: string };
    own: { label?: string; title: string; desc: string };
    closing: { title: string; text: string };
  };
};

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
