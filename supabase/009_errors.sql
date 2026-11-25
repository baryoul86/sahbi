-- Sahbi: errori visti dagli utenti (login, chat, pagina), raccolti in automatico per il controllo del mattino.
-- Da incollare in Supabase > SQL Editor > Run. Si può eseguire più volte.
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  kind text not null check (char_length(kind) <= 40),
  message text not null check (char_length(message) <= 600),
  meta jsonb not null default '{}'::jsonb,   -- app, lingua, paese (dal server), versione: niente e-mail, niente testo dei messaggi
  created_at timestamptz not null default now()
);
create index if not exists client_errors_time_idx on public.client_errors (created_at desc);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
-- Pulizia: si tengono 30 giorni.
delete from public.client_errors where created_at < now() - interval '30 days';
