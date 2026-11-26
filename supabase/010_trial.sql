-- Sahbi: prova gratuita di Sahbi Pro (3 giorni, una sola volta per persona).
-- Da incollare in Supabase > SQL Editor > Run. Si può eseguire più volte.
alter table public.profiles add column if not exists trial_until timestamptz;   -- fine della prova in corso
alter table public.profiles add column if not exists trial_used boolean not null default false;

-- get_profile: come prima + i dati della prova.
create or replace function public.get_profile(p_user uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  code text;
  n integer;
begin
  select * into p from public.profiles where user_id = p_user;
  if not found then
    loop
      code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      exit when length(code) = 6 and not exists (select 1 from public.profiles where referral_code = code);
    end loop;
    insert into public.profiles (user_id, referral_code) values (p_user, code)
    on conflict (user_id) do nothing;
    select * into p from public.profiles where user_id = p_user;
  end if;
  select count(*) into n from public.profiles where referred_by = p_user;
  return json_build_object(
    'pro_until', p.pro_until,
    'referral_code', p.referral_code,
    'referred_by', p.referred_by,
    'referrals', n,
    'stripe_customer_id', p.stripe_customer_id,
    'created_at', p.created_at,
    'trial_until', p.trial_until,
    'trial_used', p.trial_used
  );
end $$;

-- Inizio (o aggiornamento) della prova: Pro "leggero" fino a p_until.
create or replace function public.set_trial(p_user uuid, p_until timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.get_profile(p_user);
  update public.profiles set trial_until = p_until, trial_used = true,
    pro_until = greatest(coalesce(pro_until, now()), p_until)
  where user_id = p_user;
end $$;

-- Primo pagamento vero: la prova finisce, Pro completo.
create or replace function public.end_trial(p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set trial_until = null where user_id = p_user and trial_until is not null;
end $$;

revoke all on function public.get_profile(uuid) from public, anon, authenticated;
revoke all on function public.set_trial(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.end_trial(uuid) from public, anon, authenticated;
grant execute on function public.get_profile(uuid) to service_role;
grant execute on function public.set_trial(uuid, timestamptz) to service_role;
grant execute on function public.end_trial(uuid) to service_role;
