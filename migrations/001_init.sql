-- 001_init — esquema base de la app de ventas y estrategias.
-- Un proyecto es una marca + un tipo de entregable. El contenido vive en jsonb
-- (research / estrategia) porque el formulario evoluciona seguido; el HTML ya
-- publicado se congela en renders para que /r/{slug} nunca dependa de que el
-- render actual siga produciendo lo mismo.

-- gen_random_uuid() es core desde Postgres 13, así que no hace falta pgcrypto.

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  name          text not null,
  role          text not null default 'member' check (role in ('admin', 'member')),
  created_at    timestamptz not null default now()
);

create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  brand        text not null,
  kind         text not null check (kind in ('venta', 'estrategia')),
  status       text not null default 'draft' check (status in ('draft', 'published')),
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists projects_kind_updated_idx on projects (kind, updated_at desc);

-- Research de la llamada de venta: paid media + orgánico. Un solo documento
-- por proyecto, sobrescrito en cada guardado.
create table if not exists research (
  project_id uuid primary key references projects(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Estrategia post-pago: lo que Claude sacó del documento de Henry, ya editado.
create table if not exists estrategia (
  project_id     uuid primary key references projects(id) on delete cascade,
  data           jsonb not null default '{}'::jsonb,
  source_doc_url text,
  updated_at     timestamptz not null default now()
);

-- El HTML servido en fs.hubb.mx/r/{slug}. Se regenera al publicar, no al leer.
create table if not exists renders (
  project_id  uuid primary key references projects(id) on delete cascade,
  html        text not null,
  rendered_at timestamptz not null default now()
);

-- Creativos, miniaturas, screenshots y documentos subidos, todos en Blob.
create table if not exists assets (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind       text not null,
  blob_url   text not null,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists assets_project_idx on assets (project_id, kind);

-- Notas de estilo que pesan sobre el prompt de copy. Antes era el archivo
-- style-notes.md de research-pitch; aquí vive en DB para que lo edite el equipo.
create table if not exists style_notes (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null default 'venta' check (scope in ('venta', 'estrategia')),
  note       text not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
