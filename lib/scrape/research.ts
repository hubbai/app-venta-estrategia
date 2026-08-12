/* research.ts — Convierte lo que devuelve ScrapeCreators en el Research que
   llena el formulario.

   Cada bloque es independiente y se resuelve en paralelo: si TikTok falla, el
   de Ads igual llega y tú capturas ese pedazo a mano. Lo que salió y lo que no
   queda anotado en `sources` para pintarlo en la UI. */
import {
  companyAds,
  instagramProfile,
  searchCompanies,
  tiktokKeywordSearch,
  tiktokProfile,
  tiktokProfileVideos,
  type RawAd,
  type RawTtVideo,
} from "./scrapecreators";
import { mirror } from "../blob";
import type { Ad, Clip, Profile, Research } from "../venta/types";

type Sources = NonNullable<Research["sources"]>;
type Errors = NonNullable<Research["sourceErrors"]>;

/* Cada bloque anota aquí por qué se quedó vacío. "Account doesn't exist" es
   accionable —el handle está mal escrito—; "falló" a secas no lo es. */
function anota(errors: Errors, bloque: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  errors[bloque] = msg || "Error desconocido.";
}

export type ScrapeInput = {
  slug: string;
  brand: string;
  site?: string;
  instagramHandle?: string;
  tiktokHandle?: string;
  /* Si ya elegiste el anunciante en el desambiguador, se manda su page_id. */
  adPageId?: string;
  searchQuery?: string;
};

export async function runScrape(input: ScrapeInput): Promise<Partial<Research>> {
  const sources: Sources = {};
  const errors: Errors = {};
  const query = (input.searchQuery || input.brand).trim();

  const [ads, ig, tt, ttVideos, search] = await Promise.all([
    scrapeAds(input, sources, errors),
    input.instagramHandle ? scrapeInstagram(input, sources, errors) : null,
    input.tiktokHandle ? scrapeTiktokProfile(input, sources, errors) : null,
    input.tiktokHandle ? scrapeTiktokVideos(input, sources, errors) : null,
    scrapeSearch(input.slug, query, sources, errors),
  ]);

  const ownClips = ttVideos ?? [];
  const own = (input.tiktokHandle || "").replace(/^@/, "").toLowerCase();
  const creatorClips = (search?.results ?? []).filter((c) => !esDeLaMarca(c.author, own, input.brand)).slice(0, 2);

  const bestOwn = ownClips[0]?.viewsNum ?? 0;
  const bestCreator = creatorClips[0]?.viewsNum ?? 0;
  const bestContent: Research["bestContent"] =
    bestCreator > 0 && bestCreator > bestOwn ? "creador" : bestOwn > 0 ? "marca" : "nodata";

  return {
    ...ads,
    instagram: ig ?? undefined,
    tiktok: tt ?? undefined,
    networks: buildNetworks(ig, tt, ownClips),
    organic: { brand: ownClips.slice(0, 2), creators: creatorClips },
    search: search ?? undefined,
    bestContent,
    bestViews: bestContent === "creador" ? creatorClips[0]?.views : ownClips[0]?.views,
    ownViews: ownClips[0]?.views,
    scrapedAt: new Date().toISOString(),
    sources,
    sourceErrors: errors,
  };
}

/* ── Paid media ──────────────────────────────────────────────────────── */

async function scrapeAds(input: ScrapeInput, sources: Sources, errors: Errors): Promise<Partial<Research>> {
  try {
    let pageId = input.adPageId;
    if (!pageId) {
      const companies = await searchCompanies(input.brand);
      pageId = companies[0]?.page_id;
      if (!pageId) {
        sources.ads = "fallo";
        errors.ads = `No hay ningún anunciante llamado "${input.brand}" en la Ad Library de México.`;
        return { adCount: 0, ads: [] };
      }
    }

    const raw = await companyAds({ pageId, country: "MX", status: "ACTIVE" });
    const active = raw.filter((a) => a.is_active !== false);

    // Solo se copian los 4 creativos que caben en la slide; bajar los 23 de
    // RESILIENT costaría medio minuto y no se ven.
    const ads: Ad[] = await Promise.all(
      active.slice(0, 4).map(async (a, i) => {
        const parsed = parseAd(a);
        return { ...parsed, image: await mirror(parsed.image ?? undefined, `${input.slug}/ads/ad-${i + 1}`) };
      })
    );

    const videoCount = active.filter((a) => parseAd(a).isVideo).length;
    const started = active
      .map((a) => a.start_date)
      .filter((d): d is number => typeof d === "number" && d > 0)
      .sort((a, b) => a - b)[0];

    sources.ads = "ok";
    return {
      adPageId: pageId,
      adCount: active.length,
      adVideoCount: videoCount,
      adImageCount: active.length - videoCount,
      ads,
      adFormat: describeMix(active.length - videoCount, videoCount),
      adHooks: ads.map((a) => a.text).filter(Boolean).slice(0, 3).join("; "),
      adOldest: started ? fmtDate(started) : undefined,
      adLibraryUrl: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=MX&view_all_page_id=${pageId}&media_type=all`,
    };
  } catch (err) {
    console.error("[scrape:ads]", err);
    sources.ads = "fallo";
    anota(errors, "ads", err);
    return { adCount: 0, ads: [] };
  }
}

/* El snapshot no tiene un shape documentado y cambia por formato, así que se
   prueban las rutas conocidas en orden y se cae con gracia. */
function parseAd(a: RawAd): Ad {
  const s = (a.snapshot ?? {}) as Record<string, any>;

  const text: string =
    s.body?.text ??
    s.body?.markup?.__html ??
    s.cards?.[0]?.body ??
    s.title ??
    s.link_description ??
    "";

  const videos = Array.isArray(s.videos) ? s.videos : [];
  const images = Array.isArray(s.images) ? s.images : [];
  const cards = Array.isArray(s.cards) ? s.cards : [];
  const isVideo = videos.length > 0 || s.display_format === "VIDEO";

  const image: string | undefined =
    videos[0]?.video_preview_image_url ??
    images[0]?.resized_image_url ??
    images[0]?.original_image_url ??
    cards[0]?.resized_image_url ??
    cards[0]?.original_image_url ??
    cards[0]?.video_preview_image_url;

  return {
    text: String(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    started: a.start_date ? fmtDate(a.start_date) : undefined,
    isVideo,
    duration: null,
    image: image ?? null,
  };
}

function describeMix(images: number, videos: number): string {
  if (videos === 0) return "solo estáticos";
  if (images === 0) return "solo video";
  return videos > images ? "mezcla: video dominante" : "mezcla: estático dominante + video";
}

function fmtDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ── Orgánico ────────────────────────────────────────────────────────── */

async function scrapeInstagram(input: ScrapeInput, sources: Sources, errors: Errors): Promise<Profile | null> {
  try {
    const raw = await instagramProfile(input.instagramHandle!);
    const u = raw.data?.user;
    if (!u) throw new Error("Instagram no devolvió el perfil.");

    const followers = u.edge_followed_by?.count ?? 0;
    sources.instagram = "ok";
    return {
      handle: u.username,
      name: u.full_name,
      bio: u.biography,
      verified: u.is_verified,
      followers: nFmt(followers),
      followersNum: followers,
      posts: nFmt(u.edge_owner_to_timeline_media?.count ?? 0),
      avatar: await mirror(u.profile_pic_url_hd ?? u.profile_pic_url, `${input.slug}/ig/avatar`),
    };
  } catch (err) {
    console.error("[scrape:instagram]", err);
    sources.instagram = "fallo";
    anota(errors, "instagram", err);
    return null;
  }
}

async function scrapeTiktokProfile(input: ScrapeInput, sources: Sources, errors: Errors): Promise<Profile | null> {
  try {
    const raw = await tiktokProfile(input.tiktokHandle!);
    const u = raw.user;
    if (!u) throw new Error("TikTok no devolvió el perfil.");

    const followers = raw.stats?.followerCount ?? 0;
    sources.tiktok = "ok";
    return {
      handle: u.uniqueId,
      name: u.nickname,
      bio: u.signature,
      verified: u.verified,
      followers: nFmt(followers),
      followersNum: followers,
      posts: nFmt(raw.stats?.videoCount ?? 0),
      avatar: await mirror(u.avatarLarger ?? u.avatarMedium, `${input.slug}/tt/avatar`),
    };
  } catch (err) {
    console.error("[scrape:tiktok]", err);
    sources.tiktok = "fallo";
    anota(errors, "tiktok", err);
    return null;
  }
}

async function scrapeTiktokVideos(input: ScrapeInput, sources: Sources, errors: Errors): Promise<Clip[] | null> {
  try {
    const raw = await tiktokProfileVideos(input.tiktokHandle!);
    const top = sortByViews(raw).slice(0, 2);
    sources.videos = "ok";
    return Promise.all(top.map((v, i) => toClip(v, `${input.slug}/tt/propio-${i + 1}`)));
  } catch (err) {
    console.error("[scrape:videos]", err);
    sources.videos = "fallo";
    anota(errors, "videos", err);
    return null;
  }
}

async function scrapeSearch(
  slug: string,
  query: string,
  sources: Sources,
  errors: Errors
): Promise<{ query: string; results: Clip[] } | null> {
  try {
    const raw = await tiktokKeywordSearch(query);
    const top = sortByViews(raw).slice(0, 6);
    sources.busqueda = "ok";
    return { query, results: await Promise.all(top.map((v, i) => toClip(v, `${slug}/buscador/${i + 1}`))) };
  } catch (err) {
    console.error("[scrape:search]", err);
    sources.busqueda = "fallo";
    anota(errors, "busqueda", err);
    return null;
  }
}

/* ¿Ese video del buscador es de la marca disfrazada de creador?

   La slide 3 afirma que los primeros resultados los subió gente que NO trabaja
   con la marca. Si ahí se cuela una cuenta secundaria de la propia marca, la
   afirmación es falsa y se dice en voz alta frente al cliente. Comparar solo
   contra el handle configurado no basta: RESILIENT es @rslnt_mx en TikTok, pero
   su otra cuenta es @resilientclub1.

   Se descarta al autor cuyo handle contenga el nombre de la marca ya
   normalizado. Es estrecho a propósito: para RESILIENT saca a
   "resilientclub1" y deja pasar "resilienciaclub", que no lo contiene. Si de
   todos modos se cuela algo, se quita desde el editor. */
function esDeLaMarca(author: string | undefined, ownHandle: string, brand: string): boolean {
  const a = (author || "").toLowerCase();
  if (!a) return false;
  if (a === ownHandle) return true;

  const key = brand.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Marcas de nombre muy corto darían falsos positivos por todos lados.
  if (key.length < 5) return false;
  return a.replace(/[^a-z0-9]/g, "").includes(key);
}

function sortByViews(list: RawTtVideo[]): RawTtVideo[] {
  return [...list].sort((a, b) => (b.statistics?.play_count ?? 0) - (a.statistics?.play_count ?? 0));
}

async function toClip(v: RawTtVideo, key: string): Promise<Clip> {
  const views = v.statistics?.play_count ?? 0;
  const cover =
    v.video?.dynamic_cover?.url_list?.[0] ??
    v.video?.cover?.url_list?.[0] ??
    v.video?.animated_cover?.url_list?.[0];

  return {
    url: v.share_url,
    views: nFmt(views),
    viewsNum: views,
    author: v.author?.unique_id,
    title: (v.desc || "").slice(0, 140),
    image: await mirror(cover, key),
  };
}

function buildNetworks(ig: Profile | null, tt: Profile | null, ownClips: Clip[]) {
  const reach = ownClips.length
    ? `${nFmt(Math.min(...ownClips.map((c) => c.viewsNum ?? 0)))} - ${nFmt(Math.max(...ownClips.map((c) => c.viewsNum ?? 0)))} views`
    : undefined;

  return [
    {
      name: "Instagram",
      active: Boolean(ig),
      followers: ig?.followers,
      content: ig?.bio ? "" : undefined,
    },
    {
      name: "TikTok",
      active: Boolean(tt),
      followers: tt?.followers,
      reach,
    },
  ];
}

/* 1234 → "1,234"; 11800 → "11.8K". Igual que se lee en la app de TikTok. */
export function nFmt(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1000) return String(n);
  if (n < 10_000) return n.toLocaleString("en-US");
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
