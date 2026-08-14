/* Llena el alta con solo la página web de la marca. No crea nada: devuelve lo
   que encontró para que el formulario lo proponga y tú lo confirmes. */
import { autocompletar, normalizaUrl } from "@/lib/venta/autocompletar";
import { requireSessionApi, apiError } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    await requireSessionApi();
    const { site } = (await req.json()) as { site?: string };
    if (!site?.trim()) return Response.json({ error: "Falta la página web." }, { status: 400 });

    try {
      new URL(normalizaUrl(site));
    } catch {
      return Response.json({ error: "Esa no parece una dirección válida." }, { status: 400 });
    }

    return Response.json(await autocompletar(site));
  } catch (err) {
    return apiError(err);
  }
}
