/* hubb.ts — Lo único que esta app le pide a hubb: creadores aprobados para el
   portafolio de la estrategia.

   Va contra `GET /api/external/creators`, el endpoint que hubb ya tenía para
   integraciones. Se autentica con un `integration_token` (fila revocable y
   auditada en la DB de hubb) que trae el scope `creators.read` y nada más.

   No compartimos base de datos: si hubb está caído, el resto de la app sigue
   funcionando y los creadores se capturan a mano.

   HUBB_API_URL tiene que ser https://www.hubb.mx CON el www: el apex redirige
   (307) al www, y en un redirect entre orígenes distintos fetch DESCARTA el
   header Authorization. El síntoma sería un 401 con un token perfectamente
   válido. assertWww() lo corrige solo para que nadie pierda la tarde en eso.

   La respuesta trae la fila completa de `creators`, así que normalizamos aquí
   los pocos campos que usa la propuesta. Ojo con dos trampas de esa data:
   `categories` (columna suelta) casi siempre viene null — las buenas están en
   `creator_categories[].category.name` — y los handles a veces vienen como URL
   completa en vez de handle. */

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

/** El endpoint tope a 50 por página; pedir más no falla, solo devuelve 50. */
export const HUBB_MAX_LIMIT = 50;

export function hubbReady(): boolean {
  return Boolean(process.env.HUBB_API_URL && process.env.HUBB_API_TOKEN);
}

function hubbBase(): string {
  const raw = (process.env.HUBB_API_URL || "").replace(/\/+$/, "");
  return raw.replace(/^(https?:\/\/)hubb\.mx/i, "$1www.hubb.mx");
}

export type CreatorQuery = {
  /** Matchea nombre, bio y ciudad. */
  q?: string;
  /** Nombre o slug de categoría: "belleza", "Fitness"… */
  category?: string;
  /** Estado, no ciudad: "Jalisco", "Nuevo León". La ciudad va en `q`. */
  state?: string;
  minFollowers?: number;
  maxFollowers?: number;
  limit?: number;
  offset?: number;
  /** El orden es aleatorio con semilla; repetirla mantiene estable el paginado. */
  seed?: string;
};

export type CreatorPage = {
  creators: HubbCreator[];
  total: number;
  hasMore: boolean;
  seed: string;
};

type RawSocial = { platform?: string; handle?: string | null; followers_count?: number | null };
type RawCreator = {
  id: string;
  bio?: string | null;
  location?: string | null;
  location_state?: string | null;
  follower_count?: number | null;
  engagement_rate?: number | null;
  instagram_handle?: string | null;
  instagram_followers_text?: string | null;
  tiktok_handle?: string | null;
  tiktok_followers_text?: string | null;
  price_per_video_min?: number | null;
  price_per_video_max?: number | null;
  portfolio_count?: number | null;
  is_verified?: boolean | null;
  profile?: { full_name?: string | null; avatar_url?: string | null } | null;
  social_accounts?: RawSocial[] | null;
  creator_categories?: { category?: { name?: string | null } | null }[] | null;
};

/** "https://www.tiktok.com/@dani" y "@dani" son el mismo handle. */
function handle(value?: string | null): string | null {
  if (!value) return null;
  const clean = value.trim().replace(/\/+$/, "");
  const last = clean.split("/").pop() || clean;
  return last.replace(/^@/, "") || null;
}

/** El número de social_accounts está más fresco; el texto suelto es el respaldo
    y puede venir como "10K-50K", así que se deja tal cual si toca usarlo. */
function followers(account: RawSocial | undefined, fallback?: string | null): string | null {
  const n = account?.followers_count;
  if (typeof n === "number" && n > 0) return n.toLocaleString("es-MX");
  return fallback?.trim() || null;
}

function normalize(raw: RawCreator, base: string): HubbCreator {
  const socials = raw.social_accounts ?? [];
  const ig = socials.find((s) => s.platform === "instagram");
  const tt = socials.find((s) => s.platform === "tiktok");

  const place = [raw.location, raw.location_state]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  // "Monterrey, Nuevo León", pero "Colima" y no "Colima, Colima".
  const location = [...new Set(place)].join(", ");

  return {
    id: raw.id,
    name: raw.profile?.full_name?.trim() || "Sin nombre",
    avatar: raw.profile?.avatar_url ?? null,
    bio: raw.bio?.trim() || undefined,
    location: location || undefined,
    categories: (raw.creator_categories ?? [])
      .map((c) => c.category?.name)
      .filter((n): n is string => Boolean(n)),
    followerCount: raw.follower_count ?? undefined,
    engagementRate: raw.engagement_rate ?? null,
    instagramHandle: handle(raw.instagram_handle) ?? handle(ig?.handle),
    instagramFollowers: followers(ig, raw.instagram_followers_text),
    tiktokHandle: handle(raw.tiktok_handle) ?? handle(tt?.handle),
    tiktokFollowers: followers(tt, raw.tiktok_followers_text),
    priceMin: raw.price_per_video_min ?? null,
    priceMax: raw.price_per_video_max ?? null,
    portfolioItems: raw.portfolio_count ?? undefined,
    portfolioUrl: `${base}/portfolio/${raw.id}`,
    verified: raw.is_verified ?? false,
  };
}

export async function searchHubbCreators(query: CreatorQuery): Promise<CreatorPage> {
  if (!hubbReady()) {
    throw new Error("Falta configurar HUBB_API_URL y HUBB_API_TOKEN.");
  }

  const base = hubbBase();
  const url = new URL("/api/external/creators", base);
  const set = (k: string, v: string | number | undefined) => {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  };

  set("search", query.q?.trim());
  set("category", query.category);
  set("state", query.state?.trim());
  set("followers_min", query.minFollowers);
  set("followers_max", query.maxFollowers);
  set("limit", Math.min(query.limit ?? HUBB_MAX_LIMIT, HUBB_MAX_LIMIT));
  set("offset", query.offset);
  set("seed", query.seed);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.HUBB_API_TOKEN}` },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  }).catch((err) => {
    throw new Error(`No respondió hubb: ${err?.message || err}`);
  });

  if (res.status === 401) {
    throw new Error("hubb rechazó el token: revisa HUBB_API_TOKEN (y que HUBB_API_URL lleve www).");
  }
  if (res.status === 403) {
    throw new Error("Al token de hubb le falta el scope creators.read.");
  }
  if (!res.ok) throw new Error(`hubb respondió ${res.status}.`);

  const data = (await res.json()) as {
    creators?: RawCreator[];
    totalCount?: number;
    hasMore?: boolean;
    seed?: string;
  };

  return {
    creators: (data.creators ?? []).map((c) => normalize(c, base)),
    total: data.totalCount ?? 0,
    hasMore: Boolean(data.hasMore),
    seed: data.seed ?? "",
  };
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
    portfolioUrl: c.portfolioUrl ?? `${hubbBase()}/portfolio/${c.id}`,
  };
}
