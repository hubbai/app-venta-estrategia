/* Notas de estilo del equipo. Pesan MÁS que las reglas base del prompt: son lo
   último que aprendimos sobre cómo debe sonar el copy, así que van al final del
   system prompt y ganan si contradicen algo anterior.

   Es el equivalente en DB del style-notes.md de research-pitch. */
import { sql } from "@/lib/db";
import { requireSessionApi, apiError } from "@/lib/session";

export const runtime = "nodejs";

const SCOPES = new Set(["venta", "estrategia"]);

export type StyleNote = {
  id: string;
  scope: "venta" | "estrategia";
  note: string;
  author: string | null;
  created_at: string;
};

export async function GET() {
  try {
    await requireSessionApi();
    const notes = await sql<StyleNote[]>`
      select s.id, s.scope, s.note, s.created_at, u.name as author
      from style_notes s
      left join users u on u.id = s.created_by
      order by s.created_at asc
    `;
    return Response.json({ notes });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionApi();
    const { scope, note } = (await req.json()) as { scope?: string; note?: string };

    if (!note?.trim()) return Response.json({ error: "Falta la nota." }, { status: 400 });
    if (!SCOPES.has(scope || "")) return Response.json({ error: "Scope inválido." }, { status: 400 });

    const rows = await sql<StyleNote[]>`
      insert into style_notes (scope, note, created_by)
      values (${scope!}, ${note.trim()}, ${session.uid})
      returning id, scope, note, created_at
    `;
    return Response.json({ note: { ...rows[0], author: session.name } });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireSessionApi();
    const { id } = (await req.json()) as { id?: string };
    if (!id) return Response.json({ error: "Falta el id." }, { status: 400 });

    await sql`delete from style_notes where id = ${id}`;
    return Response.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
