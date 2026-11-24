begin;
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.companies (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  name text not null
);
create table public.company_members (
  company_id uuid not null references public.companies(id),
  user_id uuid not null references auth.users(id),
  role text not null,
  primary key (company_id, user_id)
);
create table public.vehicles (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  company_id uuid references public.companies(id)
);
alter table public.subscriptions enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.vehicles enable row level security;
grant select on public.company_members, public.vehicles, public.subscriptions to authenticated;
grant select, insert, update on public.subscriptions to service_role;
grant select on public.company_members, public.companies to service_role;
create policy subscriptions_select_own on public.subscriptions for select to authenticated
using (user_id = auth.uid());
create policy company_members_select_own on public.company_members for select to authenticated
using (user_id = auth.uid());
create policy member_vehicle_access on public.vehicles for select to authenticated
using (user_id = auth.uid() or company_id in (
  select company_id from public.company_members where user_id = auth.uid()
));
insert into auth.users (id,email) values
  ('00000000-0000-4000-8000-000000000001','owner-active@example.test'),
  ('00000000-0000-4000-8000-000000000002','owner-canceled@example.test'),
  ('00000000-0000-4000-8000-000000000003','owner-expired@example.test'),
  ('00000000-0000-4000-8000-000000000004','member@example.test'),
  ('00000000-0000-4000-8000-000000000005','owner-no-history@example.test');
insert into public.subscriptions (user_id,stripe_customer_id,stripe_subscription_id,status,trial_end) values
  ('00000000-0000-4000-8000-000000000001','cus_active','sub_active','active',null),
  ('00000000-0000-4000-8000-000000000002','cus_deleted','sub_canceled','canceled',now()-interval '1 day'),
  ('00000000-0000-4000-8000-000000000003','cus_expired','sub_expired','trialing',now()-interval '1 day');
insert into public.companies (id,owner_id,name) values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Active fixture'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','Canceled fixture'),
  ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003','Expired fixture'),
  ('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005','No billing history fixture');
insert into public.company_members (company_id,user_id,role)
select id,'00000000-0000-4000-8000-000000000004',
  case when name = 'Canceled fixture' then 'viewer' else 'bookkeeper' end
from public.companies;
insert into public.vehicles (id,user_id,company_id) select id,owner_id,id from public.companies;
commit;
