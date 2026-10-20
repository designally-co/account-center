-- Minimal stand-ins for the parts of Project Friday that schema `account` reads.
-- Same names and the columns the migration uses; made-up people only.
create schema auth;
create table auth.users (
  id                 uuid primary key,
  email              text,
  banned_until       timestamptz,
  deleted_at         timestamptz,
  invited_at         timestamptz,
  email_confirmed_at timestamptz,
  recovery_sent_at   timestamptz
);

create table public.hr_employees (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid references auth.users (id),
  email          text not null,
  display_name   text,
  nickname       text,
  first_name     text,
  last_name      text,
  phone_number   text,
  birthday       date,
  role           text not null default 'employee',
  is_active      boolean not null default true,
  is_fixture     boolean default false
);
alter table public.hr_employees enable row level security;

-- HR's teams (the columns the import reads). HR lets a person be in several teams.
create table public.hr_teams (
  id           uuid primary key,
  name         text unique not null,
  display_name text not null,
  lead_id      uuid references public.hr_employees (id),
  is_active    boolean default true
);
create table public.hr_employee_teams (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees (id),
  team_id     uuid not null references public.hr_teams (id),
  is_primary  boolean default false,
  unique (employee_id, team_id)
);
alter table public.hr_teams enable row level security;
alter table public.hr_employee_teams enable row level security;

-- App users that exist in Friday.
create role hub_app login;
create role studio_app login;
