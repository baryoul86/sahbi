-- Sahbi: database. Da incollare una volta in Supabase > SQL Editor > New query > Run.

-- Consumi giornalieri per utente: messaggi (chat), immagini (image), audio (voice).
create table if not exists public.usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('chat', 'image', 'voice')),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day, kind)
);

-- Nessuno può leggere o scrivere la tabella dal browser: solo il server (service role).
alter table public.usage enable row level security;

-- Giorno di riferimento: ora del Maghreb (UTC+1), così i crediti si ricaricano a mezzanotte locale.
create or replace function public.sahbi_today() returns date
language sql stable as $$ select (now() at time zone 'Africa/Algiers')::date $$;

-- Usa un credito in modo atomico. Restituisce quanti ne restano, oppure -1 se il limite è raggiunto.
create or replace function public.use_credit(p_user uuid, p_kind text, p_limit integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  c integer;
begin
  if p_limit <= 0 then
    return -1;
  end if;
  insert into public.usage (user_id, day, kind, count)
  values (p_user, public.sahbi_today(), p_kind, 1)
  on conflict (user_id, day, kind)
  do update set count = public.usage.count + 1
  where public.usage.count < p_limit
  returning count into c;
  if c is null then
    return -1;
  end if;
  return p_limit - c;
end $$;

-- Restituisce un credito quando la richiesta a OpenAI fallisce.
create or replace function public.refund_credit(p_user uuid, p_kind text)
returns void
language sql security definer set search_path = public as $$
  update public.usage set count = count - 1
  where user_id = p_user and day = public.sahbi_today() and kind = p_kind and count > 0;
$$;

-- Quanti crediti restano oggi.
create or replace function public.remaining_credit(p_user uuid, p_kind text, p_limit integer)
returns integer
language sql stable security definer set search_path = public as $$
  select greatest(p_limit - coalesce((
    select count from public.usage
    where user_id = p_user and day = public.sahbi_today() and kind = p_kind
  ), 0), 0);
$$;

-- Le funzioni le può chiamare solo il server.
revoke all on function public.use_credit(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.refund_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.remaining_credit(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.use_credit(uuid, text, integer) to service_role;
grant execute on function public.refund_credit(uuid, text) to service_role;
grant execute on function public.remaining_credit(uuid, text, integer) to service_role;

-- ---------- Galleria immagini ----------

-- Una riga per ogni immagine creata; il file sta nella cartella privata "images" di Storage.
create table if not exists public.images (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text not null default '',
  path text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists images_user_created on public.images (user_id, created_at desc);

-- Solo il server legge e scrive (nessun accesso diretto dal browser).
alter table public.images enable row level security;

-- Cartella privata per i file: visibili solo tramite link temporanei creati dal server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
