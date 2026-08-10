/* Congela el HTML y lo marca como publicado. A partir de aquí
   fs.hubb.mx/r/{slug} lo sirve, sin deploys ni commits de por medio. */
import { getProject, publishProject, unpublishProject } from "@/lib/projects";
import { getVenta } from "@/lib/venta/store";
import { fallbackDeck } from "@/lib/venta/copy";
import { renderVenta } from "@/lib/venta/render";
import { requireSessionApi, apiError } from "@/lib/session";

export const runtime = "nodejs";

const SITE = process.env.NEXT_PUBLIC_SITE_BASE || "https://fs.hubb.mx";

export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    await requireSessionApi();
    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "No existe." }, { status: 404 });

    const doc = await getVenta(project.id);
    if (!doc?.research) return Response.json({ error: "Todavía no hay research." }, { status: 400 });

    const html = renderVenta({ ...doc.research, brand: project.brand }, doc.deck ?? fallbackDeck(doc.research));
    await publishProject(project.id, html);

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
