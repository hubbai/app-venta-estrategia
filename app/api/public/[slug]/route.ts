/* Lo que consume fs.hubb.mx/r/{slug}.

   Es la única ruta pública de la app: devuelve el HTML ya publicado, tal cual.
   No pasa por el proxy de sesión (está en su lista blanca), así que se protege
   con un token compartido con full_service — sin él cualquiera podría
   enumerar los slugs de marcas que aún no ven la propuesta.

   Si PUBLIC_API_TOKEN no está configurado, se sirve abierto: es el modo de
   arranque, para no bloquear el puente antes de generar el token. */
import { getPublishedHtml } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const expected = process.env.PUBLIC_API_TOKEN;
  if (expected) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${expected}`) {
      return new Response("No autorizado.", { status: 401 });
    }
  }

  const { slug } = await ctx.params;
  const safe = slug.replace(/[^a-z0-9-]/gi, "");

  const html = await getPublishedHtml(safe).catch((err) => {
    console.error("[public]", err);
    return null;
  });
  if (!html) return new Response("No encontrado.", { status: 404 });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}
