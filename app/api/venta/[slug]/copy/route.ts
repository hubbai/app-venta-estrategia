/* Le pide a Claude el copy de las 3 slides a partir del research ya revisado.
   Se puede volver a llamar cuantas veces quieras: cada corrida sobrescribe el
   deck del borrador, nunca lo publicado. */
import { getProject } from "@/lib/projects";
import { getVenta, saveVenta } from "@/lib/venta/store";
import { buildDeck } from "@/lib/venta/copy";
import { requireSessionApi, apiError } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    await requireSessionApi();
    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "No existe." }, { status: 404 });

    const current = await getVenta(project.id);
    if (!current?.research) return Response.json({ error: "Todavía no hay research." }, { status: 400 });

    const { deck, engine } = await buildDeck(current.research);
    await saveVenta(project.id, { research: current.research, deck, engine });

    return Response.json({ deck, engine });
  } catch (err) {
    return apiError(err);
  }
}
