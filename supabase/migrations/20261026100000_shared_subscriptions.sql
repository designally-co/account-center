-- Account Center: shared subscriptions (Buk, 2026-10-26: "the people will share the company mail for
-- subscription access like claude, chat gpt, magnific and so on. they use their personal mail for HR";
-- "build the separate section now").
-- Same safety rules as the earlier migrations: everything stays inside schema `account`.
--
-- A shared subscription is a tool the company pays for and several people use with one shared login
-- (a company mailbox). Account Center keeps which tool, which shared email, and who may use it.
-- It never keeps a password or any other secret: those stay in the company's password manager. So there is
-- no free-text field at all, where a password could be pasted by mistake.
-- A shared email is not a person's work email (account.person_emails), and it is never used to find a person.

create table account.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) between 1 and 60),              -- the tool: Claude, ChatGPT, ...
  shared_email text not null check (shared_email = lower(btrim(shared_email))
                                    and shared_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                                    and length(shared_email) <= 320),                    -- the login everyone shares
  plan         text not null default '' check (length(plan) <= 60),                      -- for example "Team, 5 seats"
  url          text check (url ~ '^https://[a-z0-9.-]+(/[^\s]*)?$' and length(url) <= 300),  -- where people sign in
  renews_on    date,                                                                      -- next payment, when known
  is_active    boolean not null default true,                                            -- off when the company stops paying
  created_at   timestamptz not null default now()
);

-- One subscription per tool name, whatever the capital letters.
create unique index subscriptions_name_idx on account.subscriptions (lower(name));

-- Who may use each shared subscription.
create table account.subscription_members (
  subscription_id uuid not null references account.subscriptions (id) on delete cascade,
  person_id       uuid not null references account.people (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (subscription_id, person_id)
);
create index subscription_members_person_idx on account.subscription_members (person_id);

alter table account.subscriptions        enable row level security;
alter table account.subscription_members enable row level security;

create trigger log_subscriptions        after insert or update or delete on account.subscriptions        for each row execute function account.log_change();
create trigger log_subscription_members after insert or update or delete on account.subscription_members for each row execute function account.log_change();

-- ---------------------------------------------------------------------------------------------
-- Rights: Account Center's server only. No app reads these tables, and no function is added.
revoke all on account.subscriptions, account.subscription_members from public;

create policy account_app_all on account.subscriptions        for all to account_app using (true) with check (true);
create policy account_app_all on account.subscription_members for all to account_app using (true) with check (true);

grant select, insert, update, delete on account.subscriptions, account.subscription_members to account_app;
