import Link from "next/link";
import { getSession } from "@/lib/session";
import LogoutButton from "./LogoutButton";

export default async function AppHeader() {
  const session = await getSession();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-acid" />
          <span className="font-bold tracking-tight">HUBB</span>
          <span className="text-sm text-fg-faint">Ventas y estrategias</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/venta" className="text-fg-muted hover:text-fg">
            Ventas
          </Link>
          <Link href="/estrategia" className="text-fg-muted hover:text-fg">
            Estrategias
          </Link>
          <Link href="/ajustes/estilo" className="text-fg-muted hover:text-fg">
            Estilo
          </Link>
          {session?.role === "admin" && (
            <Link href="/equipo" className="text-fg-muted hover:text-fg">
              Equipo
            </Link>
          )}
          {session && (
            <>
              <span className="hidden text-fg-faint sm:inline">{session.name}</span>
              <LogoutButton />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
