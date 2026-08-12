/* scrapecreators.ts — Cliente de api.scrapecreators.com.

   Reemplaza el Chrome headless de research-pitch/src/adlibrary.js: mismos
   datos (page_id, anuncios activos, copy, fecha, creativo, video vs imagen)
   pero por HTTP, así corre en Vercel y no depende de la Mac de nadie.

   Cada llamada gasta créditos, así que el módulo NO cachea ni reintenta en
   bucle: una llamada por bloque, y el resultado se guarda en la DB. */

const BASE = "https://api.scrapecreators.com";
const TIMEOUT_MS = 45_000;

export function scrapeReady(): boolean {
  return Boolean(process.env.SCRAPECREATORS_API_KEY);
}

export class ScrapeError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const key = process.env.SCRAPECREATORS_API_KEY;
  if (!key) throw new ScrapeError("Falta SCRAPECREATORS_API_KEY.");

  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch((err) => {
    throw new ScrapeError(`No respondió ScrapeCreators: ${err?.message || err}`);
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // 402 = sin créditos. Vale la pena distinguirlo en la UI.
    const hint =
      res.status === 402
        ? "Se acabaron los créditos de ScrapeCreators."
        : res.status === 401
          ? "La SCRAPECREATORS_API_KEY no es válida."
          : detail.slice(0, 200);
    throw new ScrapeError(hint || `ScrapeCreators respondió ${res.status}`, res.status);
  }

  const json = (await res.json()) as T & { error?: string; message?: string; errorStatus?: number };

  /* Un handle que no existe NO devuelve 404: devuelve 200 con success:true y el
     error adentro del cuerpo. Si no se revisa aquí, el bloque falla más abajo
     con un "no devolvió el perfil" que suena a que el scraper está roto, cuando
     lo que pasa es que la cuenta está mal escrita. */
  if (typeof json?.error === "string" && json.error) {
    throw new ScrapeError(json.message || json.error, json.errorStatus);
  }

  return json as T;
}

/* ── Meta Ad Library ─────────────────────────────────────────────────── */

export type Company = {
  page_id: string;
  name: string;
  category?: string;
  image_uri?: string;
  likes?: number;
  verification?: string;
  ig_username?: string;
  ig_followers?: number;
  page_alias?: string;
  page_is_deleted?: boolean;
};

export async function searchCompanies(query: string): Promise<Company[]> {
  const data = await get<{ searchResults?: Company[]; results?: Company[] }>(
    "/v1/facebook/adLibrary/search/companies",
    { query }
  );
  const list = data.searchResults ?? data.results ?? [];
  return list.filter((c) => !c.page_is_deleted);
}

/* El snapshot del anuncio cambia de forma según el formato (imagen, video,
   carrusel). No documentan el shape completo, así que se lee defensivamente. */
export type RawAd = {
  ad_archive_id: string;
  is_active?: boolean;
  start_date?: number;
  page_name?: string;
  publisher_platform?: string[];
  snapshot?: Record<string, unknown>;
};

export async function companyAds(opts: {
  pageId?: string;
  companyName?: string;
  country?: string;
  status?: "ALL" | "ACTIVE" | "INACTIVE";
}): Promise<RawAd[]> {
  const data = await get<{ results?: RawAd[] }>("/v1/facebook/adLibrary/company/ads", {
    pageId: opts.pageId,
    companyName: opts.pageId ? undefined : opts.companyName,
    country: opts.country ?? "MX",
    status: opts.status ?? "ACTIVE",
    media_type: "ALL",
  });
  return data.results ?? [];
}

/* ── Instagram ───────────────────────────────────────────────────────── */

export type RawIgProfile = {
  data?: {
    user?: {
      username?: string;
      full_name?: string;
      biography?: string;
      profile_pic_url_hd?: string;
      profile_pic_url?: string;
      is_verified?: boolean;
      edge_followed_by?: { count?: number };
      edge_owner_to_timeline_media?: {
        count?: number;
        edges?: { node?: Record<string, unknown> }[];
      };
    };
  };
};

export async function instagramProfile(handle: string): Promise<RawIgProfile> {
  return get<RawIgProfile>("/v1/instagram/profile", { handle: clean(handle) });
}

/* ── TikTok ──────────────────────────────────────────────────────────── */

export type RawTtProfile = {
  user?: {
    id?: string;
    uniqueId?: string;
    nickname?: string;
    avatarLarger?: string;
    avatarMedium?: string;
    signature?: string;
    verified?: boolean;
  };
  stats?: { followerCount?: number; heart?: number; videoCount?: number };
};

export async function tiktokProfile(handle: string): Promise<RawTtProfile> {
  return get<RawTtProfile>("/v1/tiktok/profile", { handle: clean(handle) });
}

export type RawTtVideo = {
  aweme_id?: string;
  desc?: string;
  share_url?: string;
  is_top?: number;
  statistics?: { play_count?: number; digg_count?: number; comment_count?: number };
  video?: {
    dynamic_cover?: { url_list?: string[] };
    animated_cover?: { url_list?: string[] };
    cover?: { url_list?: string[] };
  };
  author?: { unique_id?: string; nickname?: string };
};

export async function tiktokProfileVideos(handle: string): Promise<RawTtVideo[]> {
  const data = await get<{ aweme_list?: RawTtVideo[] }>("/v3/tiktok/profile/videos", {
    handle: clean(handle),
    sort_by: "popular",
    region: "MX",
  });
  return data.aweme_list ?? [];
}

export async function tiktokKeywordSearch(query: string): Promise<RawTtVideo[]> {
  const data = await get<{ search_item_list?: { aweme_info?: RawTtVideo }[]; aweme_list?: RawTtVideo[] }>(
    "/v1/tiktok/search/keyword",
    { query, region: "MX" }
  );
  if (data.aweme_list?.length) return data.aweme_list;
  // TikTok devuelve duplicados en este endpoint; se deduplican por aweme_id.
  const items = (data.search_item_list ?? []).map((x) => x.aweme_info).filter(Boolean) as RawTtVideo[];
  const seen = new Set<string>();
  return items.filter((v) => {
    const id = v.aweme_id ?? "";
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function clean(handle: string): string {
  return handle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(tiktok|instagram)\.com\/@?/, "").replace(/\/.*$/, "");
}
