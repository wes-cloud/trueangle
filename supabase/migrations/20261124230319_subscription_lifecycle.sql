begin;

create table public.subscription_lifecycle (
  user_id uuid primary key references auth.users(id) on delete cascade,
  intro_used boolean not null default false,
  legacy_unverified boolean not null default false,
  revision bigint not null default 0,
  checkout jsonb
);

alter table public.subscription_lifecycle enable row level security;
revoke all on public.subscription_lifecycle from public, anon, authenticated;
grant select, insert, update on public.subscription_lifecycle to service_role;

-- Existing accounts without durable billing evidence stay ineligible until reviewed.
insert into public.subscription_lifecycle (user_id, intro_used, legacy_unverified)
select u.id, evidence.found, not evidence.found
from auth.users u
left join public.subscriptions s on s.user_id = u.id
cross join lateral (
  select coalesce(s.stripe_subscription_id is not null or s.trial_end is not null
    or s.status <> 'inactive', false) as found
) evidence;

-- Membership stays recorded when access expires. Downstream policies (such as
-- vehicles) also stop seeing the ineligible delegated membership.
create schema trueangle_private;
revoke all on schema trueangle_private from public;
grant usage on schema trueangle_private to authenticated;

create function trueangle_private.has_delegated_company_access(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $company_access$
  select exists (
    select 1
    from public.company_members m
    join public.companies c on c.id = m.company_id
    join public.subscriptions s on s.user_id = c.owner_id
    where m.company_id = p_company_id
      and m.user_id = (select auth.uid())
      and m.role in ('bookkeeper', 'viewer')
      and (s.status = 'active' or (s.status = 'trialing' and s.trial_end > now()))
  );
$company_access$;

revoke execute on function trueangle_private.has_delegated_company_access(uuid)
  from public, anon, authenticated;
grant execute on function trueangle_private.has_delegated_company_access(uuid) to authenticated;

create policy delegated_membership_requires_entitlement
on public.company_members as restrictive for select to authenticated
using (role = 'owner' or trueangle_private.has_delegated_company_access(company_id));

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
  set intro_used = true, legacy_unverified = false, revision = revision + 1
  where user_id = p_user_id;

  return true;
end;
$$;

revoke execute on function public.sync_stripe_subscription(uuid, bigint, text, text, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.sync_stripe_subscription(uuid, bigint, text, text, text, text, text, timestamptz, timestamptz)
  to service_role;

commit;
