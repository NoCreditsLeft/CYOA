-- CYOA: Nibbles Choose Your Own Adventure
-- Initial schema migration
--
-- Auth model: WalletConnect. A serverless function verifies a signed message
-- and mints a Supabase JWT with claim `wallet_address` (lowercase). RLS
-- policies gate on allowlist membership.

-- ============================================================
-- ENUMS
-- ============================================================

create type allowlist_role as enum ('loremaster', 'owner');
create type character_tier as enum ('core', 'secondary', 'cameo');
create type episode_status as enum ('planned', 'active', 'locked');
create type page_status as enum ('draft', 'locked', 'canonical');
create type canon_category as enum (
  'character_fact', 'world_rule', 'relationship',
  'consequence', 'item', 'location', 'other'
);
create type canon_subject as enum ('character', 'world', 'item', 'location');
create type canon_weight as enum ('absolute', 'strong', 'soft');
create type canon_source as enum ('breadcrumb', 'derived', 'manual');
create type canon_status as enum ('active', 'retracted', 'superseded');

-- ============================================================
-- ALLOWLIST
-- ============================================================

create table allowlist (
  wallet_address text primary key check (wallet_address = lower(wallet_address)),
  role allowlist_role not null,
  added_at timestamptz not null default now()
);

-- ============================================================
-- CHARACTERS
-- ============================================================

create table characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier character_tier not null,
  fixed_traits jsonb not null default '{}'::jsonb,
  decision_weights jsonb not null default '{}'::jsonb,
  relationships jsonb not null default '[]'::jsonb,
  destiny jsonb not null default '{}'::jsonb,
  wildcards jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index characters_tier_idx on characters(tier);

-- ============================================================
-- EPISODES
-- ============================================================

create table episodes (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  title text not null,
  checkpoints jsonb not null default '[]'::jsonb,
  current_checkpoint_id text,
  status episode_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PAGES
-- ============================================================

create table pages (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  sequence int not null,
  content text not null,
  options jsonb not null default '[]'::jsonb
    check (jsonb_array_length(options) between 0 and 3),
  status page_status not null default 'draft',
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_id, sequence)
);

create index pages_status_idx on pages(status);

-- ============================================================
-- CHOICES (winning community outcome per page)
-- ============================================================

create table choices (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  chosen_option text not null,
  vote_metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create unique index choices_page_unique on choices(page_id);

-- ============================================================
-- STATE TRACKER (snapshot per lock)
-- ============================================================

create table state_tracker (
  id uuid primary key default gen_random_uuid(),
  snapshot_at_page_id uuid references pages(id) on delete set null,
  character_states jsonb not null default '{}'::jsonb,
  relationship_states jsonb not null default '{}'::jsonb,
  consequences_pending jsonb not null default '[]'::jsonb,
  intersected_storylines jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CANON FACTS (Font of Truth)
-- ============================================================

create table canon_facts (
  id uuid primary key default gen_random_uuid(),
  category canon_category not null,
  subject_type canon_subject,
  subject_id uuid,
  content text not null,
  raw_input text not null,
  weight canon_weight not null default 'strong',
  source canon_source not null default 'breadcrumb',
  status canon_status not null default 'active',
  superseded_by uuid references canon_facts(id) on delete set null,
  added_by text not null,
  added_at timestamptz not null default now()
);

create index canon_facts_subject_idx on canon_facts(subject_type, subject_id);
create index canon_facts_category_idx on canon_facts(category);
create index canon_facts_status_idx on canon_facts(status);

-- ============================================================
-- GENERATIONS (audit trail, kept forever)
-- ============================================================

create table generations (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references pages(id) on delete set null,
  prompt text not null,
  response text not null,
  model text not null,
  tokens_in int,
  tokens_out int,
  cost_usd numeric(10,6),
  facts_used uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index generations_page_idx on generations(page_id);
create index generations_facts_used_idx on generations using gin (facts_used);

-- ============================================================
-- STYLE GUIDE (singleton)
-- ============================================================

create table style_guide (
  id int primary key default 1 check (id = 1),
  voice text,
  tone text,
  genre_conventions text,
  forbidden text,
  examples text,
  updated_at timestamptz not null default now()
);

insert into style_guide (id) values (1);

-- ============================================================
-- updated_at triggers
-- ============================================================

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger t_characters_updated before update on characters
  for each row execute function touch_updated_at();
create trigger t_episodes_updated before update on episodes
  for each row execute function touch_updated_at();
create trigger t_pages_updated before update on pages
  for each row execute function touch_updated_at();
create trigger t_style_guide_updated before update on style_guide
  for each row execute function touch_updated_at();

-- ============================================================
-- RLS
-- Gate every table on allowlist membership via JWT claim wallet_address.
-- Owner can do anything. Loremaster can do anything EXCEPT:
--   - modify allowlist
--   - unlock locked/canonical pages
--   - hard delete canon_facts that are referenced by locked pages
-- (Those extra constraints are enforced in application / function layer.)
-- ============================================================

alter table allowlist enable row level security;
alter table characters enable row level security;
alter table episodes enable row level security;
alter table pages enable row level security;
alter table choices enable row level security;
alter table state_tracker enable row level security;
alter table canon_facts enable row level security;
alter table generations enable row level security;
alter table style_guide enable row level security;

-- Helper: current wallet from JWT
create or replace function current_wallet()
returns text language sql stable as $$
  select lower(coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'wallet_address', ''))
$$;

create or replace function is_allowed()
returns boolean language sql stable as $$
  select exists (select 1 from allowlist where wallet_address = current_wallet())
$$;

create or replace function is_owner()
returns boolean language sql stable as $$
  select exists (select 1 from allowlist where wallet_address = current_wallet() and role = 'owner')
$$;

-- Generic allowed-only policies
do $$
declare t text;
begin
  foreach t in array array['characters','episodes','pages','choices','state_tracker','canon_facts','generations','style_guide']
  loop
    execute format('create policy %I_select on %I for select using (is_allowed())', t, t);
    execute format('create policy %I_insert on %I for insert with check (is_allowed())', t, t);
    execute format('create policy %I_update on %I for update using (is_allowed()) with check (is_allowed())', t, t);
    execute format('create policy %I_delete on %I for delete using (is_allowed())', t, t);
  end loop;
end $$;

-- allowlist: only owner can mutate; anyone allowed can read
create policy allowlist_select on allowlist for select using (is_allowed());
create policy allowlist_insert on allowlist for insert with check (is_owner());
create policy allowlist_update on allowlist for update using (is_owner()) with check (is_owner());
create policy allowlist_delete on allowlist for delete using (is_owner());
