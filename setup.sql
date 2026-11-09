-- Run this ONCE in Supabase: SQL Editor > New query > paste > Run.
-- Replace YOUR-OWNER-UUID (2 places in each policy) with your user's UUID
-- (Authentication > Users > click your user > copy "User UID").

-- 1) the table
create table if not exists public.entries (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);
alter table public.entries enable row level security;

-- everyone can read
create policy "anyone can read entries" on public.entries
  for select using (true);

-- only the owner can add / edit / delete
create policy "owner inserts" on public.entries
  for insert to authenticated with check (auth.uid() = '0ae339c9-9505-4f7c-ae35-ac3ba29216b4');
create policy "owner updates" on public.entries
  for update to authenticated using (auth.uid() = '0ae339c9-9505-4f7c-ae35-ac3ba29216b4') with check (auth.uid() = '0ae339c9-9505-4f7c-ae35-ac3ba29216b4');
create policy "owner deletes" on public.entries
  for delete to authenticated using (auth.uid() = '0ae339c9-9505-4f7c-ae35-ac3ba29216b4');

-- 2) the photo/video bucket (public to read)
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;

create policy "owner uploads media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and auth.uid() = '0ae339c9-9505-4f7c-ae35-ac3ba29216b4');
create policy "owner updates media" on storage.objects
  for update to authenticated using (bucket_id = 'media' and auth.uid() = '0ae339c9-9505-4f7c-ae35-ac3ba29216b4');
create policy "owner deletes media" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and auth.uid() = '0ae339c9-9505-4f7c-ae35-ac3ba29216b4');
