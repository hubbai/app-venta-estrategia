import { getProject } from "@/lib/projects";
import { getEstrategia } from "@/lib/estrategia/store";
import { renderEstrategia } from "@/lib/estrategia/render";
import { requireSessionApi, apiError } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    await requireSessionApi();
    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return new Response("No existe.", { status: 404 });

    const doc = await getEstrategia(project.id);
    if (!doc) return new Response("Todavía no hay estrategia.", { status: 400 });

    return new Response(renderEstrategia({ ...doc.data, brand: project.brand }), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return apiError(err);
  }
}
