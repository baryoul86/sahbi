-- Sahbi: piani Gratis/Pro, inviti e pagamenti. Da eseguire una volta dopo schema.sql.

-- Nuovo tipo di consumo: "tts" (Sahbi che parla).
alter table public.usage drop constraint if exists usage_kind_check;
alter table public.usage add constraint usage_kind_check check (kind in ('chat', 'image', 'voice', 'tts'));

-- Un profilo per utente: fino a quando è Pro, codice invito, cliente Stripe.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pro_until timestamptz,
  referral_code text unique,
  referred_by uuid references auth.users (id) on delete set null,
  referral_rewards integer not null default 0,
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Pagamenti già registrati (evita di attivare il Pro due volte per lo stesso pagamento).
create table if not exists public.payments (
  id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  provider text not null,
  amount integer,
  currency text,
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;

-- Restituisce il profilo, creandolo se manca (con un codice invito di 6 caratteri).
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
    'created_at', p.created_at
  );
end $$;

-- Aggiunge giorni di Pro (partendo da oggi o dalla scadenza attuale, se è più lontana).
create or replace function public.add_pro_days(p_user uuid, p_days integer)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  t timestamptz;
begin
  perform public.get_profile(p_user);
  update public.profiles
  set pro_until = greatest(coalesce(pro_until, now()), now()) + make_interval(days => p_days)
  where user_id = p_user
  returning pro_until into t;
  return t;
end $$;

-- Porta la scadenza del Pro almeno fino a una data (per gli abbonamenti Stripe).
create or replace function public.extend_pro_until(p_user uuid, p_until timestamptz)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  t timestamptz;
begin
  perform public.get_profile(p_user);
  update public.profiles set pro_until = greatest(coalesce(pro_until, now()), p_until)
  where user_id = p_user returning pro_until into t;
  return t;
end $$;

-- Invito: entro 7 giorni dall'iscrizione, con un codice non proprio. 7 giorni di Pro a entrambi
-- (chi invita riceve il premio al massimo 10 volte).
create or replace function public.apply_referral(p_user uuid, p_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  inviter public.profiles;
begin
  perform public.get_profile(p_user);
  select * into me from public.profiles where user_id = p_user for update;
  if me.referred_by is not null then return 'already'; end if;
  if me.created_at < now() - interval '7 days' then return 'too_late'; end if;
  select * into inviter from public.profiles where referral_code = upper(trim(p_code));
  if not found then return 'not_found'; end if;
  if inviter.user_id = p_user then return 'own_code'; end if;
  update public.profiles set referred_by = inviter.user_id where user_id = p_user;
  perform public.add_pro_days(p_user, 7);
  if inviter.referral_rewards < 10 then
    update public.profiles set referral_rewards = referral_rewards + 1 where user_id = inviter.user_id;
    perform public.add_pro_days(inviter.user_id, 7);
  end if;
  return 'ok';
end $$;

-- Registra un pagamento una sola volta: true se è nuovo.
create or replace function public.record_payment(p_id text, p_user uuid, p_provider text, p_amount integer, p_currency text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into public.payments (id, user_id, provider, amount, currency)
  values (p_id, p_user, p_provider, p_amount, p_currency);
  return true;
exception when unique_violation then
  return false;
end $$;

-- Collega il cliente Stripe all'utente; trova l'utente da un cliente Stripe.
create or replace function public.set_stripe_customer(p_user uuid, p_customer text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.get_profile(p_user);
  update public.profiles set stripe_customer_id = p_customer where user_id = p_user;
end $$;

create or replace function public.user_by_stripe_customer(p_customer text)
returns uuid
language sql stable security definer set search_path = public as $$
  select user_id from public.profiles where stripe_customer_id = p_customer;
$$;

-- Solo il server può chiamare queste funzioni.
revoke all on function public.get_profile(uuid) from public, anon, authenticated;
revoke all on function public.add_pro_days(uuid, integer) from public, anon, authenticated;
revoke all on function public.extend_pro_until(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_referral(uuid, text) from public, anon, authenticated;
revoke all on function public.record_payment(text, uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.set_stripe_customer(uuid, text) from public, anon, authenticated;
revoke all on function public.user_by_stripe_customer(text) from public, anon, authenticated;
grant execute on function public.get_profile(uuid) to service_role;
grant execute on function public.add_pro_days(uuid, integer) to service_role;
grant execute on function public.extend_pro_until(uuid, timestamptz) to service_role;
grant execute on function public.apply_referral(uuid, text) to service_role;
grant execute on function public.record_payment(text, uuid, text, integer, text) to service_role;
grant execute on function public.set_stripe_customer(uuid, text) to service_role;
grant execute on function public.user_by_stripe_customer(text) to service_role;
