create extension if not exists pgcrypto;

create table if not exists public.ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('daily_review', 'period_review', 'daily_task', 'random_task', 'random_reward')),
  source_hash text,
  prompt_version text not null,
  model text not null,
  status text not null check (status in ('success', 'error')),
  result jsonb,
  error_message text,
  usage jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_generation_logs_user_created_idx
  on public.ai_generation_logs (user_id, created_at desc);

create index if not exists ai_generation_logs_cache_idx
  on public.ai_generation_logs (user_id, mode, source_hash, prompt_version, created_at desc)
  where status = 'success';

alter table public.ai_generation_logs enable row level security;

revoke all on public.ai_generation_logs from anon, authenticated;

comment on table public.ai_generation_logs is
  'Server-only DeepSeek generation cache, rate-limit and usage log. Accessed by Edge Functions with the service role.';
