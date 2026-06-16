create table if not exists public.growth_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.growth_snapshots enable row level security;

drop policy if exists "Users can read own growth data" on public.growth_snapshots;
drop policy if exists "Users can insert own growth data" on public.growth_snapshots;
drop policy if exists "Users can update own growth data" on public.growth_snapshots;

create policy "Users can read own growth data"
on public.growth_snapshots
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own growth data"
on public.growth_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own growth data"
on public.growth_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
