/* parse.ts — Convierte el documento de Henry en la estrategia estructurada.

   El documento describe la forma de trabajo de Full Service en prosa; aquí
   Claude lo mapea al shape que el render sabe pintar. El schema es estricto a
   propósito: es lo que evita que la propuesta salga con secciones a medias.

   Nada de lo que devuelve se publica solo — cae en el editor para que lo
   revises campo por campo. */
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "../db";
import type { Estrategia } from "./types";

const MODEL = "claude-sonnet-5";

const ROW = {
  type: "object",
  required: ["label", "value"],
  properties: { label: { type: "string" }, value: { type: "string" } },
};

const SCHEMA = {
  type: "object" as const,
  required: ["title", "escenarios", "panels", "funciones", "pasos", "lineas"],
  properties: {
    title: { type: "string", description: 'Título de portada. Formato: "Propuesta de Colaboración — {Marca}".' },
    intro: {
      type: "string",
      description: "2-3 líneas de portada que resumen qué se propone. Si hay dos escenarios, di en qué se diferencian.",
    },
    contexto: {
      type: "object",
      description: "Contexto de marca: quién es, qué vende y qué atributos debe demostrar el contenido.",
      required: ["paragraphs", "atributos", "stats"],
      properties: {
        title: { type: "string", description: 'Default "Contexto de marca".' },
        paragraphs: { type: "array", items: { type: "string" }, description: "1-3 párrafos." },
        atributos: {
          type: "array",
          items: { type: "string" },
          description: 'Atributos del producto en 1-2 palabras cada uno (ej. "Ligereza", "Secado rápido").',
        },
        stats: {
          type: "array",
          items: {
            type: "object",
            required: ["value", "label"],
            properties: {
              value: { type: "string", description: 'El número grande, ej. "2,000+" o "4.9 ★".' },
              label: { type: "string", description: "Qué significa ese número, en minúsculas." },
            },
          },
          description: "0-3 datos duros de la marca. Solo si el documento los trae; no inventes cifras.",
        },
      },
    },
    escenarios: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      description: "Los escenarios de trabajo propuestos. Casi siempre son dos.",
      items: {
        type: "object",
        required: ["tag", "title", "paragraphs", "badges"],
        properties: {
          tag: { type: "string", description: 'Ej. "Escenario 1".' },
          title: { type: "string", description: 'Ej. "10 creadores UGC — UGC Ads + Stories".' },
          paragraphs: { type: "array", items: { type: "string" }, description: "1-3 párrafos explicando el escenario." },
          badges: { type: "array", items: { type: "string" }, description: '2-4 etiquetas cortas, ej. "10 creadores", "Enfoque en pauta".' },
          breakdownTitle: { type: "string", description: 'Ej. "Qué recibe y qué produce cada creador".' },
          breakdown: {
            type: "array",
            items: {
              type: "object",
              required: ["label", "value", "caption"],
              properties: {
                label: { type: "string", description: 'Ej. "Recibe", "Grupo A · UGC Ads".' },
                value: { type: "string", description: 'El número grande, ej. "4", "10".' },
                caption: { type: "string", description: 'Ej. "prendas RESILIENT", "1 video para pauta + 1 story".' },
              },
            },
            description: "La tira de bloques que explica el flujo del escenario.",
          },
          breakdownSeparators: {
            type: "array",
            items: { type: "string" },
            description: 'Símbolos entre bloques: ["→","→"] para un flujo, ["+","="] para una suma. Uno menos que bloques.',
          },
          note: { type: "string", description: "Aclaración al pie del escenario, si el documento la trae." },
        },
      },
    },
    panelsTitle: { type: "string", description: 'Default "Entregables totales de cada escenario".' },
    panelsSubtitle: { type: "string", description: 'Default "los números de uno y otro, lado a lado".' },
    panels: {
      type: "array",
      description: "Un panel por escenario, con sus entregables y datos operativos. Mismas filas en todos para que se comparen.",
      items: {
        type: "object",
        required: ["tag", "title", "entregables", "operativos"],
        properties: {
          tag: { type: "string" },
          title: { type: "string" },
          entregables: { type: "array", items: ROW, description: "Videos para pauta, stories, TikToks/Reels…" },
          operativos: { type: "array", items: ROW, description: "Creadores participantes, producto enviado, total de piezas…" },
        },
      },
    },
    panelsNote: { type: "string", description: "Aclaración de cómo salen esos números." },
    funcionesTitle: { type: "string", description: 'Default "Función de cada contenido".' },
    funcionesSubtitle: { type: "string", description: 'Default "qué trabajo hace cada pieza".' },
    funciones: {
      type: "array",
      description: "Qué trabajo hace cada tipo de pieza de contenido.",
      items: {
        type: "object",
        required: ["count", "title", "desc", "scope"],
        properties: {
          count: { type: "string", description: 'Cantidad, ej. "10" o "40 / 10".' },
          title: { type: "string", description: 'Ej. "Videos para pauta".' },
          desc: { type: "string", description: "Una línea: qué trabajo hace." },
          scope: { type: "string", description: 'En qué escenarios aplica, ej. "Escenarios 1 y 2".' },
        },
      },
    },
    pasosTitle: { type: "string", description: 'Default "Pasos del servicio".' },
    pasosSubtitle: { type: "string" },
    pasos: {
      type: "array",
      minItems: 3,
      description: "El proceso de trabajo de Full Service, en orden.",
      items: {
        type: "object",
        required: ["phase", "tag", "title", "desc"],
        properties: {
          phase: { type: "string", description: 'Ej. "Paso 1 · Arranque".' },
          tag: { type: "string", description: 'Etiqueta corta a la derecha, ej. "Henry", "Casting", "5–7 días hábiles".' },
          title: { type: "string" },
          desc: { type: "string", description: "1-3 líneas describiendo el paso." },
          chips: { type: "array", items: { type: "string" }, description: "Criterios o puntos sueltos del paso." },
          variantes: {
            type: "array",
            items: {
              type: "object",
              required: ["label", "text"],
              properties: {
                label: { type: "string", description: 'Ej. "Esc. 1".' },
                text: { type: "string", description: "Qué cambia en ese escenario." },
              },
            },
            description: "Diferencias por escenario dentro de este paso.",
          },
        },
      },
    },
    lineasTitle: { type: "string", description: 'Default "Líneas creativas sugeridas".' },
    lineasSubtitle: { type: "string" },
    lineas: {
      type: "array",
      description: "Los ángulos creativos que van a cubrir los scripts. Normalmente 3.",
      items: {
        type: "object",
        required: ["title", "desc"],
        properties: { title: { type: "string" }, desc: { type: "string", description: "1-2 líneas." } },
      },
    },
    comparativaTitle: { type: "string", description: 'Default "Comparativa general".' },
    comparativaSubtitle: { type: "string" },
    comparativa: {
      type: "object",
      description: "Tabla que compara los escenarios más allá de los números. Omítela si solo hay un escenario.",
      required: ["headers", "rows"],
      properties: {
        headers: { type: "array", items: { type: "string" }, description: 'Primera columna "Elemento", luego un encabezado por escenario.' },
        rows: {
          type: "array",
          items: { type: "array", items: { type: "string" } },
          description: "Cada fila tiene tantas celdas como encabezados.",
        },
      },
    },
    creadoresTitle: { type: "string", description: 'Default "Portafolios sugeridos para colaborar".' },
    creadoresNote: { type: "string", description: "Aclaración de que la selección final valida disponibilidad y afinidad." },
  },
};

const SYSTEM = `Eres el estratega de HUBB Full Service (UGC + performance creative para marcas en México).
Recibes un documento interno que explica la forma de trabajo de Full Service y la estrategia propuesta para una marca, y lo conviertes en la propuesta que se le comparte a esa marca por link.

REGLAS:
- Español de México, directo, de estratega a dueño de marca. Nada de corporativo vacío ni de jerga de agencia.
- NO INVENTES DATOS. Números de creadores, entregables, precios, plazos y cifras de la marca salen del documento. Si un dato no está, omite el campo o deja el texto sin número — nunca lo estimes.
- Sí puedes redactar: el documento viene en notas y prosa suelta; tu trabajo es ordenarlo y escribirlo claro, no inflarlo.
- Los pasos del servicio van en orden cronológico, del arranque al análisis de resultados.
- Las descripciones son de 1 a 3 líneas. Nada de párrafos largos: esto se lee en pantalla.
- Cuando el documento describa dos escenarios, mantén los mismos renglones en los paneles de entregables de ambos para que se puedan comparar de un vistazo.
- No menciones nombres de creadores: el portafolio se llena aparte desde la base de hubb.

Devuelve el resultado SIEMPRE llamando la tool emit_estrategia.`;

async function readStyleNotes(): Promise<string> {
  try {
    const rows = await sql<{ note: string }[]>`
      select note from style_notes where scope = 'estrategia' order by created_at asc
    `;
    return rows.map((r, i) => `${i + 1}. ${r.note}`).join("\n");
  } catch {
    return "";
  }
}

export type DocSource = { kind: "pdf"; base64: string; name: string } | { kind: "text"; text: string; name: string };

export async function parseEstrategia(brand: string, doc: DocSource): Promise<Estrategia> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Falta ANTHROPIC_API_KEY: sin ella no se puede leer el documento.");

  const notes = await readStyleNotes();
  const system = `${SYSTEM}

── NOTAS DE ESTILO DEL EQUIPO ──
Estas notas son MÁS RECIENTES que las reglas de arriba y ganan si se contradicen.

${notes || "(sin notas todavía)"}`;

  const instruction = `MARCA: ${brand}

Este es el documento con la forma de trabajo de Full Service y la estrategia para ${brand}. Conviértelo en la propuesta estructurada.`;

  const content: Anthropic.ContentBlockParam[] =
    doc.kind === "pdf"
      ? [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.base64 } },
          { type: "text", text: instruction },
        ]
      : [{ type: "text", text: `${instruction}\n\n──── DOCUMENTO ────\n${doc.text}` }];

  const anthropic = new Anthropic({ apiKey: key });
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system,
    tools: [{ name: "emit_estrategia", description: "Entrega la propuesta estructurada.", input_schema: SCHEMA }],
    tool_choice: { type: "tool", name: "emit_estrategia" },
    messages: [{ role: "user", content }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Claude no devolvió la estrategia.");

  const parsed = block.input as Partial<Estrategia>;
  return {
    ...parsed,
    title: parsed.title || `Propuesta de Colaboración — ${brand}`,
    brand,
    escenarios: parsed.escenarios ?? [],
    panels: parsed.panels ?? [],
    funciones: parsed.funciones ?? [],
    pasos: parsed.pasos ?? [],
    lineas: parsed.lineas ?? [],
    creadores: [], // se eligen aparte, desde hubb
    sourceDocName: doc.name,
    parsedAt: new Date().toISOString(),
    engine: MODEL,
  };
}
