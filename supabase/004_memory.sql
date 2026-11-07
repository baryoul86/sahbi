-- Sahbi: memoria (nome, città, studi...). Da incollare in Supabase > SQL Editor > Run (dopo 003_video.sql).
-- Si può eseguire più volte senza danni. Se il file non è stato eseguito, Sahbi funziona lo stesso, senza memoria.

create table if not exists public.memories (
  user_id uuid primary key references auth.users (id) on delete cascade,
  facts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Solo il server (chiave segreta) legge e scrive i ricordi.
alter table public.memories enable row level security;
revoke all on public.memories from anon, authenticated;
