/* consulta.ts — Con qué palabras se busca la marca en TikTok.

   Buscar el nombre pelón es lo que rompe la slide 1: "acapella" devuelve gente
   cantando a capella, "apple" devuelve manzanas animadas, "resilient" devuelve
   motivación personal. Nadie busca así. Alguien que oyó de la marca escribe
   "acapella ropa" o "acapella playeras" — el nombre MÁS lo que vende.

   Esto no es un detalle de UX: el término decide qué sale en la parrilla, y la
   parrilla es el argumento entero de la primera slide.

   La consulta queda guardada y editable en el editor; esto solo propone la
   primera. */
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";

const SCHEMA = {
  type: "object" as const,
  required: ["consulta", "porque"],
  properties: {
    consulta: {
      type: "string",
      description:
        "Lo que escribiría en TikTok alguien que oyó de esta marca y la quiere encontrar. Máximo 4 palabras. Casi siempre el nombre + una palabra de categoría.",
    },
    porque: { type: "string", description: "Máximo 70 caracteres." },
  },
};

const SYSTEM = `Escribes el término con el que se busca una marca en TikTok, como lo escribiría un cliente suyo.

La regla: si el nombre de la marca es una palabra común —o suena a otra cosa— hay que agregarle una palabra de su categoría, porque el nombre solo devuelve cualquier otra cosa.
  · "Acapella" (ropa) → "acapella ropa", porque "acapella" solo trae gente cantando.
  · "Apple" (electrónicos) → "apple iphone", porque "apple" solo trae manzanas.
  · "Resilient" (ropa deportiva) → "resilient club", si así se llama la cuenta, o "resilient ropa".

Si el nombre ya es único e inconfundible (Cemex, Bimbo, Telcel), déjalo solo: agregarle palabras achica los resultados sin necesidad.

Usa la palabra que usaría un cliente, no la de un catálogo: "ropa" y no "prendas de vestir"; "tenis" y no "calzado deportivo". Todo en minúsculas y en español de México, salvo que la marca sea en inglés.`;

/* Sin Claude: el nombre más el primer sustantivo de lo que venden. Es peor que
   lo que escribe el modelo, pero mucho mejor que el nombre solo. */
function heuristica(brand: string, industry?: string): string {
  const relleno = new Set([
    "de","la","el","los","las","para","con","y","en","un","una","que","del","al","por","su","sus","tipo","marca",
  ]);
  const palabra = (industry || "")
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .find((w) => w.length > 3 && !relleno.has(w));
  return palabra ? `${brand.toLowerCase()} ${palabra}` : brand.toLowerCase();
}

export async function sugerirConsulta(
  brand: string,
  industry?: string
): Promise<{ consulta: string; porque?: string }> {
  const base = heuristica(brand, industry);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !brand.trim()) return { consulta: base };

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 250,
      system: SYSTEM,
      tools: [{ name: "emit", description: "Entrega el término de búsqueda.", input_schema: SCHEMA }],
      tool_choice: { type: "tool", name: "emit" },
      messages: [
        { role: "user", content: `MARCA: ${brand}\nQUÉ VENDE: ${industry || "no especificado"}` },
      ],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return { consulta: base };

    const out = block.input as { consulta?: string; porque?: string };
    const limpia = (out.consulta || "").trim();
    // Que no se le ocurra buscar algo que ni menciona a la marca.
    const mencionaLaMarca = limpia
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .includes(brand.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5));

    return limpia && mencionaLaMarca ? { consulta: limpia, porque: out.porque } : { consulta: base };
  } catch (err) {
    console.error("[consulta]", err);
    return { consulta: base };
  }
}
