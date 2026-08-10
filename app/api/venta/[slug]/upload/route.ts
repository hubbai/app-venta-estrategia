/* Subida manual de imágenes: el fallback para cuando ScrapeCreators no trae
   algo (marca que no aparece en la Ad Library, perfil privado) o cuando
   prefieres la captura real del perfil o del buscador.

   `field` dice a dónde va: instagram | tiktok | busqueda. */
import { getProject } from "@/lib/projects";
import { getVenta, saveVenta } from "@/lib/venta/store";
import { blobReady, upload } from "@/lib/blob";
import { requireSessionApi, apiError } from "@/lib/session";
import type { Research } from "@/lib/venta/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const FIELDS = new Set(["instagram", "tiktok", "busqueda"]);

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    await requireSessionApi();
    if (!blobReady()) {
      return Response.json({ error: "Falta BLOB_READ_WRITE_TOKEN para poder subir imágenes." }, { status: 400 });
    }

    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "No existe." }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    const field = String(form.get("field") || "");

    if (!(file instanceof File)) return Response.json({ error: "Falta el archivo." }, { status: 400 });
    if (!FIELDS.has(field)) return Response.json({ error: "Campo inválido." }, { status: 400 });
    if (!file.type.startsWith("image/")) return Response.json({ error: "Solo imágenes." }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ error: "Máximo 10 MB." }, { status: 400 });

    const url = await upload(file, `${project.slug}/manual/${field}`);

    const doc = await getVenta(project.id);
    const r = (doc?.research ?? {}) as Research;
    if (field === "instagram") r.instagram = { ...r.instagram, screenshot: url };
    if (field === "tiktok") r.tiktok = { ...r.tiktok, screenshot: url };
    if (field === "busqueda") r.search = { query: r.search?.query || project.brand, results: r.search?.results ?? [], screenshot: url };

    r.sources = { ...r.sources, [field]: "manual" };
    await saveVenta(project.id, { research: r, deck: doc?.deck ?? null, engine: doc?.engine });

    return Response.json({ url });
  } catch (err) {
    return apiError(err);
  }
}
