-- =========================================================
-- Poemas que Visten — schema inicial
-- Ejecutar en Supabase: SQL Editor > New query > pegar todo > Run
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type pedido_estado as enum (
  'pendiente',
  'pagado',
  'en_produccion',
  'error_produccion',
  'enviado',
  'entregado',
  'cancelado'
);

create type postulacion_estado as enum (
  'pendiente',
  'aprobada',
  'rechazada'
);

-- ---------- autores ----------
create table autores (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nombre text not null,
  nacionalidad text,
  biografia text,
  fotografia text,
  creado_en timestamptz not null default now()
);

-- ---------- poemas ----------
-- El contenido y el audio SOLO se sirven a través de la function
-- que valida el qr_code de pedido_items. No hay lectura pública directa.
create table poemas (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references autores(id) on delete restrict,
  titulo text not null,
  contenido text not null,
  audio_url text,
  contexto text,
  dominio_publico boolean not null default false,
  creado_en timestamptz not null default now()
);

-- ---------- productos (catálogo público) ----------
create table productos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nombre text not null,
  autor_id uuid not null references autores(id) on delete restrict,
  poema_id uuid not null references poemas(id) on delete restrict,
  tema text,                        -- ej. "mar", "amor" — para filtros y SEO, nunca el poema
  precio numeric(10,2) not null,
  tallas text[] not null default '{XS,S,M,L,XL}',
  colores text[] not null default '{blanco,negro}',
  imagen text,
  mockup text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create index idx_productos_activo on productos(activo);
create index idx_productos_tema on productos(tema);

-- ---------- clientes ----------
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  email text unique not null,
  telefono text,
  newsletter boolean not null default false,
  newsletter_consentimiento_fecha timestamptz,
  creado_en timestamptz not null default now()
);

-- ---------- pedidos ----------
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  stripe_id text unique,
  gelato_id text,
  estado pedido_estado not null default 'pendiente',
  cliente_id uuid references clientes(id) on delete set null,
  total numeric(10,2) not null,
  tracking text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index idx_pedidos_estado on pedidos(estado);

-- ---------- pedido_items ----------
-- Unidad real de trazabilidad: un qr_code único por prenda vendida,
-- no por producto de catálogo.
create table pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete restrict,
  talla text not null,
  color text not null,
  cantidad integer not null default 1,
  precio_unitario numeric(10,2) not null,
  qr_code text unique not null default encode(gen_random_bytes(12), 'hex'),
  escaneado boolean not null default false,
  fecha_escaneo timestamptz,
  -- Narración personal del comprador (opcional). Si existe, sustituye
  -- a la narración oficial del poema en /mi-poema/[qr_code].
  narracion_audio_url text,
  narracion_consentimiento boolean not null default false,
  -- Solo se libera en la página del poema cuando el pedido pasa a 'enviado'.
  creado_en timestamptz not null default now()
);

create index idx_pedido_items_qr on pedido_items(qr_code);
create index idx_pedido_items_pedido on pedido_items(pedido_id);

-- ---------- postulaciones (programa de autores) ----------
-- Nace SIEMPRE en estado pendiente. Nunca se autopublica: alguien del
-- equipo editorial debe pasar el estado a 'aprobada' manualmente, y
-- solo entonces se crea a mano el autor/poema/producto correspondiente.
create table postulaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  poema_titulo text,
  poema_texto text not null,
  nota text,
  estado postulacion_estado not null default 'pendiente',
  revisado_por text,
  revisado_en timestamptz,
  creado_en timestamptz not null default now()
);

-- ---------- articulos (blog) ----------
create table articulos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  titulo text not null,
  resumen text,
  contenido text not null,
  imagen text,
  categoria text,                              -- poesía | literatura | regalos
  producto_relacionado_id uuid references productos(id) on delete set null,
  autor_relacionado_id uuid references autores(id) on delete set null,
  meta_title text,
  meta_description text,
  publicado boolean not null default false,
  fecha_publicacion timestamptz,
  creado_en timestamptz not null default now()
);

create index idx_articulos_publicado on articulos(publicado);

-- =========================================================
-- RLS — Row Level Security
-- Todas las tablas empiezan bloqueadas; solo se abre lo estrictamente
-- público. Todo lo demás pasa por las Netlify Functions con la
-- service_role key (que ignora RLS).
-- =========================================================

alter table autores enable row level security;
alter table poemas enable row level security;
alter table productos enable row level security;
alter table clientes enable row level security;
alter table pedidos enable row level security;
alter table pedido_items enable row level security;
alter table postulaciones enable row level security;
alter table articulos enable row level security;

-- Catálogo público: productos activos
create policy "productos activos son públicos"
  on productos for select
  using (activo = true);

-- Autores: solo datos de bio, lectura pública (no hay campos sensibles)
create policy "autores son públicos"
  on autores for select
  using (true);

-- Blog: solo artículos publicados
create policy "articulos publicados son públicos"
  on articulos for select
  using (publicado = true);

-- Postulaciones: cualquiera puede enviar, nadie puede leer/editar desde el cliente
create policy "cualquiera puede postular"
  on postulaciones for insert
  with check (true);

-- poemas, clientes, pedidos, pedido_items:
-- SIN políticas de select/insert/update para el rol público.
-- Acceso exclusivo vía service_role key en las Netlify Functions,
-- que valida qr_code, estado de pedido, y consentimiento antes de servir nada.
