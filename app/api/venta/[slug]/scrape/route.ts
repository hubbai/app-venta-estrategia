/* Corre el scraping (Ad Library + IG + TikTok + buscador) y mezcla el
   resultado con lo que ya había, sin pisar lo que hayas escrito a mano.

   Es la llamada más cara de la app: gasta créditos de ScrapeCreators y baja
   imágenes a Blob. Por eso se dispara con un botón explícito, no al guardar. */
import { getProject } from "@/lib/projects";
import { getVenta, saveVenta } from "@/lib/venta/store";
import { runScrape } from "@/lib/scrape/research";
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

    const scraped = await runScrape({
      slug: project.slug,
      brand: project.brand,
      site: r.site,
      instagramHandle: r.instagram?.handle,
      tiktokHandle: r.tiktok?.handle,
      adPageId: body.adPageId ?? r.adPageId,
      searchQuery: body.searchQuery ?? r.search?.query ?? project.brand,
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

    return Response.json({ research: merged, sources: scraped.sources });
  } catch (err) {
    return apiError(err);
  }
}
