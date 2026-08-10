/* projects.ts — CRUD de proyectos. Un proyecto = una marca + un entregable
   ('venta' o 'estrategia'). Los dos módulos comparten esta tabla para que el
   índice, los permisos y el publicado funcionen igual en ambos. */
import { sql } from "./db";
import { slugify } from "./slug";

export type Kind = "venta" | "estrategia";
export type Status = "draft" | "published";

export type Project = {
  id: string;
  slug: string;
  brand: string;
  kind: Kind;
  status: Status;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type ProjectListItem = Project & { author: string | null };

export async function listProjects(kind?: Kind): Promise<ProjectListItem[]> {
  return sql<ProjectListItem[]>`
    select p.*, u.name as author
    from projects p
    left join users u on u.id = p.created_by
    ${kind ? sql`where p.kind = ${kind}` : sql``}
    order by p.updated_at desc
    limit 500
  `;
}

export async function getProject(slug: string): Promise<Project | null> {
  const rows = await sql<Project[]>`select * from projects where slug = ${slug} limit 1`;
  return rows[0] ?? null;
}

/* El slug sale de la marca; si ya está tomado se le pega -2, -3… en vez de
   fallar, porque una misma marca puede tener venta y estrategia. */
export async function createProject(input: {
  brand: string;
  kind: Kind;
  createdBy: string;
  slugHint?: string;
}): Promise<Project> {
  const brand = input.brand.trim();
  if (!brand) throw new Error("Falta el nombre de la marca.");

  const base = slugify(input.slugHint || brand) || "marca";
  let slug = input.kind === "estrategia" && !input.slugHint ? `${base}-estrategia` : base;

  for (let i = 2; await getProject(slug); i++) slug = `${base}-${i}`;

  const rows = await sql<Project[]>`
    insert into projects (slug, brand, kind, created_by)
    values (${slug}, ${brand}, ${input.kind}, ${input.createdBy})
    returning *
  `;
  return rows[0];
}

export async function touchProject(id: string): Promise<void> {
  await sql`update projects set updated_at = now() where id = ${id}`;
}

export async function publishProject(id: string, html: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      insert into renders (project_id, html, rendered_at)
      values (${id}, ${html}, now())
      on conflict (project_id) do update set html = excluded.html, rendered_at = now()
    `;
    await tx`
      update projects
      set status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
      where id = ${id}
    `;
  });
}

export async function unpublishProject(id: string): Promise<void> {
  await sql`update projects set status = 'draft', updated_at = now() where id = ${id}`;
}

export async function deleteProject(id: string): Promise<void> {
  await sql`delete from projects where id = ${id}`;
}

/* Lo que sirve fs.hubb.mx/r/{slug}: solo publicados. */
export async function getPublishedHtml(slug: string): Promise<string | null> {
  const rows = await sql<{ html: string }[]>`
    select r.html
    from renders r
    join projects p on p.id = r.project_id
    where p.slug = ${slug} and p.status = 'published'
    limit 1
  `;
  return rows[0]?.html ?? null;
}
