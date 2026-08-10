/* Guardar el borrador editado y borrar la estrategia. */
import { deleteProject, getProject } from "@/lib/projects";
import { getEstrategia, saveEstrategia } from "@/lib/estrategia/store";
import { requireSessionApi, apiError } from "@/lib/session";
import type { Estrategia } from "@/lib/estrategia/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  try {
    await requireSessionApi();
    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "No existe." }, { status: 404 });

    const { estrategia } = (await req.json()) as { estrategia?: Estrategia };
    if (!estrategia) return Response.json({ error: "Falta la estrategia." }, { status: 400 });

    const current = await getEstrategia(project.id);
    await saveEstrategia(project.id, { ...estrategia, brand: project.brand }, current?.sourceDocUrl);

    return Response.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireSessionApi();
    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "No existe." }, { status: 404 });

    await deleteProject(project.id);
    return Response.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
