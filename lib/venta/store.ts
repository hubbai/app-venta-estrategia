/* store.ts — Persistencia del research y del copy de la llamada de venta.

   El deck (lo que escribió Claude) se guarda DENTRO de research.data.deck: es
   parte del borrador editable, no del render publicado. Lo publicado vive en
   la tabla `renders` y ya no cambia aunque se reedite el borrador. */
import { sql } from "../db";
import { normalizeDeck } from "./types";
import type { Deck, Research } from "./types";

export type VentaDoc = { research: Research; deck: Deck | null; engine?: string };

export async function getVenta(projectId: string): Promise<VentaDoc | null> {
  const rows = await sql<{ data: VentaDoc }[]>`
    select data from research where project_id = ${projectId} limit 1
  `;
  const doc = rows[0]?.data;
  if (!doc) return null;
  /* Los borradores guardados antes de que el buscador pasara a ser la slide 1
     traen el deck en s1/s2/s3. Se traduce al leer, no con una migración: el
     deck es un blob editable y el usuario lo va a regenerar de todos modos. */
  return { ...doc, deck: normalizeDeck(doc.deck) };
}

export async function saveVenta(projectId: string, doc: VentaDoc): Promise<void> {
  await sql`
    insert into research (project_id, data, updated_at)
    values (${projectId}, ${sql.json(doc as never)}, now())
    on conflict (project_id) do update set data = excluded.data, updated_at = now()
  `;
  await sql`update projects set updated_at = now() where id = ${projectId}`;
}

/* Merge superficial: el formulario manda solo lo que cambió, y el scraping
   solo los bloques que sí trajo. Así uno no pisa al otro. */
export async function patchResearch(projectId: string, patch: Partial<Research>): Promise<VentaDoc> {
  const current = (await getVenta(projectId)) ?? { research: {} as Research, deck: null };
  const next: VentaDoc = {
    ...current,
    research: { ...current.research, ...patch },
  };
  await saveVenta(projectId, next);
  return next;
}
