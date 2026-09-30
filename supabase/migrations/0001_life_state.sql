-- Life OS: one JSON document per user, mirrored from the client store.
create table if not exists public.life_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  client_id text,
  updated_at timestamptz not null default now()
);

alter table public.life_state enable row level security;

create policy "read own state" on public.life_state
  for select using (auth.uid() = user_id);

create policy "insert own state" on public.life_state
  for insert with check (auth.uid() = user_id);

create policy "update own state" on public.life_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- live updates across devices
alter publication supabase_realtime add table public.life_state;
