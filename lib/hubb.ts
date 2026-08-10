/* hubb.ts — Lo único que esta app le pide a hubb: creadores aprobados para el
   portafolio de la estrategia.

   Es una llamada HTTP contra un endpoint de solo lectura protegido con Bearer
   (hubb/app/api/external/creators/search). No compartimos base de datos: si
   hubb está caído, el resto de la app sigue funcionando y los creadores se
   capturan a mano. */

export type HubbCreator = {
  id: string;
  name: string;
  avatar?: string | null;
  bio?: string;
  location?: string;
  categories?: string[];
  followerCount?: number;
  engagementRate?: number | null;
  instagramHandle?: string | null;
  instagramFollowers?: string | null;
  tiktokHandle?: string | null;
  tiktokFollowers?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  portfolioItems?: number;
  portfolioUrl?: string;
  verified?: boolean;
};

export function hubbReady(): boolean {
  return Boolean(process.env.HUBB_API_URL && process.env.HUBB_API_TOKEN);
}

export type CreatorQuery = {
  q?: string;
  category?: string;
  location?: string;
  minFollowers?: number;
  maxFollowers?: number;
  limit?: number;
};

export async function searchHubbCreators(query: CreatorQuery): Promise<HubbCreator[]> {
  if (!hubbReady()) {
    throw new Error("Falta configurar HUBB_API_URL y HUBB_API_TOKEN.");
  }

  const url = new URL("/api/external/creators/search", process.env.HUBB_API_URL);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.HUBB_API_TOKEN}` },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  }).catch((err) => {
    throw new Error(`No respondió hubb: ${err?.message || err}`);
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("hubb rechazó el token. Revisa que HUBB_API_TOKEN y EXTERNAL_API_TOKEN sean el mismo.");
  }
  if (!res.ok) throw new Error(`hubb respondió ${res.status}.`);

  const data = (await res.json()) as { creators?: HubbCreator[] };
  return data.creators ?? [];
}

/* Traduce un creador de hubb al snapshot que se congela en la propuesta.
   Se guarda el texto ya formateado, no los números crudos: así la propuesta
   enviada no cambia si el creador crece o le suben el precio en hubb. */
export function toCreador(c: HubbCreator) {
  const price =
    c.priceMin && c.priceMax && c.priceMin !== c.priceMax
      ? `$${c.priceMin.toLocaleString("es-MX")} – $${c.priceMax.toLocaleString("es-MX")}`
      : c.priceMin
        ? `$${c.priceMin.toLocaleString("es-MX")}`
        : "Por consultar";

  return {
    id: c.id,
    name: c.name,
    location: c.location,
    price,
    categories: c.categories ?? [],
    instagram: c.instagramFollowers ?? undefined,
    tiktok: c.tiktokFollowers ?? undefined,
    videos: c.portfolioItems,
    avatar: c.avatar ?? null,
    verified: c.verified,
    portfolioUrl: c.portfolioUrl ?? `${process.env.HUBB_API_URL}/portfolio/${c.id}`,
  };
}
