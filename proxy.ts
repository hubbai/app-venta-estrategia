/* proxy.ts — Todo es privado por default. (Es el antiguo middleware.ts; Next 16
   renombró la convención.)

   Solo se dejan pasar el login, sus endpoints, y /api/public/* (que es lo que
   consume fs.hubb.mx para servir los links compartidos, con su propio token).
   Cualquier ruta nueva queda protegida sin tener que acordarse de nada. */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

const PUBLIC = ["/login", "/api/auth/login", "/api/public"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  // Para regresar a donde iba después de entrar.
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Excluye los assets de Next y los archivos estáticos; todo lo demás pasa
  // por aquí, incluidas las rutas que aún no existen.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
