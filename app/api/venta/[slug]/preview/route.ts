/* Renderiza el borrador sin publicarlo. Es lo que carga el iframe del editor,
   así ves exactamente lo que vas a compartir antes de darle publicar. */
import { getProject } from "@/lib/projects";
import { getVenta } from "@/lib/venta/store";
import { fallbackDeck } from "@/lib/venta/copy";
import { renderVenta } from "@/lib/venta/render";
import { requireSessionApi, apiError } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    await requireSessionApi();
    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return new Response("No existe.", { status: 404 });

    const doc = await getVenta(project.id);
    if (!doc?.research) return new Response("Todavía no hay research.", { status: 400 });

    // Sin deck generado, se previsualiza con el copy determinista para que la
    // slide nunca salga vacía mientras armas el research.
    const deck = doc.deck ?? fallbackDeck(doc.research);
    const html = renderVenta({ ...doc.research, brand: project.brand }, deck);

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return apiError(err);
  }
}
