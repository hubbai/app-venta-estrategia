/* Desambiguador de la Ad Library: buscar "resilient" trae varios anunciantes
   con el mismo nombre. Eliges cuál es y a partir de ahí todo se pide por
   page_id, que es lo único que devuelve el conteo real de anuncios. */
import { searchCompanies, scrapeReady } from "@/lib/scrape/scrapecreators";
import { requireSessionApi, apiError } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireSessionApi();
    if (!scrapeReady()) return Response.json({ error: "Falta SCRAPECREATORS_API_KEY." }, { status: 400 });

    const query = new URL(req.url).searchParams.get("q")?.trim();
    if (!query) return Response.json({ companies: [] });

    const companies = await searchCompanies(query);
    return Response.json({ companies: companies.slice(0, 8) });
  } catch (err) {
    return apiError(err);
  }
}
