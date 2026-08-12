/* Proxy autenticado al buscador de creadores de hubb.

   Va por el servidor y no desde el navegador para que el HUBB_API_TOKEN nunca
   llegue al cliente. */
import { searchHubbCreators, hubbReady } from "@/lib/hubb";
import { requireSessionApi, apiError } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireSessionApi();
    if (!hubbReady()) {
      return Response.json({ error: "Falta HUBB_API_URL / HUBB_API_TOKEN.", creators: [] }, { status: 400 });
    }

    const p = new URL(req.url).searchParams;
    const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);

    const page = await searchHubbCreators({
      q: p.get("q") ?? undefined,
      category: p.get("category") ?? undefined,
      state: p.get("state") ?? undefined,
      minFollowers: num("minFollowers"),
      maxFollowers: num("maxFollowers"),
      limit: num("limit"),
      offset: num("offset"),
      // Sin semilla el orden se rebaraja en cada request y "Cargar más" repetiría
      // o se saltaría creadores; el cliente la reenvía tal cual.
      seed: p.get("seed") ?? undefined,
    });

    return Response.json(page);
  } catch (err) {
    return apiError(err);
  }
}
