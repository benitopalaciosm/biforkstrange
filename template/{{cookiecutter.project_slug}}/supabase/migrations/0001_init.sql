create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.simulations enable row level security;

-- cada usuario lee sus propias corridas; el backend escribe con service key (salta RLS)
create policy "read own simulations" on public.simulations
  for select using (auth.uid() = user_id);
