-- CYOA: Nibbles Choose Your Own Adventure
-- Initial schema migration
--
-- Lives in its own `cyoa` schema inside the shared RIVALS Supabase project
-- (ref ttdrylkhfhkzrtugfhzo) to avoid a second project fee while staying
-- fully isolated from RIVALS tables.
--
-- Auth model: WalletConnect. A serverless function verifies a signed message
-- and mints a Supabase JWT with claim `wallet_address` (lowercase). RLS
-- policies gate on allowlist membership.
--
-- After applying:
--   1. Supabase Dashboard → Project Settings → API → add `cyoa` to
--      "Exposed schemas".
--   2. NOTIFY pgrst, 'reload schema';

create schema if not exists cyoa;

-- ============================================================
-- ENUMS
-- ============================================================

create type cyoa.allowlist_role as enum ('loremaster', 'owner');
create type cyoa.character_tier as enum ('core', 'secondary', 'cameo');
create type cyoa.episode_status as enum ('planned', 'active', 'locked');
create type cyoa.page_status as enum ('draft', 'locked', 'canonical');
create type cyoa.canon_category as enum (
  'character_fact', 'world_rule', 'relationship',
  'consequence', 'item', 'location', 'other'
);
create type cyoa.canon_subject as enum ('character', 'world', 'item', 'location');
create type cyoa.canon_weight as enum ('absolute', 'strong', 'soft');
create type cyoa.canon_source as enum ('breadcrumb', 'derived', 'manual');
create type cyoa.canon_status as enum ('active', 'retracted', 'superseded');

-- ============================================================
-- ALLOWLIST
-- ============================================================

create table cyoa.allowlist (
  wallet_address text primary key check (wallet_address = lower(wallet_address)),
  role cyoa.allowlist_role not null,
  added_at timestamptz not null default now()
);

-- ============================================================
-- CHARACTERS
-- ============================================================

create table cyoa.characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier cyoa.character_tier not null,
  fixed_traits jsonb not null default '{}'::jsonb,
  decision_weights jsonb not null default '{}'::jsonb,
  relationships jsonb not null default '[]'::jsonb,
  destiny jsonb not null default '{}'::jsonb,
  wildcards jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index characters_tier_idx on cyoa.characters(tier);

-- ============================================================
-- EPISODES
-- ============================================================

create table cyoa.episodes (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  title text not null,
  checkpoints jsonb not null default '[]'::jsonb,
  current_checkpoint_id text,
  status cyoa.episode_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PAGES
-- ============================================================

create table cyoa.pages (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references cyoa.episodes(id) on delete cascade,
  sequence int not null,
  content text not null,
  options jsonb not null default '[]'::jsonb
    check (jsonb_array_length(options) between 0 and 3),
  status cyoa.page_status not null default 'draft',
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_id, sequence)
);

create index pages_status_idx on cyoa.pages(status);

-- ============================================================
-- CHOICES (winning community outcome per page)
-- ============================================================

create table cyoa.choices (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references cyoa.pages(id) on delete cascade,
  chosen_option text not null,
  vote_metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create unique index choices_page_unique on cyoa.choices(page_id);

-- ============================================================
-- STATE TRACKER (snapshot per lock)
-- ============================================================

create table cyoa.state_tracker (
  id uuid primary key default gen_random_uuid(),
  snapshot_at_page_id uuid references cyoa.pages(id) on delete set null,
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

create table cyoa.canon_facts (
  id uuid primary key default gen_random_uuid(),
  category cyoa.canon_category not null,
  subject_type cyoa.canon_subject,
  subject_id uuid,
  content text not null,
  raw_input text not null,
  weight cyoa.canon_weight not null default 'strong',
  source cyoa.canon_source not null default 'breadcrumb',
  status cyoa.canon_status not null default 'active',
  superseded_by uuid references cyoa.canon_facts(id) on delete set null,
  added_by text not null,
  added_at timestamptz not null default now()
);

create index canon_facts_subject_idx on cyoa.canon_facts(subject_type, subject_id);
create index canon_facts_category_idx on cyoa.canon_facts(category);
create index canon_facts_status_idx on cyoa.canon_facts(status);

-- ============================================================
-- GENERATIONS (audit trail, kept forever)
-- ============================================================

create table cyoa.generations (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references cyoa.pages(id) on delete set null,
  prompt text not null,
  response text not null,
  model text not null,
  tokens_in int,
  tokens_out int,
  cost_usd numeric(10,6),
  facts_used uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index generations_page_idx on cyoa.generations(page_id);
create index generations_facts_used_idx on cyoa.generations using gin (facts_used);

-- ============================================================
-- STYLE GUIDE (singleton)
-- ============================================================

create table cyoa.style_guide (
  id int primary key default 1 check (id = 1),
  voice text,
  tone text,
  genre_conventions text,
  forbidden text,
  examples text,
  updated_at timestamptz not null default now()
);

insert into cyoa.style_guide (id) values (1);

-- ============================================================
-- updated_at triggers
-- ============================================================

create or replace function cyoa.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger t_characters_updated before update on cyoa.characters
  for each row execute function cyoa.touch_updated_at();
create trigger t_episodes_updated before update on cyoa.episodes
  for each row execute function cyoa.touch_updated_at();
create trigger t_pages_updated before update on cyoa.pages
  for each row execute function cyoa.touch_updated_at();
create trigger t_style_guide_updated before update on cyoa.style_guide
  for each row execute function cyoa.touch_updated_at();

-- ============================================================
-- RLS
-- Gate every table on allowlist membership via JWT claim wallet_address.
-- Owner can do anything. Loremaster can do anything EXCEPT:
--   - modify allowlist
--   - unlock locked/canonical pages
--   - hard delete canon_facts referenced by locked pages
-- (Those extra constraints are enforced in application / function layer.)
-- ============================================================

alter table cyoa.allowlist enable row level security;
alter table cyoa.characters enable row level security;
alter table cyoa.episodes enable row level security;
alter table cyoa.pages enable row level security;
alter table cyoa.choices enable row level security;
alter table cyoa.state_tracker enable row level security;
alter table cyoa.canon_facts enable row level security;
alter table cyoa.generations enable row level security;
alter table cyoa.style_guide enable row level security;

-- Helper: current wallet from JWT
create or replace function cyoa.current_wallet()
returns text language sql stable as $$
  select lower(coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'wallet_address', ''))
$$;

create or replace function cyoa.is_allowed()
returns boolean language sql stable as $$
  select exists (select 1 from cyoa.allowlist where wallet_address = cyoa.current_wallet())
$$;

create or replace function cyoa.is_owner()
returns boolean language sql stable as $$
  select exists (select 1 from cyoa.allowlist where wallet_address = cyoa.current_wallet() and role = 'owner')
$$;

-- Generic allowed-only policies
do $$
declare t text;
begin
  foreach t in array array['characters','episodes','pages','choices','state_tracker','canon_facts','generations','style_guide']
  loop
    execute format('create policy %I_select on cyoa.%I for select using (cyoa.is_allowed())', t, t);
    execute format('create policy %I_insert on cyoa.%I for insert with check (cyoa.is_allowed())', t, t);
    execute format('create policy %I_update on cyoa.%I for update using (cyoa.is_allowed()) with check (cyoa.is_allowed())', t, t);
    execute format('create policy %I_delete on cyoa.%I for delete using (cyoa.is_allowed())', t, t);
  end loop;
end $$;

-- allowlist: only owner can mutate; anyone allowed can read
create policy allowlist_select on cyoa.allowlist for select using (cyoa.is_allowed());
create policy allowlist_insert on cyoa.allowlist for insert with check (cyoa.is_owner());
create policy allowlist_update on cyoa.allowlist for update using (cyoa.is_owner()) with check (cyoa.is_owner());
create policy allowlist_delete on cyoa.allowlist for delete using (cyoa.is_owner());

-- ============================================================
-- Seed owner wallets (NoCredits)
-- ============================================================

insert into cyoa.allowlist (wallet_address, role) values
  (lower('0x2Ec43E727CC04e11e7FdBe129D420D680E1480c9'), 'owner'),
  (lower('BEUdDxoMnpAbNsoynyT2h9Xr6yk3anf4cNgzZvKXhkyw'), 'owner')
on conflict (wallet_address) do nothing;
