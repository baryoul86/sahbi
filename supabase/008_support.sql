-- Sahbi: assistenza (pulsante "Assistance" nell'app → pannello amministratore).
-- Da incollare in Supabase > SQL Editor > Run. Si può eseguire più volte senza danni.
-- Il server legge e scrive con la chiave segreta; gli utenti non toccano mai la tabella direttamente.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  message text not null check (char_length(message) between 3 and 4000),
  shot text,                                   -- percorso dello screenshot nella cartella privata 'images'
  meta jsonb not null default '{}'::jsonb,     -- telefono, app, versione, Pro, ultimo errore
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  reply text,
  replied_at timestamptz,
  user_seen boolean not null default true,     -- false = c'è una risposta che l'utente non ha ancora visto
  created_at timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from anon, authenticated;
