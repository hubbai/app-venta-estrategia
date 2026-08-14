/* owner.ts — De quién es cada video que sale en el buscador de TikTok.

   La slide 1 abre la llamada contestando tres cosas: si la marca sale primero,
   si sale la competencia y si hay creadores hablando de ella. Las tres son
   afirmaciones que se dicen en voz alta frente al cliente, así que la
   clasificación se hace con reglas explícitas y queda editable a mano.

   El orden importa: marca gana sobre competencia, y competencia sobre creador.
   Ante la duda NO se inventa competencia — se deja en creador, que es el caso
   común y el que menos daño hace si se equivoca. */
import type { Clip, Owner } from "./types";

/** "@Nuva_Skin!" y "nuvaskin" son lo mismo para comparar. */
function key(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* Marcas de menos de 5 letras normalizadas ("kredi") harían match dentro de
   demasiados handles ajenos, así que ahí no se arriesga el contains. */
const MIN_CONTAINS = 5;

function pertenece(authorKey: string, nombre: string): boolean {
  const k = key(nombre);
  if (!k) return false;
  if (authorKey === k) return true;
  return k.length >= MIN_CONTAINS && authorKey.includes(k);
}

export function clasificar(
  author: string | undefined,
  opts: { brand: string; ownHandles?: (string | undefined)[]; competitors?: string[] }
): { owner: Owner; why: string } {
  const a = key(author || "");
  if (!a) return { owner: "creador", why: "sin autor" };

  for (const h of opts.ownHandles ?? []) {
    if (h && a === key(h)) return { owner: "marca", why: "es la cuenta de la marca" };
  }
  if (pertenece(a, opts.brand)) {
    return { owner: "marca", why: `el handle contiene "${opts.brand}"` };
  }
  for (const c of opts.competitors ?? []) {
    if (pertenece(a, c)) return { owner: "competencia", why: `coincide con "${c.trim()}"` };
  }
  return { owner: "creador", why: "cuenta de tercero" };
}

/** Aplica la clasificación a los resultados, respetando lo corregido a mano. */
export function clasificarResultados(
  results: Clip[],
  opts: { brand: string; ownHandles?: (string | undefined)[]; competitors?: string[]; conservarManual?: boolean }
): Clip[] {
  return results.map((c) => {
    // Si ya lo corregiste a mano, la regla no te lo vuelve a cambiar.
    if (opts.conservarManual && c.ownerWhy === MANUAL) return c;
    const { owner, why } = clasificar(c.author, opts);
    return { ...c, owner, ownerWhy: why };
  });
}

export const MANUAL = "corregido a mano";

/* ── Lo que responde la slide 1 ─────────────────────────────────────────── */

export type Veredictos = {
  /** Posición (1-based) del primer video de la marca, o null si no aparece. */
  posicionMarca: number | null;
  totalMarca: number;
  totalCompetencia: number;
  totalCreadores: number;
  /** Los que no hablan de la marca: el ruido de un nombre genérico. */
  totalOtros: number;
  total: number;
  /** El video de creador con más views, que es el que sostiene el argumento. */
  mejorCreador?: Clip;
  mejorCompetencia?: Clip;
  /* Cuando la mayoría del buscador no habla de la marca, el hallazgo cambia:
     ya no es "quién ocupa tu espacio" sino "tu nombre no es tuyo ahí". */
  dominaElRuido: boolean;
};

export function veredictos(results: Clip[] = []): Veredictos {
  const conOwner = results.map((c) => ({ ...c, owner: c.owner ?? "creador" }));
  const idx = conOwner.findIndex((c) => c.owner === "marca");
  const porViews = (list: Clip[]) => [...list].sort((a, b) => (b.viewsNum ?? 0) - (a.viewsNum ?? 0))[0];
  const cuenta = (o: Owner) => conOwner.filter((c) => c.owner === o).length;
  const total = conOwner.length;
  const otros = cuenta("otro");

  return {
    posicionMarca: idx === -1 ? null : idx + 1,
    totalMarca: cuenta("marca"),
    totalCompetencia: cuenta("competencia"),
    totalCreadores: cuenta("creador"),
    totalOtros: otros,
    total,
    mejorCreador: porViews(conOwner.filter((c) => c.owner === "creador")),
    mejorCompetencia: porViews(conOwner.filter((c) => c.owner === "competencia")),
    dominaElRuido: total > 0 && otros > total / 2,
  };
}
