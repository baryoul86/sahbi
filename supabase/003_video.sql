-- Sahbi: video per i Pro (5 al mese). Da incollare in Supabase > SQL Editor > Run (dopo 002_pro.sql).
-- Si può eseguire più volte senza danni.

-- 1) Nuovo tipo di consumo: "video" (contato per mese, non per giorno).
alter table public.usage drop constraint if exists usage_kind_check;
alter table public.usage add constraint usage_kind_check check (kind in ('chat', 'image', 'voice', 'tts', 'video'));

-- Primo giorno del mese (ora del Maghreb): i video si contano su questa data.
create or replace function public.sahbi_month() returns date
language sql stable as $$ select date_trunc('month', public.sahbi_today())::date $$;

-- Usa un video del mese. Restituisce quanti ne restano, oppure -1 se il limite è raggiunto.
create or replace function public.use_video_credit(p_user uuid, p_limit integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  c integer;
begin
  if p_limit <= 0 then
    return -1;
  end if;
  insert into public.usage (user_id, day, kind, count)
  values (p_user, public.sahbi_month(), 'video', 1)
  on conflict (user_id, day, kind)
  do update set count = public.usage.count + 1
  where public.usage.count < p_limit
  returning count into c;
  if c is null then
    return -1;
  end if;
  return p_limit - c;
end $$;

-- Restituisce un video se la creazione fallisce (sul mese in cui era stato usato).
create or replace function public.refund_video_credit(p_user uuid, p_month date)
returns void
language sql security definer set search_path = public as $$
  update public.usage set count = count - 1
  where user_id = p_user and day = p_month and kind = 'video' and count > 0;
$$;

-- Quanti video restano questo mese.
create or replace function public.remaining_video_credit(p_user uuid, p_limit integer)
returns integer
language sql stable security definer set search_path = public as $$
  select greatest(p_limit - coalesce((
    select count from public.usage
    where user_id = p_user and day = public.sahbi_month() and kind = 'video'
  ), 0), 0);
$$;

revoke all on function public.use_video_credit(uuid, integer) from public, anon, authenticated;
revoke all on function public.refund_video_credit(uuid, date) from public, anon, authenticated;
revoke all on function public.remaining_video_credit(uuid, integer) from public, anon, authenticated;
grant execute on function public.use_video_credit(uuid, integer) to service_role;
grant execute on function public.refund_video_credit(uuid, date) to service_role;
grant execute on function public.remaining_video_credit(uuid, integer) to service_role;

-- 2) La galleria contiene anche i video: tipo, stato della creazione e lavoro in corso.
alter table public.images add column if not exists kind text not null default 'image';
alter table public.images add column if not exists status text not null default 'done';
alter table public.images add column if not exists job text;
alter table public.images add column if not exists month date;
alter table public.images drop constraint if exists images_kind_check;
alter table public.images add constraint images_kind_check check (kind in ('image', 'video'));
alter table public.images drop constraint if exists images_status_check;
alter table public.images add constraint images_status_check check (status in ('pending', 'done', 'failed'));

-- 3) La cartella privata accetta anche i video MP4 (fino a 50 MB).
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],
    file_size_limit = 52428800
where id = 'images';
