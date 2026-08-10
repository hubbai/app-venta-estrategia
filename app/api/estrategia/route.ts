/* Crea la estrategia de una marca. El documento de Henry se sube después,
   desde el editor, para no bloquear la creación si todavía no lo tienes. */
import { createProject } from "@/lib/projects";
import { saveEstrategia } from "@/lib/estrategia/store";
import { emptyEstrategia } from "@/lib/estrategia/types";
import { requireSessionApi, apiError } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await requireSessionApi();
    const { brand } = (await req.json()) as { brand?: string };
    if (!brand?.trim()) return Response.json({ error: "Falta el nombre de la marca." }, { status: 400 });

    const project = await createProject({ brand, kind: "estrategia", createdBy: session.uid });
    await saveEstrategia(project.id, emptyEstrategia(project.brand));

    return Response.json({ slug: project.slug });
  } catch (err) {
    return apiError(err);
  }
}
