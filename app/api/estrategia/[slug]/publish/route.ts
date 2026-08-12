import { getProject, publishProject, unpublishProject } from "@/lib/projects";
import { getEstrategia, saveEstrategia } from "@/lib/estrategia/store";
import { renderEstrategia } from "@/lib/estrategia/render";
import { requireSessionApi, apiError } from "@/lib/session";
import { mirror } from "@/lib/blob";
import type { Creador } from "@/lib/estrategia/types";

export const runtime = "nodejs";

const SITE = process.env.NEXT_PUBLIC_SITE_BASE || "https://fs.hubb.mx";

/* Las fotos de los creadores viven en el bucket de hubb. Todo lo demás del
   creador se congela al elegirlo, así que la foto también: si allá cambian de
   avatar o limpian el bucket, la propuesta que ya mandaste no se altera ni se
   queda con un hueco. Se copia una sola vez — las que ya están en Blob se
   dejan como están. */
async function congelarAvatares(creadores: Creador[]): Promise<Creador[]> {
  return Promise.all(
    creadores.map(async (c) => {
      if (!c.avatar || c.avatar.includes("blob.vercel-storage.com")) return c;
      const copia = await mirror(c.avatar, `creadores/${c.id}.jpg`);
      // mirror() devuelve null si falla; mejor la foto de hubb que ninguna.
      return copia ? { ...c, avatar: copia } : c;
    }),
  );
}

export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    await requireSessionApi();
    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "No existe." }, { status: 404 });

    const doc = await getEstrategia(project.id);
    if (!doc) return Response.json({ error: "Todavía no hay estrategia." }, { status: 400 });

    const data = {
      ...doc.data,
      brand: project.brand,
      creadores: await congelarAvatares(doc.data.creadores ?? []),
    };
    // Se guarda el borrador con las fotos ya copiadas para no volver a bajarlas
    // en cada publicada, y para que el editor muestre lo mismo que el link.
    await saveEstrategia(project.id, data, doc.sourceDocUrl);
    await publishProject(project.id, renderEstrategia(data));
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
