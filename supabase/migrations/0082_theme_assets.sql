-- ============================================================
-- Migration 0082 — theme_assets
-- ============================================================
-- Catalogue des assets scrapés par /heist pour chaque thème.
-- Les binaires restent sur disque (public/themes/<slug>/assets/).
-- Cette table stocke uniquement les métadonnées + chemin local.
-- RLS : lecture publique (assets = ressources de design, non sensibles),
--       écriture restreinte au service role (inserts via seed.sql).
-- ============================================================

create table if not exists public.theme_assets (
  id           uuid primary key default gen_random_uuid(),
  theme_slug   text not null,
  asset_url    text not null,
  local_path   text,
  asset_type   text not null default 'image',
  category     text not null default 'image',
  alt_text     text,
  width        int  not null default 0,
  height       int  not null default 0,
  file_size    int  not null default 0,
  mime_type    text,
  source_page  text,
  filename     text,
  captured_at  timestamptz not null default now(),
  constraint theme_assets_slug_url unique (theme_slug, asset_url)
);

create index if not exists theme_assets_slug_idx    on public.theme_assets (theme_slug);
create index if not exists theme_assets_category_idx on public.theme_assets (theme_slug, category);
create index if not exists theme_assets_page_idx    on public.theme_assets (theme_slug, source_page);

alter table public.theme_assets enable row level security;

drop policy if exists "theme_assets_public_read" on public.theme_assets;
create policy "theme_assets_public_read"
  on public.theme_assets
  for select
  using (true);

comment on table public.theme_assets is
  'Assets scrapés par /heist (images, SVG, icons, vidéos, fonts) par thème. Métadonnées uniquement — binaires dans public/themes/<slug>/assets/. Catalogue dans themes/<slug>/catalog.html.';
comment on column public.theme_assets.asset_url    is 'URL source originale sur le site scrappé.';
comment on column public.theme_assets.local_path   is 'Chemin public relatif, ex: /themes/slug/assets/file.jpg.';
comment on column public.theme_assets.category     is 'photo | logo | icon | svg | background | image | video | font.';
comment on column public.theme_assets.source_page  is 'Page (pathname) où l''asset a été trouvé.';
