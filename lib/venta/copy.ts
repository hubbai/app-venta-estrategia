/* copy.ts — Convierte el research en el copy del pitch.

   Portado de research-pitch/src/copy.js. Las reglas de tono son las que ya se
   afinaron contra presentaciones reales: no tocarlas a la ligera. Lo nuevo es
   que ahora son 3 slides (paid, orgánico, creadores) en vez de 2, y las notas
   de estilo se leen de la DB en vez de style-notes.md.

   Si no hay ANTHROPIC_API_KEY o Claude falla, cae a un generador determinista
   con la misma estructura: nunca te quedas sin deck antes de una llamada. */
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "../db";
import { LIMITS } from "./limits";
import type { Clip, Deck, Research } from "./types";

const MODEL = "claude-sonnet-5";

export { LIMITS };

const DECK_SCHEMA = {
  type: "object" as const,
  required: ["s1", "s2", "s3"],
  properties: {
    s1: {
      type: "object",
      required: ["subtitle", "cards"],
      description: "Slide 1 · Paid Media (Ad Library).",
      properties: {
        subtitle: {
          type: "string",
          description: `1-2 líneas describiendo la situación de pauta con datos concretos (cuántos anuncios, formato, qué mensaje domina, antigüedad). Máx ${LIMITS.subtitle} caracteres.`,
        },
        cards: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          description: "Exactamente 3 ideas de script para el mes 1.",
          items: {
            type: "object",
            required: ["title", "desc"],
            properties: {
              title: { type: "string", description: `Máx ${LIMITS.cardTitle} caracteres.` },
              desc: { type: "string", description: `Máx ${LIMITS.cardDesc} caracteres.` },
            },
          },
        },
      },
    },
    s2: {
      type: "object",
      required: ["subtitle", "insight"],
      description: "Slide 2 · Presencia orgánica. En pantalla ya se ven los perfiles de IG y TikTok con sus seguidores y los mejores videos propios con sus views.",
      properties: {
        subtitle: {
          type: "string",
          description: `1-2 líneas describiendo la presencia orgánica con datos concretos (redes activas, tipo de contenido, alcance). Máx ${LIMITS.subtitle} caracteres.`,
        },
        insight: {
          type: "object",
          required: ["title", "desc"],
          description: "El patrón que se repite en el contenido propio: qué formato publican y qué techo de alcance tiene.",
          properties: {
            title: { type: "string", description: `Máx ${LIMITS.insightTitle} caracteres.` },
            desc: { type: "string", description: `Máx ${LIMITS.insightDesc} caracteres.` },
          },
        },
      },
    },
    s3: {
      type: "object",
      required: ["subtitle", "win", "own", "closing"],
      description: "Slide 3 · Creadores. En pantalla ya se ve lo que sale al buscar la marca en TikTok.",
      properties: {
        subtitle: {
          type: "string",
          description: `1-2 líneas sobre qué pasa cuando alguien busca la marca en TikTok. Máx ${LIMITS.subtitle} caracteres.`,
        },
        win: {
          type: "object",
          required: ["title", "desc"],
          description: "Tarjeta destacada: el contenido que mejor funcionó (o el formato que la categoría ya premia si no hay data propia).",
          properties: {
            label: {
              type: "string",
              description: `Pill verde. Máx ${LIMITS.compLabel} caracteres. Default "Mejor resultado"; si no hay data propia usa algo como "Lo que ya funciona".`,
            },
            title: { type: "string", description: `Máx ${LIMITS.compTitle} caracteres.` },
            desc: { type: "string", description: `Máx ${LIMITS.compDesc} caracteres.` },
          },
        },
        own: {
          type: "object",
          required: ["title", "desc"],
          description: "Tarjeta neutral: el contenido propio de la marca.",
          properties: {
            label: { type: "string", description: `Pill gris. Máx ${LIMITS.compLabel} caracteres. Default "Resultado propio".` },
            title: { type: "string", description: `Máx ${LIMITS.compTitle} caracteres.` },
            desc: { type: "string", description: `Máx ${LIMITS.compDesc} caracteres.` },
          },
        },
        closing: {
          type: "object",
          required: ["title", "text"],
          description: "Caja de cierre que conecta el hallazgo con Full Service.",
          properties: {
            title: { type: "string", description: `Máx ${LIMITS.closingTitle} caracteres.` },
            text: { type: "string", description: `Máx ${LIMITS.closingText} caracteres.` },
          },
        },
      },
    },
  },
};

const SYSTEM = `Eres el estratega de pitch de HUBB Full Service (UGC + performance creative para marcas en México).
Recibes el research pre-junta de una marca y escribes el copy de una presentación de 3 slides que se enseña EN VIVO durante la llamada.

REGLAS DE TONO (obligatorias):
- Nunca enmarques un hallazgo como carencia o ataque ("no tienen nada", "les falta", "lo que faltaba", "están mal"). Siempre como oportunidad o espacio disponible. Esto aplica también a los títulos de tarjeta.
- Español de México, directo, de estratega a dueño de marca. Nada de corporativo vacío.
- ESPAÑOL LLANO. Escribe como le explicarías el hallazgo al dueño de la marca en la llamada. Prohibida la jerga de agencia: "formato editorial", "concentra seguidores", "presencia consolidada", "ecosistema de contenido", "activos de marca". Di el número y qué significa en palabras normales.
- TONO DESCRIPTIVO, NO DE VENTA. Los títulos de las slides ya están fijos ("Presencia en Ads", "Presencia orgánica" y "Creadores"): tú escribes lo que se observó. El subtítulo REPORTA el hallazgo con datos concretos (cuántos anuncios, qué formato, qué mensaje, cuántos seguidores), no lo vende. Nada de frases publicitarias tipo "el terreno está listo para llenarse", "la oportunidad es la mezcla", "hagámoslo juntos". Que el dato hable; la propuesta va en las tarjetas y en el cierre.
- Máximo 2-3 líneas por bloque. Nada de párrafos. Frases cortas.
- Exactamente 3 ideas de script en la slide 1, ni una más.
- Nunca menciones nombres de cuentas, handles ni nombres de creadores.
- Habla de "nosotros/haríamos" cuando sea la propuesta de Hubb, y de "ustedes/tú" hacia la marca.

NARRATIVA SLIDE 1 (Paid Media / Ads Library):
- Si la marca NO tiene anuncios activos: el ángulo es "hay espacio abierto" — su categoría está corriendo pauta y ellos aún no aparecen ahí; el mes 1 es entrar con contenido, no con presupuesto grande.
- Si SÍ tiene anuncios activos: NO digas que hay espacio abierto. El ángulo es "ya estás invirtiendo en pauta — así la haríamos más eficiente", comparando frío vs. caliente: el contenido orgánico calienta a la audiencia antes de que le pegue el ad, y ángulos nuevos evitan la fatiga del creativo que ya lleva tiempo corriendo.
- Las 3 ideas de script salen de los mensajes/hooks reales que trae el research; si no hay suficiente data, se infieren de la industria (y deben sonar específicas de esa industria, no genéricas).

NARRATIVA SLIDE 2 (Presencia orgánica):
- Describe el patrón del contenido propio: qué formato publican, con qué frecuencia se nota, y en qué rango de views se mueve. El "insight" nombra ese patrón y su techo.
- Si una red tiene muchos más seguidores que la otra, dilo en términos de qué significa para producir contenido, no como reproche.
- NUNCA digas que una red "no sirve" o que "está abandonada".

NARRATIVA SLIDE 3 (Creadores):
- Si el mejor contenido orgánico es de un creador externo y no de la marca: ese es el cierre MÁS FUERTE. Enmárcalo como prueba de que el modelo de Full Service ya funcionó para ellos sin querer — un creador solo, sin sistema detrás, ya superó al contenido de marca; nosotros lo volvemos sistema y volumen.
- Si el mejor contenido es de la marca: el ángulo es que ya saben qué funciona y lo que falta es volumen y consistencia, no acertar.
- Si no hay suficiente data: NO dejes la tarjeta "win" vacía ni digas "no hay dato". La tarjeta "win" describe el formato que la categoría ya premia (el que sí despega en marcas parecidas), con un label tipo "Lo que ya funciona"; la "own" describe lo que la marca publica hoy. El ángulo es que el mes 1 se prueba ese formato en volumen para encontrar el ángulo ganador rápido.
- MÉTRICA: compara siempre en VIEWS, no en likes. Si el research trae views, úsalas con el número exacto. Si solo hay likes, describe la posición sin inventar views ("el video que más se mueve cuando buscas la marca").

CONTEXTO DE LAS SLIDES (para no repetir): la slide 1 ya muestra en pantalla los creativos reales que la marca trae corriendo (con su copy, su fecha de arranque y una etiqueta Video/Imagen), más el número de anuncios activos y la mezcla imagen/video. NUNCA digas que "todo es estático" o que "no hay video" si el research dice que sí hay videos: describe la mezcla real y qué TIPO de video es (producción de marca sin persona hablando vs. UGC con cara y voz). La slide 2 ya muestra las tarjetas de perfil de Instagram y TikTok con seguidores y los mejores videos propios con sus views. La slide 3 ya muestra la parrilla de lo que sale al buscar la marca en TikTok. Tus subtítulos NO deben repetir esos números uno por uno: deben decir qué significan (el patrón, lo que se repite, lo que falta).

Devuelve el resultado SIEMPRE llamando la tool emit_deck. Respeta los límites de caracteres al pie de la letra: si te pasas, el texto se corta en la slide.`;

function researchToPrompt(r: Research): string {
  const nets = (r.networks || [])
    .map((n) =>
      n.active
        ? `- ${n.name}: ${n.followers ? n.followers + " seguidores, " : ""}contenido predominante "${n.content || "n/d"}", alcance "${n.reach || "n/d"}"`
        : `- ${n.name}: sin presencia activa detectada`
    )
    .join("\n");

  const bestMap: Record<Research["bestContent"], string> = {
    creador: "El contenido con más alcance es de un CREADOR EXTERNO, no de la marca.",
    marca: "El contenido con más alcance es de la MARCA misma.",
    nodata: "No hay suficiente data para saber qué contenido rinde mejor.",
  };

  const adsBlock = (r.ads || []).length
    ? "\nAnuncios activos leídos de la Ad Library (creativo real + fecha de arranque):\n" +
      r.ads!
        .map(
          (a, i) =>
            `  ${i + 1}. [${a.started || "s/f"}] [${a.isVideo ? "VIDEO" + (a.duration ? " " + a.duration : "") : "IMAGEN"}] ${a.text || "(sin copy)"}`
        )
        .join("\n") +
      "\n"
    : "";

  const clips = (list: Clip[] = []) =>
    list.map((c) => `    · ${c.views || "s/d"} views — "${c.title || "sin descripción"}"`).join("\n") || "    (ninguno)";

  const searchBlock = r.search?.results?.length
    ? `Al buscar "${r.search.query}" en TikTok salen:\n` +
      r.search.results.map((c) => `  · @${c.author || "?"} — ${c.views || "s/d"} views — "${c.title || ""}"`).join("\n")
    : "No se pudo leer el buscador de TikTok.";

  return `MARCA: ${r.brand}
INDUSTRIA: ${r.industry}

— BLOQUE A · ADS LIBRARY (META) —
Anuncios activos ahorita: ${r.adCount}${r.adVideoCount != null ? ` (${r.adImageCount} imagen / ${r.adVideoCount} video)` : ""}
${
  r.adCount > 0
    ? `Mensajes/hooks que está usando: ${r.adHooks || "n/d"}
Formato que predomina: ${r.adFormat || "n/d"}${adsBlock}
Antigüedad del anuncio más viejo: ${r.adOldest || "n/d"}`
    : adsBlock || "(Sin anuncios activos en la Ad Library.)"
}

— BLOQUE B · PRESENCIA ORGÁNICA —
${nets}
Perfil de Instagram: ${r.instagram ? `${r.instagram.followers} seguidores, ${r.instagram.posts} publicaciones. Bio: "${r.instagram.bio || "—"}"` : "no se leyó"}
Perfil de TikTok: ${r.tiktok ? `${r.tiktok.followers} seguidores, ${r.tiktok.posts} videos. Bio: "${r.tiktok.bio || "—"}"` : "no se leyó"}
Mejores videos propios:
${clips(r.organic?.brand)}

— BLOQUE C · CREADORES —
${searchBlock}
Mejores videos de creadores externos:
${clips(r.organic?.creators)}
Hallazgo clave: ${bestMap[r.bestContent]}${r.bestViews ? `\nViews del contenido que ganó: ${r.bestViews}` : ""}${r.ownViews ? `\nViews del mejor contenido propio: ${r.ownViews}` : ""}
Notas libres del research: ${r.notes || "—"}

Escribe el copy de las 3 slides para esta marca.`;
}

/* ── Recorte defensivo: nunca dejamos pasar texto más largo del límite ── */
function clamp(s: unknown, n: number): string {
  const str = String(s || "").replace(/\s+/g, " ").trim();
  if (str.length <= n) return str;
  const cut = str.slice(0, n - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:.\s]+$/, "") + "…";
}

export function clampDeck(d: Deck): Deck {
  return {
    s1: {
      subtitle: clamp(d.s1?.subtitle, LIMITS.subtitle),
      cards: (d.s1?.cards || []).slice(0, 3).map((c) => ({
        title: clamp(c.title, LIMITS.cardTitle),
        desc: clamp(c.desc, LIMITS.cardDesc),
      })),
    },
    s2: {
      subtitle: clamp(d.s2?.subtitle, LIMITS.subtitle),
      insight: {
        title: clamp(d.s2?.insight?.title, LIMITS.insightTitle),
        desc: clamp(d.s2?.insight?.desc, LIMITS.insightDesc),
      },
    },
    s3: {
      subtitle: clamp(d.s3?.subtitle, LIMITS.subtitle),
      win: {
        label: clamp(d.s3?.win?.label || "Mejor resultado", LIMITS.compLabel),
        title: clamp(d.s3?.win?.title, LIMITS.compTitle),
        desc: clamp(d.s3?.win?.desc, LIMITS.compDesc),
      },
      own: {
        label: clamp(d.s3?.own?.label || "Resultado propio", LIMITS.compLabel),
        title: clamp(d.s3?.own?.title, LIMITS.compTitle),
        desc: clamp(d.s3?.own?.desc, LIMITS.compDesc),
      },
      closing: {
        title: clamp(d.s3?.closing?.title, LIMITS.closingTitle),
        text: clamp(d.s3?.closing?.text, LIMITS.closingText),
      },
    },
  };
}

/* ── Generador determinista (fallback sin API key) ── */
export function fallbackDeck(r: Research): Deck {
  const ind = (r.industry || "la categoría").toLowerCase();
  const hooks = (r.adHooks || "").split(/[\n,;·•]+/).map((s) => s.trim()).filter(Boolean);
  const hasAds = Number(r.adCount) > 0;

  const genericCards = [
    { title: "Problema real, en 3s", desc: `Abrimos con la fricción concreta que tu cliente de ${ind} ya vivió esta semana.` },
    { title: "Prueba de producto", desc: "Demo corta en manos reales: qué hace, cómo se siente y por qué se nota." },
    { title: "Antes y después", desc: "Resultado tangible contado por alguien que se parece a tu cliente ideal." },
  ];

  const hookCards = hooks.slice(0, 3).map((h, i) => ({
    title: ["Mismo ángulo, en video", "Objeción de frente", "Prueba social real"][i],
    desc: [
      `Tomamos "${h}" y lo llevamos a UGC con cara y voz, no a estático.`,
      `Respondemos la duda que frena la compra en ${ind}, sin rodeos.`,
      "Una persona real usando el producto: el formato que sostiene la pauta.",
    ][i],
  }));

  const cards = hasAds && hookCards.length === 3 ? hookCards : hasAds ? [...hookCards, ...genericCards].slice(0, 3) : genericCards;

  const s1 = hasAds
    ? {
        subtitle: `Tienes ${r.adCount} ${r.adCount === 1 ? "anuncio activo" : "anuncios activos"} en México${r.adOldest ? `, el más viejo desde ${r.adOldest}` : ""}. El contenido orgánico calienta a esa audiencia antes de que le pegue el ad.`,
        cards,
      }
    : {
        subtitle: `Hoy no hay anuncios activos corriendo en México para ${r.brand}. El mes 1 no arranca con presupuesto grande, arranca con contenido que ya venga probado.`,
        cards,
      };

  const activeNets = (r.networks || []).filter((n) => n.active);
  const netNames = activeNets.map((n) => n.name).join(" y ") || "redes orgánicas";
  const ownContent = activeNets[0]?.content || "contenido de marca";
  const ownReach = activeNets.find((n) => n.reach)?.reach || "alcance bajo";

  const s2 = {
    subtitle: `${netNames} son las cuentas activas hoy. El contenido propio se mueve en ${ownReach}.`,
    insight: {
      title: "El formato propio ya tiene un techo",
      desc: `Lo que se publica hoy en ${netNames} sostiene la cuenta, pero se repite en el mismo rango de views. Ahí es donde el volumen cambia el número.`,
    },
  };

  let s3: Deck["s3"];
  if (r.bestContent === "creador") {
    s3 = {
      subtitle: "El contenido con más alcance de tu marca no lo hiciste tú: lo hizo un creador externo, solo y sin sistema detrás.",
      win: { label: "Mejor resultado", title: "Contenido de creador", desc: "Cara real, voz real, formato nativo. Es el que se lleva el alcance." },
      own: { label: "Resultado propio", title: ownContent, desc: `Es lo que sostiene ${netNames} hoy y se mueve en ${ownReach}.` },
      closing: {
        title: "Ahí entra Full Service",
        text: "Si un creador solo ya superó al contenido de marca, imagina eso como sistema: varios creadores, varios ángulos, cada mes, conectados directo a tu pauta.",
      },
    };
  } else if (r.bestContent === "marca") {
    s3 = {
      subtitle: `Tu propio contenido es el que mejor rinde en ${netNames}. El reto ya no es acertar, es producir suficiente para sostenerlo.`,
      win: { label: "Mejor resultado", title: ownContent, desc: `Es tu formato ganador hoy y se mueve en ${ownReach}.` },
      own: { label: "Resto del feed", title: "Contenido de apoyo", desc: "Llena calendario pero no mueve la aguja igual." },
      closing: {
        title: "Ahí entra Full Service",
        text: "Nosotros convertimos ese formato ganador en volumen mensual: mismos ángulos, más piezas, listas para orgánico y para pauta.",
      },
    };
  } else {
    s3 = {
      subtitle: `Todavía no hay suficiente data en ${netNames} para saber qué ángulo despega. Eso se resuelve rápido probando en volumen.`,
      win: { label: "Lo que ya funciona", title: "Ángulos por probar", desc: "Varios formatos en paralelo el mes 1 para encontrar el que despega." },
      own: { label: "Resultado propio", title: ownContent, desc: `Lo que hay hoy se mueve en ${ownReach}: buena base para leer señales.` },
      closing: {
        title: "Ahí entra Full Service",
        text: "En un mes salimos de la duda: producimos varios ángulos, medimos cuál pega y doblamos ahí. Sin adivinar.",
      },
    };
  }

  return clampDeck({ s1, s2, s3 });
}

/* Las notas viven en DB (antes era style-notes.md) y pesan MÁS que las reglas
   base, porque son lo último que aprendió el equipo. */
async function readStyleNotes(): Promise<string> {
  try {
    const rows = await sql<{ note: string }[]>`
      select note from style_notes where scope = 'venta' order by created_at asc
    `;
    return rows.map((r, i) => `${i + 1}. ${r.note}`).join("\n");
  } catch {
    return "";
  }
}

export async function buildDeck(r: Research): Promise<{ deck: Deck; engine: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { deck: fallbackDeck(r), engine: "determinista (sin ANTHROPIC_API_KEY)" };

  const notes = await readStyleNotes();
  const system = `${SYSTEM}

── NOTAS DE ESTILO DEL EQUIPO ──
Estas notas son MÁS RECIENTES que las reglas de arriba. Si algo aquí contradice una regla anterior, GANAN ESTAS NOTAS.

${notes || "(sin notas todavía)"}`;

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2500,
      system,
      tools: [{ name: "emit_deck", description: "Entrega el copy de las 3 slides.", input_schema: DECK_SCHEMA }],
      tool_choice: { type: "tool", name: "emit_deck" },
      messages: [{ role: "user", content: researchToPrompt(r) }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("Claude no devolvió el tool_use.");
    return { deck: clampDeck(block.input as Deck), engine: MODEL };
  } catch (err) {
    console.error("[copy]", err);
    return { deck: fallbackDeck(r), engine: "determinista (falló Claude)" };
  }
}
