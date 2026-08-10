/* store.ts — Persistencia de la estrategia. Mismo patrón que venta: el
   borrador vive en jsonb y lo publicado se congela en `renders`. */
import { sql } from "../db";
import type { Estrategia } from "./types";

export async function getEstrategia(projectId: string): Promise<{ data: Estrategia; sourceDocUrl: string | null } | null> {
  const rows = await sql<{ data: Estrategia; source_doc_url: string | null }[]>`
    select data, source_doc_url from estrategia where project_id = ${projectId} limit 1
  `;
  if (!rows[0]) return null;
  return { data: rows[0].data, sourceDocUrl: rows[0].source_doc_url };
}

export async function saveEstrategia(projectId: string, data: Estrategia, sourceDocUrl?: string | null): Promise<void> {
  await sql`
    insert into estrategia (project_id, data, source_doc_url, updated_at)
    values (${projectId}, ${sql.json(data as never)}, ${sourceDocUrl ?? null}, now())
    on conflict (project_id) do update
      set data = excluded.data,
          source_doc_url = coalesce(excluded.source_doc_url, estrategia.source_doc_url),
          updated_at = now()
  `;
  await sql`update projects set updated_at = now() where id = ${projectId}`;
}
