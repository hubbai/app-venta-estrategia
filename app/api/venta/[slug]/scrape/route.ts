/* Corre el scraping (Ad Library + IG + TikTok + buscador) y mezcla el
   resultado con lo que ya había, sin pisar lo que hayas escrito a mano.

   Es la llamada más cara de la app: gasta créditos de ScrapeCreators y baja
   imágenes a Blob. Por eso se dispara con un botón explícito, no al guardar. */
import { getProject } from "@/lib/projects";
import { getVenta, saveVenta } from "@/lib/venta/store";
import { runScrape } from "@/lib/scrape/research";
import { sugerirConsulta } from "@/lib/venta/consulta";
import { veredictos } from "@/lib/venta/owner";
import { scrapeReady } from "@/lib/scrape/scrapecreators";
import { requireSessionApi, apiError } from "@/lib/session";
import type { Research } from "@/lib/venta/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    await requireSessionApi();
    if (!scrapeReady()) {
      return Response.json(
        { error: "Falta SCRAPECREATORS_API_KEY. Mientras tanto llena el formulario a mano." },
        { status: 400 }
      );
    }

    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "No existe." }, { status: 404 });

    const current = await getVenta(project.id);
    const r = (current?.research ?? {}) as Research;
    const body = (await req.json().catch(() => ({}))) as { adPageId?: string; searchQuery?: string };

    /* El término de búsqueda decide qué sale en la slide 1, así que la primera
       vez no se usa el nombre pelón: "acapella" trae gente cantando, "apple"
       trae manzanas. Se propone nombre + categoría y queda editable. */
    let searchQuery = body.searchQuery ?? r.search?.query;
    let consultaPorque: string | undefined;
    if (!searchQuery) {
      const sug = await sugerirConsulta(project.brand, r.industry);
      searchQuery = sug.consulta;
      consultaPorque = sug.porque;
    }

    const scraped = await runScrape({
      slug: project.slug,
      brand: project.brand,
      site: r.site,
      instagramHandle: r.instagram?.handle,
      tiktokHandle: r.tiktok?.handle,
      adPageId: body.adPageId ?? r.adPageId,
      searchQuery,
      competitors: r.competitors,
      industry: r.industry,
    });

    /* Lo scrapeado gana sobre lo viejo, pero se conservan los campos que solo
       existen a mano (industria, notas, screenshots subidas). */
    const merged: Research = {
      ...r,
      ...scraped,
      instagram: { ...r.instagram, ...scraped.instagram },
      tiktok: { ...r.tiktok, ...scraped.tiktok },
      search: scraped.search ? { ...scraped.search, screenshot: r.search?.screenshot } : r.search,
      industry: r.industry,
      notes: r.notes,
    };

    await saveVenta(project.id, { research: merged, deck: current?.deck ?? null, engine: current?.engine });

    /* Si casi nada de lo que salió habla de la marca, el término está mal y hay
       que decirlo: es el error más común y el más caro, porque la slide 1 se
       llena de contenido ajeno sin que nadie lo note hasta la llamada. */
    const v = veredictos(merged.search?.results);
    const ruido = v.dominaElRuido
      ? `De los ${v.total} resultados de “${searchQuery}”, ${v.totalOtros} no hablan de la marca. Prueba un término más específico: el nombre más lo que venden.`
      : undefined;

    return Response.json({
      research: merged,
      sources: scraped.sources,
      consulta: consultaPorque ? { query: searchQuery, porque: consultaPorque } : undefined,
      ruido,
    });
  } catch (err) {
    return apiError(err);
  }
}
