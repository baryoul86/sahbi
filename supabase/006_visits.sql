-- Sahbi: visite del sito e dell'app, per il pannello amministratore.
-- Da incollare in Supabase > SQL Editor > Run (dopo 005_admin.sql). Si può eseguire più volte senza danni.
-- Si contano solo numeri per giorno: nessun indirizzo IP, nessun dato personale.

create table if not exists public.site_visits (
  day date primary key,
  views integer not null default 0,      -- pagine aperte
  visitors integer not null default 0,   -- persone diverse nel giorno (stesso telefono contato una volta)
  app integer not null default 0,        -- di cui dall'app Android
  landing integer not null default 0     -- di cui non ancora connessi (pagina iniziale)
);
alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;

create or replace function public.track_visit(p_new boolean, p_app boolean, p_landing boolean)
returns void
language sql security definer set search_path = public as $$
  insert into public.site_visits as v (day, views, visitors, app, landing)
  values (public.sahbi_today(), 1, case when p_new then 1 else 0 end, case when p_app then 1 else 0 end, case when p_landing then 1 else 0 end)
  on conflict (day) do update
    set views = v.views + 1,
        visitors = v.visitors + excluded.visitors,
        app = v.app + excluded.app,
        landing = v.landing + excluded.landing;
$$;

create or replace function public.visit_stats()
returns json
language sql stable security definer set search_path = public as $$
  with t as (select public.sahbi_today() as d)
  select json_build_object(
    'today', (select json_build_object('views', coalesce(sum(views), 0), 'visitors', coalesce(sum(visitors), 0), 'app', coalesce(sum(app), 0), 'landing', coalesce(sum(landing), 0)) from site_visits, t where day = t.d),
    'week', (select json_build_object('views', coalesce(sum(views), 0), 'visitors', coalesce(sum(visitors), 0)) from site_visits, t where day > t.d - 7),
    'month', (select json_build_object('views', coalesce(sum(views), 0), 'visitors', coalesce(sum(visitors), 0)) from site_visits, t where day > t.d - 30),
    'total', (select json_build_object('views', coalesce(sum(views), 0), 'visitors', coalesce(sum(visitors), 0)) from site_visits),
    'days', (select coalesce(json_agg(json_build_object('day', day, 'views', views, 'visitors', visitors) order by day), '[]'::json) from site_visits, t where day > t.d - 14)
  );
$$;

revoke all on function public.track_visit(boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function public.visit_stats() from public, anon, authenticated;
grant execute on function public.track_visit(boolean, boolean, boolean) to service_role;
grant execute on function public.visit_stats() to service_role;
