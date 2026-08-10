import { getProject, publishProject, unpublishProject } from "@/lib/projects";
import { getEstrategia } from "@/lib/estrategia/store";
import { renderEstrategia } from "@/lib/estrategia/render";
import { requireSessionApi, apiError } from "@/lib/session";

export const runtime = "nodejs";

const SITE = process.env.NEXT_PUBLIC_SITE_BASE || "https://fs.hubb.mx";

export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    await requireSessionApi();
    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "No existe." }, { status: 404 });

    const doc = await getEstrategia(project.id);
    if (!doc) return Response.json({ error: "Todavía no hay estrategia." }, { status: 400 });

    await publishProject(project.id, renderEstrategia({ ...doc.data, brand: project.brand }));
    return Response.json({ url: `${SITE}/r/${project.slug}` });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    await requireSessionApi();
    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "No existe." }, { status: 404 });

    await unpublishProject(project.id);
    return Response.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
