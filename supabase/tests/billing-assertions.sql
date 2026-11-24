begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004';
do $test$
begin
  if (select array_agg(company_id order by company_id) from public.company_members)
    is distinct from array['10000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'Only the active company membership should be visible';
  end if;
  if (select array_agg(company_id order by company_id) from public.vehicles)
    is distinct from array['10000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'Direct vehicle reads must honor company entitlement';
  end if;
  if has_table_privilege(current_user, 'public.subscription_lifecycle', 'SELECT')
    or has_function_privilege(current_user, 'public.sync_stripe_subscription(uuid,bigint,text,text,text,text,text,timestamptz,timestamptz)', 'EXECUTE') then
    raise exception 'Authenticated members must not read billing controls or write subscriptions';
  end if;
end;
$test$;
reset role;

do $test$
begin
  if (select count(*) from public.subscriptions) <> 3
    or (select count(*) from public.vehicles) <> 4
    or (select count(*) from public.company_members) <> 4 then
    raise exception 'Migration changed original fixture rows';
  end if;
  if not exists (select from public.subscription_lifecycle where user_id = '00000000-0000-4000-8000-000000000002' and intro_used)
    or not exists (select from public.subscription_lifecycle where user_id = '00000000-0000-4000-8000-000000000005' and legacy_unverified and not intro_used) then
    raise exception 'Historical records or missing-history hold were lost';
  end if;
end;
$test$;

insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000006','new-after-migration@example.test');
set local role service_role;
insert into public.subscription_lifecycle(user_id) values ('00000000-0000-4000-8000-000000000006');
do $test$
declare u constant uuid := '00000000-0000-4000-8000-000000000002';
begin
  if not exists (select from public.subscription_lifecycle where user_id = '00000000-0000-4000-8000-000000000006' and not intro_used and not legacy_unverified) then
    raise exception 'New account should remain eligible';
  end if;
  update public.subscription_lifecycle set checkout = '{"id":"replacement"}' where user_id = u;

  if not public.sync_stripe_subscription(u,0,'replacement','sub_new','cus_new','price_29','past_due',null,null) then
    raise exception 'Replacement snapshot failed';
  end if;
  if public.sync_stripe_subscription(u,0,'replacement','sub_new','cus_new','price_29','trialing',null,null) then
    raise exception 'Stale snapshot won';
  end if;
  if not public.sync_stripe_subscription(u,1,null,'sub_canceled','cus_deleted','price_29','canceled',null,null) then
    raise exception 'Older cancellation could not be acknowledged';
  end if;
  if not exists (select from public.subscriptions where user_id = u and stripe_subscription_id = 'sub_new' and status = 'past_due') then
    raise exception 'Closed subscription overwrote the replacement';
  end if;
  if not public.sync_stripe_subscription(u,2,'replacement','sub_new','cus_new','price_29','active',null,null) then
    raise exception 'Payment recovery failed';
  end if;
  if not exists (select from public.subscription_lifecycle where user_id = u and intro_used and not legacy_unverified) then
    raise exception 'Reactivation reset introductory eligibility';
  end if;
end;
$test$;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004';
do $test$
begin
  if (select count(*) from public.company_members) <> 2
    or (select count(*) from public.vehicles) <> 2 then
    raise exception 'Recovered company did not regain delegated access';
  end if;
end;
$test$;
rollback;
