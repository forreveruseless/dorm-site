-- ============================================================
-- ОБЩАГА — ВЕРСИЯ 8
-- Таблица общей карты связей комнат
-- Запусти ВЕСЬ этот файл в Supabase -> SQL Editor -> New query -> Run
-- ============================================================

create table if not exists public.room_links (
  room_a text not null,
  room_b text not null,
  relation_type text not null
    check (relation_type in ('close', 'friends', 'acquaintances')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (room_a, room_b),

  -- Клиент всегда кладёт комнаты в алфавитном порядке,
  -- поэтому одна и та же пара не сможет сохраниться дважды наоборот.
  constraint room_links_order check (room_a < room_b)
);

alter table public.room_links enable row level security;

grant select, insert, update on table public.room_links to anon;

drop policy if exists "public read room links" on public.room_links;
create policy "public read room links"
on public.room_links
for select
to anon
using (true);

drop policy if exists "public insert room links" on public.room_links;
create policy "public insert room links"
on public.room_links
for insert
to anon
with check (true);

drop policy if exists "public update room links" on public.room_links;
create policy "public update room links"
on public.room_links
for update
to anon
using (true)
with check (true);
