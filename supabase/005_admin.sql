-- Sahbi: pannello amministratore e avvisi. Da incollare in Supabase > SQL Editor > Run (dopo 004_memory.sql).
-- Si può eseguire più volte senza danni.

-- Avvisi per l'amministratore (es. credito OpenAI finito): uno per tipo, con l'ultima volta che è stato mandato.
create table if not exists public.admin_alerts (
  kind text primary key,
  message text not null default '',
  count integer not null default 0,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  last_sent timestamptz
);
alter table public.admin_alerts enable row level security;
revoke all on public.admin_alerts from anon, authenticated;

-- Registra un problema. Restituisce true se è il momento di mandare l'e-mail (al massimo una ogni p_every_minutes per tipo).
create or replace function public.admin_alert(p_kind text, p_message text, p_every_minutes integer default 60)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  send boolean;
begin
  insert into public.admin_alerts (kind, message, count, first_at, last_at)
  values (left(p_kind, 60), left(p_message, 500), 1, now(), now())
  on conflict (kind) do update
    set message = excluded.message, count = public.admin_alerts.count + 1, last_at = now();
  update public.admin_alerts
     set last_sent = now()
   where kind = left(p_kind, 60)
     and (last_sent is null or last_sent < now() - make_interval(mins => p_every_minutes))
  returning true into send;
  return coalesce(send, false);
end $$;

-- Numeri per il pannello: utenti, Pro, incassi, consumo di oggi, ultimi avvisi.
create or replace function public.admin_stats()
returns json
language sql stable security definer set search_path = public, auth as $$
  select json_build_object(
    'users', (select count(*) from auth.users),
    'users_today', (select count(*) from auth.users where created_at >= now() - interval '24 hours'),
    'users_week', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'pro', (select count(*) from public.profiles where pro_until > now()),
    'payments_month', (
      select coalesce(json_agg(json_build_object('provider', provider, 'currency', currency, 'count', n, 'amount', total)), '[]'::json)
      from (select provider, currency, count(*) n, sum(coalesce(amount, 0)) total from public.payments
            where created_at >= date_trunc('month', now()) group by provider, currency) t),
    'payments_total', (
      select coalesce(json_agg(json_build_object('provider', provider, 'currency', currency, 'count', n, 'amount', total)), '[]'::json)
      from (select provider, currency, count(*) n, sum(coalesce(amount, 0)) total from public.payments group by provider, currency) t),
    'last_payments', (
      select coalesce(json_agg(json_build_object('provider', provider, 'amount', amount, 'currency', currency, 'at', created_at) order by created_at desc), '[]'::json)
      from (select * from public.payments order by created_at desc limit 10) t),
    'usage_today', (
      select coalesce(json_object_agg(kind, total), '{}'::json)
      from (select kind, sum(count) total from public.usage where day = public.sahbi_today() group by kind) t),
    'active_today', (select count(distinct user_id) from public.usage where day = public.sahbi_today()),
    'videos_month', (select coalesce(sum(count), 0) from public.usage where kind = 'video' and day = public.sahbi_month()),
    'images_total', (select count(*) from public.images),
    'alerts', (
      select coalesce(json_agg(json_build_object('kind', kind, 'message', message, 'count', count, 'last_at', last_at) order by last_at desc), '[]'::json)
      from (select * from public.admin_alerts where last_at >= now() - interval '7 days' order by last_at desc limit 20) t)
  );
$$;

revoke all on function public.admin_alert(text, text, integer) from public, anon, authenticated;
revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_alert(text, text, integer) to service_role;
grant execute on function public.admin_stats() to service_role;
