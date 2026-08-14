/* relevancia.ts — ¿Este video del buscador habla de la marca, o solo comparte
   nombre con ella?

   Buscar "Apple" en TikTok devuelve manzanas animadas; buscar "Resilient"
   devuelve videos de motivación personal. Ninguna regla de texto distingue eso:
   hace falta entender de qué trata el video. Por eso este bloque es el único de
   la clasificación que usa Claude.

   Lo que decide con reglas (lib/venta/owner.ts) manda: si el handle es de la
   marca o de la competencia que capturaste, eso no se toca. Claude solo opina
   sobre los que quedaron en "creador", y únicamente para bajarlos a "otro".
   Así el peor caso de un modelo equivocado es un video de menos en la cuenta de
   creadores, nunca una cuenta de la marca presentada como creador externo.

   Sin ANTHROPIC_API_KEY no pasa nada: se quedan como estaban y los corriges a
   mano en el editor. */
import Anthropic from "@anthropic-ai/sdk";
import type { Clip } from "./types";

const MODEL = "claude-sonnet-5";

const SCHEMA = {
  type: "object" as const,
  required: ["veredictos"],
  properties: {
    veredictos: {
      type: "array",
      description: "Un veredicto por video, en el mismo orden en que se listaron.",
      items: {
        type: "object",
        required: ["i", "hablaDeLaMarca", "porque"],
        properties: {
          i: { type: "number", description: "El número del video, tal como se listó." },
          hablaDeLaMarca: {
            type: "boolean",
            description: "true si el video es sobre esta marca o sus productos; false si solo comparte la palabra.",
          },
          porque: { type: "string", description: "Máximo 60 caracteres, en español." },
        },
      },
    },
  },
};

const SYSTEM = `Decides si un video de TikTok habla de una marca concreta o si solo salió en la búsqueda porque comparte una palabra con su nombre.

Contesta true (habla de la marca) cuando el video muestra, menciona, usa, reseña, critica o compara los productos de ESA marca, aunque no la nombre en el texto.
Contesta false cuando la palabra buscada aparece con otro significado (la fruta, el adjetivo, un nombre de persona, otra empresa del mismo nombre en otro giro) o cuando el video no tiene nada que ver con lo que la marca vende.

Ante la duda, contesta true: es preferible dejar pasar un video dudoso —que se revisa a ojo en el editor— a borrar uno que sí hablaba de la marca.

No expliques de más: "porque" es una nota corta para que un humano juzgue rápido si te equivocaste.`;

export type Relevancia = { i: number; hablaDeLaMarca: boolean; porque: string };

export async function filtrarRuido(
  clips: Clip[],
  ctx: { brand: string; industry?: string; query?: string }
): Promise<Clip[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  // Solo se juzgan los que las reglas dejaron en "creador".
  const dudosos = clips.map((c, i) => ({ c, i })).filter(({ c }) => (c.owner ?? "creador") === "creador");
  if (!key || dudosos.length === 0) return clips;

  const lista = dudosos
    .map(({ c, i }) => `${i + 1}. @${c.author || "?"} — "${(c.title || "").slice(0, 160)}"`)
    .join("\n");

  const prompt = `MARCA: ${ctx.brand}
QUÉ VENDE: ${ctx.industry || "no especificado"}
SE BUSCÓ EN TIKTOK: "${ctx.query || ctx.brand}"

Videos que salieron:
${lista}

¿Cuáles hablan de la marca y cuáles solo comparten la palabra?`;

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM,
      tools: [{ name: "emit_veredictos", description: "Entrega un veredicto por video.", input_schema: SCHEMA }],
      tool_choice: { type: "tool", name: "emit_veredictos" },
      messages: [{ role: "user", content: prompt }],
    });

    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("Claude no devolvió el tool_use.");

    const veredictos = ((block.input as { veredictos?: Relevancia[] }).veredictos ?? []).filter(
      (v) => v && !v.hablaDeLaMarca
    );

    const fuera = new Map(veredictos.map((v) => [v.i - 1, v.porque]));
    return clips.map((c, i) =>
      fuera.has(i) ? { ...c, owner: "otro" as const, ownerWhy: fuera.get(i) || "no habla de la marca" } : c
    );
  } catch (err) {
    // Que falle esto no puede tumbar el research completo.
    console.error("[relevancia]", err);
    return clips;
  }
}
