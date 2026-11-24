begin;

create table public.subscription_lifecycle (
  user_id uuid primary key references auth.users(id) on delete cascade,
  intro_used boolean not null default false,
  revision bigint not null default 0,
  checkout jsonb
);

alter table public.subscription_lifecycle enable row level security;
revoke all on public.subscription_lifecycle from public, anon, authenticated;
grant select, insert, update on public.subscription_lifecycle to service_role;

-- A legacy subscription is evidence the account has already started billing.
insert into public.subscription_lifecycle (user_id, intro_used)
select user_id, true
from public.subscriptions
where stripe_subscription_id is not null or trial_end is not null
   or status not in ('inactive');

create function public.sync_stripe_subscription(
  p_user_id uuid,
  p_revision bigint,
  p_checkout_id text,
  p_subscription_id text,
  p_customer_id text,
  p_price_id text,
  p_status text,
  p_period_end timestamptz,
  p_trial_end timestamptz
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  lifecycle public.subscription_lifecycle%rowtype;
  current_subscription_id text;
begin
  select * into strict lifecycle from public.subscription_lifecycle
  where user_id = p_user_id for update;

  if lifecycle.revision <> p_revision then
    return false;
  end if;

  select stripe_subscription_id into current_subscription_id
  from public.subscriptions where user_id = p_user_id;

  -- A different subscription can take over only if it came from the current
  -- Checkout reservation. Older subscriptions can never replace its state.
  if current_subscription_id is null or current_subscription_id = p_subscription_id
     or lifecycle.checkout->>'id' = p_checkout_id then
    insert into public.subscriptions (
      user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
      status, current_period_end, trial_end, updated_at
    ) values (
      p_user_id, p_customer_id, p_subscription_id, p_price_id,
      p_status, p_period_end, p_trial_end, now()
    )
    on conflict (user_id) do update set
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      stripe_price_id = case when public.subscriptions.stripe_subscription_id = excluded.stripe_subscription_id
        then coalesce(excluded.stripe_price_id, public.subscriptions.stripe_price_id) else excluded.stripe_price_id end,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      trial_end = case when public.subscriptions.stripe_subscription_id = excluded.stripe_subscription_id
        then coalesce(excluded.trial_end, public.subscriptions.trial_end) else excluded.trial_end end,
      updated_at = excluded.updated_at;
  end if;

  update public.subscription_lifecycle
  set intro_used = true, revision = revision + 1
  where user_id = p_user_id;

  return true;
end;
$$;

revoke execute on function public.sync_stripe_subscription(uuid, bigint, text, text, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.sync_stripe_subscription(uuid, bigint, text, text, text, text, text, timestamptz, timestamptz)
  to service_role;

commit;
