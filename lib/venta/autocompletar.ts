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
import { companyAds, instagramProfile, scrapeReady, searchCompanies, tiktokProfile } from "../scrape/scrapecreators";

const MODEL = "claude-sonnet-5";
const TIMEOUT_MS = 15_000;

export type Autocompletado = {
  brand?: string;
  industry?: string;
  instagramHandle?: string;
  tiktokHandle?: string;
  /* Si se identificó al anunciante, se pasa para que el research vaya directo a
     su Ad Library y no haya que elegirlo después en el desambiguador. */
  adPageId?: string;
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

/* ── 2b. Si la web está cerrada, la Ad Library ───────────────────────── */

/* Los sitios corporativos suelen estar detrás de un escudo antibots: telcel.com
   contesta 403 a cualquier cosa que no sea un navegador de verdad. Pero esas
   mismas marcas son anunciantes grandes, y la Ad Library publica su nombre, su
   giro, su Instagram y sus anuncios activos. Es data que la marca misma puso.

   Se elige por nombre y se desempata por likes de la página: "Telcel" (5.4M
   likes) contra "Planes Telcel Libre" (1.9K) no tiene discusión. */
type Anunciante = { pageId: string; name: string; category?: string; ig?: string };

async function desdeAdLibrary(nombre: string): Promise<Anunciante | null> {
  if (!scrapeReady() || !nombre) return null;
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const objetivo = slug(nombre);

  try {
    const companies = await searchCompanies(nombre);
    /* Coincidencia por PALABRA COMPLETA, no por prefijo.
       "kredi" contra "KreditBee" (una app de préstamos de India) empieza igual,
       y así fue como una búsqueda de Kredi México devolvió el Instagram de otra
       empresa. Con palabra completa, "Kredi México" sigue coincidiendo y
       "KreditBee" ya no. */
    const puntua = (c: { name?: string; likes?: number }) => {
      const nombreCompleto = slug(c.name || "");
      if (nombreCompleto === objetivo) return 3;
      const primeraPalabra = slug((c.name || "").split(/[\s|·—–-]+/)[0] || "");
      if (primeraPalabra === objetivo) return 2;
      return 0;
    };
    const mejor = companies
      .filter((c) => puntua(c) > 0)
      .sort((a, b) => puntua(b) - puntua(a) || (b.likes ?? 0) - (a.likes ?? 0))[0];

    if (!mejor?.page_id) return null;
    return { pageId: mejor.page_id, name: mejor.name || nombre, category: mejor.category, ig: mejor.ig_username };
  } catch (err) {
    console.error("[autocompletar:adlibrary]", err);
    return null;
  }
}

/* Qué vende, contado con su propia publicidad. No es invención del modelo: son
   los anuncios que la marca trae corriendo hoy. */
async function queVendeSegunSusAnuncios(a: Anunciante): Promise<string | undefined> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return a.category;

  let copies: string[] = [];
  try {
    const ads = await companyAds({ pageId: a.pageId, country: "MX", status: "ACTIVE" });
    copies = ads
      .slice(0, 6)
      .map((ad) => {
        const s = (ad.snapshot ?? {}) as Record<string, { text?: string } | undefined>;
        return String(s.body?.text ?? "").replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);
  } catch {
    /* Sin anuncios nos quedamos con la categoría, que ya es algo. */
  }

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system:
        "Dices qué vende una marca en una línea de menos de 90 caracteres, en español de México, como se lo dirías a un colega. Te basas SOLO en lo que te dan. Si no alcanza para ser específico, sé general pero no inventes precios, canales ni productos que no aparezcan.",
      tools: [
        {
          name: "emit",
          description: "Entrega la línea.",
          input_schema: {
            type: "object" as const,
            required: ["industry"],
            properties: { industry: { type: "string" } },
          },
        },
      ],
      tool_choice: { type: "tool", name: "emit" },
      messages: [
        {
          role: "user",
          content: `MARCA: ${a.name}
GIRO SEGÚN FACEBOOK: ${a.category || "no especificado"}
${copies.length ? `ANUNCIOS QUE TRAE CORRIENDO HOY:\n${copies.map((c) => `- ${c.slice(0, 200)}`).join("\n")}` : "(sin anuncios activos)"}

¿Qué vende?`,
        },
      ],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return a.category;
    return (block.input as { industry?: string }).industry || a.category;
  } catch (err) {
    console.error("[autocompletar:anuncios]", err);
    return a.category;
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

/* Un modelo al que no le alcanza la información a veces contesta con un
   marcador en vez de callarse: "<UNKNOWN>", "N/A", "desconocido". Eso no puede
   llegar al formulario como si fuera un dato. */
const NO_ES_DATO = /^\s*[<[(]?\s*(unknown|n\/?a|none|null|desconocido|sin (datos?|información))\s*[>\])]?\s*\.?\s*$/i;

function limpio(v?: string): string | undefined {
  const s = (v || "").trim();
  if (!s || s.length < 3 || NO_ES_DATO.test(s)) return undefined;
  return s;
}

/** "https://www.telcel.com/" → "Telcel". Es la mejor pista cuando no hay nada más. */
function marcaDelDominio(url: string): string {
  try {
    const raiz = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    return raiz.charAt(0).toUpperCase() + raiz.slice(1);
  } catch {
    return "";
  }
}

export async function autocompletar(siteUrl: string): Promise<Autocompletado> {
  const url = normalizaUrl(siteUrl);
  const fuentes: Record<string, string> = {};
  const avisos: string[] = [];

  const sitio = await leerSitio(url);

  let brand: string | undefined;
  let industry: string | undefined;
  let anuncios: Anunciante | null = null;

  if (sitio) {
    const leido = await leerMarca(sitio, url);
    brand = limpio(leido.brand);
    industry = limpio(leido.industry);
    if (brand) fuentes.brand = "leído de tu página";
    if (industry) fuentes.industry = "leído de tu página";
  } else {
    // La web está cerrada: 403 de un escudo antibots, o simplemente caída.
    avisos.push("Tu página bloquea la lectura automática, así que fui a su Ad Library.");
  }

  /* La Ad Library entra cuando la web no dio lo suficiente — no solo cuando
     está caída. Hay sitios que cargan pero no traen descripción (kredi.mx), y
     ahí los anuncios que la marca trae corriendo dicen mucho más. */
  if (!brand || !industry) {
    anuncios = await desdeAdLibrary(brand || marcaDelDominio(url));
    if (anuncios) {
      if (!brand) {
        brand = anuncios.name;
        fuentes.brand = "según su página de Facebook";
      }
      if (!industry) {
        industry = limpio(await queVendeSegunSusAnuncios(anuncios));
        if (industry) fuentes.industry = "deducido de sus anuncios activos";
      }
    }
  }

  const marca = { brand: brand || marcaDelDominio(url), industry, site: url };
  // El IG que publica la Ad Library es de la propia marca: va como candidato fuerte.
  const igDelSitio = [...(sitio?.ig ?? []), ...(anuncios?.ig ? [anuncios.ig.toLowerCase()] : [])];
  const posibles = candidatos(marca.brand, url);

  const [ig, tt] = await Promise.all([
    buscarHandle("instagram", igDelSitio, posibles, marca),
    buscarHandle("tiktok", sitio?.tt ?? [], posibles, marca),
  ]);
  if (ig.fuente) fuentes.instagramHandle = anuncios?.ig === ig.handle ? "está en su Ad Library" : ig.fuente;
  if (tt.fuente) fuentes.tiktokHandle = tt.fuente;

  const faltan = [!ig.handle && "Instagram", !tt.handle && "TikTok"].filter(Boolean);
  if (faltan.length) {
    avisos.push(
      `No pude confirmar ${faltan.join(" ni ")}: muchas marcas usan abreviaturas (RESILIENT es @rslnt_mx). Prefiero dejarlo vacío a llenarlo con la cuenta de alguien más — escríbelo tú y listo.`
    );
  }
  if (!brand) {
    avisos.push("Tampoco pude identificar la marca. Todos los campos son editables: llénalos a mano y sigue igual.");
  }

  return {
    brand,
    industry,
    instagramHandle: ig.handle,
    tiktokHandle: tt.handle,
    adPageId: anuncios?.pageId,
    fuentes,
    aviso: avisos.join(" ") || undefined,
  };
}

export function normalizaUrl(raw: string): string {
  const s = raw.trim();
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}
