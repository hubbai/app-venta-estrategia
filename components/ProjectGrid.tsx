import Link from "next/link";
import type { ProjectListItem } from "@/lib/projects";

const PUBLIC_BASE = process.env.NEXT_PUBLIC_SITE_BASE || "https://fs.hubb.mx";

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export default function ProjectGrid({
  projects,
  emptyHref,
  emptyLabel,
}: {
  projects: ProjectListItem[];
  emptyHref: string;
  emptyLabel: string;
}) {
  if (projects.length === 0) {
    return (
      <div className="card mt-6 p-10 text-center text-fg-muted">
        Todavía no hay nada aquí.{" "}
        <Link href={emptyHref} className="text-iris underline">
          {emptyLabel}
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/${p.kind}/${p.slug}`}
          className="card group flex flex-col justify-between p-5 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_18px_50px_-22px_rgba(26,20,10,.35)]"
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="text-lg font-bold tracking-tight">{p.brand}</div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  p.status === "published"
                    ? "bg-[color-mix(in_srgb,var(--color-ok)_16%,transparent)] text-[var(--color-ok)]"
                    : "bg-surface-2 text-fg-faint"
                }`}
              >
                {p.status === "published" ? "Publicado" : "Borrador"}
              </span>
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-fg-faint">
              {fmt(p.updated_at)}
              {p.author ? ` · ${p.author}` : ""}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="truncate text-xs text-fg-faint">
              {p.status === "published" ? `${PUBLIC_BASE.replace(/^https?:\/\//, "")}/r/${p.slug}` : `/r/${p.slug}`}
            </span>
            <span className="shrink-0 text-sm font-semibold text-iris">Abrir →</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
