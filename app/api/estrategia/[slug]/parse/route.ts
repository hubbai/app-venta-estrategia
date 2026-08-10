/* Sube el documento de Henry y lo convierte en la estrategia estructurada.

   Acepta PDF (Claude lo lee nativo, con formato y tablas) o texto pegado. Un
   .docx habría que descomprimirlo para leerlo, así que se pide exportarlo a
   PDF — un paso, y sale mejor parseado.

   Se conservan los creadores ya elegidos: reparsear el documento no debe
   borrar la selección del portafolio. */
import { getProject } from "@/lib/projects";
import { getEstrategia, saveEstrategia } from "@/lib/estrategia/store";
import { parseEstrategia, type DocSource } from "@/lib/estrategia/parse";
import { blobReady, upload } from "@/lib/blob";
import { requireSessionApi, apiError } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    await requireSessionApi();
    const { slug } = await ctx.params;
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "No existe." }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    const pasted = String(form.get("text") || "").trim();

    let doc: DocSource;
    let docUrl: string | null = null;

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) return Response.json({ error: "El documento pasa de 25 MB." }, { status: 400 });

      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isText = file.type.startsWith("text/") || /\.(txt|md|markdown)$/i.test(file.name);

      if (!isPdf && !isText) {
        return Response.json(
          { error: "Solo PDF o texto. Si es un Word o un Google Doc, expórtalo a PDF y vuelve a subirlo." },
          { status: 400 }
        );
      }

      const buf = Buffer.from(await file.arrayBuffer());
      doc = isPdf
        ? { kind: "pdf", base64: buf.toString("base64"), name: file.name }
        : { kind: "text", text: buf.toString("utf8"), name: file.name };

      // Se guarda el original para poder reparsear después sin volver a pedirlo.
      if (blobReady()) docUrl = await upload(file, `${project.slug}/doc/${file.name}`).catch(() => null);
    } else if (pasted) {
      doc = { kind: "text", text: pasted, name: "texto pegado" };
    } else {
      return Response.json({ error: "Sube el documento o pega el texto." }, { status: 400 });
    }

    const parsed = await parseEstrategia(project.brand, doc);

    const current = await getEstrategia(project.id);
    const next = { ...parsed, creadores: current?.data.creadores ?? [] };

    await saveEstrategia(project.id, next, docUrl);
    return Response.json({ estrategia: next });
  } catch (err) {
    return apiError(err);
  }
}
