/* Guardar el borrador editado y borrar la presentación. */
import { deleteProject, getProject } from "@/lib/projects";
import { getVenta, saveVenta } from "@/lib/venta/store";
import { requireSessionApi, apiError } from "@/lib/session";
import type { Deck, Research } from "@/lib/venta/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  try {
    await requireSessionApi();
    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "No existe." }, { status: 404 });

    const body = (await req.json()) as { research?: Research; deck?: Deck | null };
    const current = await getVenta(project.id);

    await saveVenta(project.id, {
      research: body.research ?? current?.research ?? ({} as Research),
      deck: body.deck !== undefined ? body.deck : (current?.deck ?? null),
      engine: current?.engine,
    });

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

    // El cascade se lleva research, renders y assets.
    await deleteProject(project.id);
    return Response.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
