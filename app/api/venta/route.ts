/* Crea la presentación de una llamada de venta. Solo pide la marca; el resto
   se llena scrapeando o a mano desde el editor. */
import { createProject } from "@/lib/projects";
import { saveVenta } from "@/lib/venta/store";
import { emptyResearch } from "@/lib/venta/types";
import { requireSessionApi, apiError } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await requireSessionApi();
    const body = (await req.json()) as {
      brand?: string;
      site?: string;
      industry?: string;
      instagramHandle?: string;
      tiktokHandle?: string;
      /* Viene del autocompletado: el anunciante ya identificado. */
      adPageId?: string;
    };

    if (!body.brand?.trim()) {
      return Response.json({ error: "Falta el nombre de la marca." }, { status: 400 });
    }

    const project = await createProject({ brand: body.brand, kind: "venta", createdBy: session.uid });

    const research = emptyResearch(project.brand);
    research.site = body.site?.trim();
    research.industry = body.industry?.trim() || "";
    if (body.adPageId?.trim()) research.adPageId = body.adPageId.trim();
    if (body.instagramHandle?.trim()) research.instagram = { handle: clean(body.instagramHandle) };
    if (body.tiktokHandle?.trim()) research.tiktok = { handle: clean(body.tiktokHandle) };

    await saveVenta(project.id, { research, deck: null });

    return Response.json({ slug: project.slug });
  } catch (err) {
    return apiError(err);
  }
}

function clean(h: string): string {
  return h.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(tiktok|instagram)\.com\/@?/, "").replace(/\/.*$/, "");
}
