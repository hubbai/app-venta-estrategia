/* Índice de lo publicado, para que full_service lo sume a su listado /r.
   Solo metadatos: nada de research ni de borradores. */
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = process.env.PUBLIC_API_TOKEN;
  if (expected && req.headers.get("authorization") !== `Bearer ${expected}`) {
    return new Response("No autorizado.", { status: 401 });
  }

  try {
    const items = await sql<{ slug: string; brand: string; kind: string; date: string }[]>`
      select p.slug, p.brand, p.kind, coalesce(p.published_at, p.updated_at) as date
      from projects p
      where p.status = 'published'
      order by date desc
      limit 500
    `;
    return Response.json({ items }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (err) {
    console.error("[public:index]", err);
    return Response.json({ items: [] });
  }
}
