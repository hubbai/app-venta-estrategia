/* autocompletar.ts — Llenar el formulario con solo la página web.

   El alta pedía cinco campos y cuatro había que ir a buscarlos. De esos, dos se
   sacan de la propia página con buena confianza (cómo se llama la marca y qué
   vende) y dos —los handles— no siempre: las marcas que nos interesan son
   chicas y usan abreviaturas (RESILIENT es @rslnt_mx), que es justo lo que
   ningún buscador por nombre encuentra.

   Se midió antes de escribir esto:
     · HTML de la página → los links sociales aparecen en 1 de cada 5 sitios;
       el resto los pinta JavaScript y no llegan en el HTML crudo.
     · Ad Library por nombre → devuelve homónimos ("Resilient Retail Club").
     · Buscador de cuentas de TikTok → 30 resultados globales, la marca chica
       no aparece.

   Así que la regla aquí es: un handle solo se propone si se pudo VERIFICAR que
   la cuenta existe y que es de esta marca. Prellenar uno equivocado es peor que
   dejarlo vacío, porque el research se va callado por la cuenta de alguien más
   y el error aparece hasta la llamada. */
import Anthropic from "@anthropic-ai/sdk";
import { instagramProfile, scrapeReady, tiktokProfile } from "../scrape/scrapecreators";

const MODEL = "claude-sonnet-5";
const TIMEOUT_MS = 15_000;

export type Autocompletado = {
  brand?: string;
  industry?: string;
  instagramHandle?: string;
  tiktokHandle?: string;
  /* De dónde salió cada cosa, para pintarlo en el formulario. El usuario tiene
     que poder distinguir "esto lo leí de tu página" de "esto lo deduje". */
  fuentes: Record<string, string>;
  aviso?: string;
};

/* ── 1. La página ────────────────────────────────────────────────────── */

type Sitio = { title: string; description: string; ig: string[]; tt: string[] };

const NO_SON_HANDLES = new Set(["p", "reel", "reels", "explore", "accounts", "instagram", "tiktok", "share", "tag"]);

export async function leerSitio(url: string): Promise<Sitio | null> {
  try {
    const res = await fetch(url, {
      headers: {
        // Sin User-Agent de navegador, varios responden 403 o una página vacía.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const html = (await res.text()).slice(0, 400_000);
    const meta = (name: string) =>
      new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)?.[1] ??
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i").exec(html)?.[1] ??
      "";

    const handles = (re: RegExp) =>
      [...new Set([...html.matchAll(re)].map((m) => m[1].toLowerCase()))].filter((h) => !NO_SON_HANDLES.has(h));

    return {
      title: (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "").replace(/\s+/g, " ").trim(),
      description: (meta("description") || meta("og:description")).replace(/\s+/g, " ").trim(),
      ig: handles(/instagram\.com\/([A-Za-z0-9_.]{2,30})/g),
      tt: handles(/tiktok\.com\/@([A-Za-z0-9_.]{2,30})/g),
    };
  } catch {
    return null;
  }
}

/* ── 2. Qué es la marca, según su propia página ──────────────────────── */

const LECTURA_SCHEMA = {
  type: "object" as const,
  required: ["brand", "industry"],
  properties: {
    brand: {
      type: "string",
      description:
        "Cómo se llama la marca, sola. Sin el tagline, sin la ciudad y sin el rubro: de 'RESILIENT | Ropa Deportiva Premium Hecha en México' sale 'RESILIENT'.",
    },
    industry: {
      type: "string",
      description:
        "Qué vende, en una línea de menos de 90 caracteres, como se lo dirías a un colega. Incluye el rango de precio y el canal SOLO si vienen en el texto. Nada de adjetivos de marketing.",
    },
  },
};

async function leerMarca(sitio: Sitio, url: string): Promise<{ brand?: string; industry?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return {};
  try {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system:
        "Lees el título y la descripción de la página de una marca y dices cómo se llama y qué vende. No inventes: si el texto no dice el precio o el canal, no los pongas. Español de México.",
      tools: [{ name: "emit", description: "Entrega la lectura.", input_schema: LECTURA_SCHEMA }],
      tool_choice: { type: "tool", name: "emit" },
      messages: [
        {
          role: "user",
          content: `URL: ${url}\nTITLE: ${sitio.title}\nDESCRIPTION: ${sitio.description}`,
        },
      ],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return {};
    return block.input as { brand?: string; industry?: string };
  } catch (err) {
    console.error("[autocompletar:marca]", err);
    return {};
  }
}

/* ── 3. Los handles, solo si se pueden verificar ─────────────────────── */

/** Variantes que suele usar una marca, de la más probable a la menos. */
function candidatos(brand: string, url: string): string[] {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  let dominio = "";
  try {
    dominio = slug(new URL(url).hostname.replace(/^www\./, "").split(".")[0]);
  } catch {
    /* la URL ya se validó antes; si falla, nos quedamos con la marca */
  }
  const base = slug(brand);
  return [...new Set([dominio, base, `${base}mx`, `${base}_mx`, `${base}.mx`, `${base}oficial`].filter(Boolean))];
}

const IDENTIDAD_SCHEMA = {
  type: "object" as const,
  required: ["esLaMarca"],
  properties: {
    esLaMarca: { type: "boolean", description: "true solo si el perfil es de ESA marca." },
    porque: { type: "string", description: "Máximo 60 caracteres." },
  },
};

/* Que la cuenta exista no basta: @resilient puede ser de cualquiera. Se compara
   el perfil contra lo que sabemos de la marca antes de proponerlo. */
async function esDeLaMarca(
  perfil: { name?: string; bio?: string; handle?: string },
  marca: { brand: string; industry?: string; site: string }
): Promise<boolean> {
  const key = process.env.ANTHROPIC_API_KEY;
  // Sin Claude no se arriesga: se prefiere el campo vacío.
  if (!key) return false;
  try {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system:
        "Decides si un perfil de red social pertenece a una marca concreta o a alguien más que casualmente tiene un nombre parecido. Si no hay señales claras de que es la misma marca (mismo giro, mismo país, el sitio en la bio), contesta false. Ante la duda, false: es peor prellenar la cuenta equivocada que dejar el campo vacío.",
      tools: [{ name: "emit", description: "Entrega el veredicto.", input_schema: IDENTIDAD_SCHEMA }],
      tool_choice: { type: "tool", name: "emit" },
      messages: [
        {
          role: "user",
          content: `MARCA: ${marca.brand}
QUÉ VENDE: ${marca.industry || "no especificado"}
SITIO: ${marca.site}

PERFIL ENCONTRADO
handle: @${perfil.handle || "?"}
nombre: ${perfil.name || "—"}
bio: ${perfil.bio || "—"}

¿Es la cuenta de esa marca?`,
        },
      ],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return false;
    return Boolean((block.input as { esLaMarca?: boolean }).esLaMarca);
  } catch (err) {
    console.error("[autocompletar:identidad]", err);
    return false;
  }
}

async function buscarHandle(
  red: "instagram" | "tiktok",
  desdeElSitio: string[],
  posibles: string[],
  marca: { brand: string; industry?: string; site: string }
): Promise<{ handle?: string; fuente?: string }> {
  if (!scrapeReady()) return {};

  /* Los del sitio primero y sin límite de intentos razonable: si la marca puso
     el link en su propia página, es su cuenta. Los deducidos van después y se
     prueban pocos, porque cada intento cuesta un crédito. */
  const lista = [...desdeElSitio, ...posibles.filter((p) => !desdeElSitio.includes(p))].slice(0, 4);

  for (const handle of lista) {
    try {
      const perfil =
        red === "instagram"
          ? await instagramProfile(handle).then((r) => ({
              handle: r.data?.user?.username,
              name: r.data?.user?.full_name,
              bio: r.data?.user?.biography,
              existe: Boolean(r.data?.user),
            }))
          : await tiktokProfile(handle).then((r) => ({
              handle: r.user?.uniqueId,
              name: r.user?.nickname,
              bio: r.user?.signature,
              existe: Boolean(r.user),
            }));

      if (!perfil.existe) continue;

      // Del propio sitio no hace falta preguntarle a nadie: la marca lo publicó.
      if (desdeElSitio.includes(handle)) return { handle: perfil.handle, fuente: "está en tu página web" };
      if (await esDeLaMarca(perfil, marca)) return { handle: perfil.handle, fuente: "encontrada y verificada" };
    } catch {
      // Handle inexistente: ScrapeCreators lo reporta como error. Siguiente.
      continue;
    }
  }
  return {};
}

/* ── Todo junto ──────────────────────────────────────────────────────── */

export async function autocompletar(siteUrl: string): Promise<Autocompletado> {
  const url = normalizaUrl(siteUrl);
  const fuentes: Record<string, string> = {};

  const sitio = await leerSitio(url);
  if (!sitio) {
    return { fuentes, aviso: "No se pudo leer esa página (puede estar bloqueando robots). Llena los campos a mano." };
  }

  const { brand, industry } = await leerMarca(sitio, url);
  if (brand) fuentes.brand = "leído de tu página";
  if (industry) fuentes.industry = "leído de tu página";

  const marca = { brand: brand || "", industry, site: url };
  const posibles = brand ? candidatos(brand, url) : candidatos("", url);

  const [ig, tt] = await Promise.all([
    buscarHandle("instagram", sitio.ig, posibles, marca),
    buscarHandle("tiktok", sitio.tt, posibles, marca),
  ]);
  if (ig.fuente) fuentes.instagramHandle = ig.fuente;
  if (tt.fuente) fuentes.tiktokHandle = tt.fuente;

  const faltan = [!ig.handle && "Instagram", !tt.handle && "TikTok"].filter(Boolean);

  return {
    brand,
    industry,
    instagramHandle: ig.handle,
    tiktokHandle: tt.handle,
    fuentes,
    aviso: faltan.length
      ? `No pude confirmar ${faltan.join(" ni ")}. Muchas marcas usan abreviaturas (RESILIENT es @rslnt_mx), y prefiero dejarlo vacío a llenarlo con la cuenta de alguien más.`
      : undefined,
  };
}

export function normalizaUrl(raw: string): string {
  const s = raw.trim();
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}
