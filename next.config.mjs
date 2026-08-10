import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sin esto Turbopack sube hasta ~/ buscando el lockfile y toma el home del
  // usuario como raíz del proyecto.
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },

  // Los creativos de anuncios y las miniaturas se copian a Vercel Blob al
  // scrapear, así que las únicas imágenes remotas que renderizamos son las
  // nuestras. Las de hubb (avatares de creadores) llegan por su CDN.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.r2.dev" },
    ],
  },
};

export default nextConfig;
