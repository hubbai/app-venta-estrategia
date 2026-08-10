/* blob.ts — Todo lo visual del entregable vive en Vercel Blob.

   Las URLs que devuelven Meta y TikTok caducan (firma con expiración) y
   además bloquean el hotlinking. Si el HTML publicado apuntara ahí, la
   presentación se rompería sola en días. Por eso todo se copia a Blob al
   scrapear, una sola vez. */
import { put } from "@vercel/blob";

export function blobReady(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/* Baja un archivo remoto y lo guarda en Blob. Devuelve null si algo falla:
   una miniatura perdida no debe tumbar todo el scraping. */
export async function mirror(url: string | undefined, key: string): Promise<string | null> {
  if (!url || !blobReady()) return null;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        // TikTok e Instagram sirven la imagen solo con el Referer correcto.
        Referer: url.includes("tiktok") ? "https://www.tiktok.com/" : "https://www.instagram.com/",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;

    const type = res.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/") && !type.startsWith("video/")) return null;

    const blob = await put(key, await res.arrayBuffer(), {
      access: "public",
      contentType: type,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch {
    return null;
  }
}

/* Sube un archivo que llegó del navegador (screenshots, doc de Henry). */
export async function upload(file: File, key: string): Promise<string> {
  const blob = await put(key, file, {
    access: "public",
    contentType: file.type || "application/octet-stream",
    addRandomSuffix: true,
  });
  return blob.url;
}
