-- ==============================================================
-- CYOA bootstrap for: Tribe Called Rex
-- Schema: cyoa_rex  (in the shared RIVALS Supabase project)
-- Generated from structural migrations. Placeholder seeds only.
-- Run once in the Supabase SQL editor, then:
--   Settings -> API -> Exposed schemas -> add 'cyoa_rex'
--   then run:  notify pgrst, 'reload schema';
-- ==============================================================

-- ----- from 20260414085348_init.sql -----
-- CYOA: Nibbles Choose Your Own Adventure
-- Initial schema migration
--
-- Lives in its own `cyoa_rex` schema inside the shared RIVALS Supabase project
-- (ref ttdrylkhfhkzrtugfhzo) to avoid a second project fee while staying
-- fully isolated from RIVALS tables.
--
-- Auth model: WalletConnect. A serverless function verifies a signed message
-- and mints a Supabase JWT with claim `wallet_address` (lowercase). RLS
-- policies gate on allowlist membership.
--
-- After applying:
--   1. Supabase Dashboard → Project Settings → API → add `cyoa_rex` to
--      "Exposed schemas".
--   2. NOTIFY pgrst, 'reload schema';

create schema if not exists cyoa_rex;

-- ============================================================
-- ENUMS
-- ============================================================

create type cyoa_rex.allowlist_role as enum ('loremaster', 'owner');
create type cyoa_rex.character_tier as enum ('core', 'secondary', 'cameo');
create type cyoa_rex.episode_status as enum ('planned', 'active', 'locked');
create type cyoa_rex.page_status as enum ('draft', 'locked', 'canonical');
create type cyoa_rex.canon_category as enum (
  'character_fact', 'world_rule', 'relationship',
  'consequence', 'item', 'location', 'other'
);
create type cyoa_rex.canon_subject as enum ('character', 'world', 'item', 'location');
create type cyoa_rex.canon_weight as enum ('absolute', 'strong', 'soft');
create type cyoa_rex.canon_source as enum ('breadcrumb', 'derived', 'manual');
create type cyoa_rex.canon_status as enum ('active', 'retracted', 'superseded');

-- ============================================================
-- ALLOWLIST
-- ============================================================

create table cyoa_rex.allowlist (
  wallet_address text primary key check (wallet_address = lower(wallet_address)),
  role cyoa_rex.allowlist_role not null,
  added_at timestamptz not null default now()
);

-- ============================================================
-- CHARACTERS
-- ============================================================

create table cyoa_rex.characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier cyoa_rex.character_tier not null,
  fixed_traits jsonb not null default '{}'::jsonb,
  decision_weights jsonb not null default '{}'::jsonb,
  relationships jsonb not null default '[]'::jsonb,
  destiny jsonb not null default '{}'::jsonb,
  wildcards jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index characters_tier_idx on cyoa_rex.characters(tier);

-- ============================================================
-- EPISODES
-- ============================================================

create table cyoa_rex.episodes (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  title text not null,
  checkpoints jsonb not null default '[]'::jsonb,
  current_checkpoint_id text,
  status cyoa_rex.episode_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PAGES
-- ============================================================

create table cyoa_rex.pages (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references cyoa_rex.episodes(id) on delete cascade,
  sequence int not null,
  content text not null,
  options jsonb not null default '[]'::jsonb
    check (jsonb_array_length(options) between 0 and 3),
  status cyoa_rex.page_status not null default 'draft',
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_id, sequence)
);

create index pages_status_idx on cyoa_rex.pages(status);

-- ============================================================
-- CHOICES (winning community outcome per page)
-- ============================================================

create table cyoa_rex.choices (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references cyoa_rex.pages(id) on delete cascade,
  chosen_option text not null,
  vote_metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create unique index choices_page_unique on cyoa_rex.choices(page_id);

-- ============================================================
-- STATE TRACKER (snapshot per lock)
-- ============================================================

create table cyoa_rex.state_tracker (
  id uuid primary key default gen_random_uuid(),
  snapshot_at_page_id uuid references cyoa_rex.pages(id) on delete set null,
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

create table cyoa_rex.canon_facts (
  id uuid primary key default gen_random_uuid(),
  category cyoa_rex.canon_category not null,
  subject_type cyoa_rex.canon_subject,
  subject_id uuid,
  content text not null,
  raw_input text not null,
  weight cyoa_rex.canon_weight not null default 'strong',
  source cyoa_rex.canon_source not null default 'breadcrumb',
  status cyoa_rex.canon_status not null default 'active',
  superseded_by uuid references cyoa_rex.canon_facts(id) on delete set null,
  added_by text not null,
  added_at timestamptz not null default now()
);

create index canon_facts_subject_idx on cyoa_rex.canon_facts(subject_type, subject_id);
create index canon_facts_category_idx on cyoa_rex.canon_facts(category);
create index canon_facts_status_idx on cyoa_rex.canon_facts(status);

-- ============================================================
-- GENERATIONS (audit trail, kept forever)
-- ============================================================

create table cyoa_rex.generations (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references cyoa_rex.pages(id) on delete set null,
  prompt text not null,
  response text not null,
  model text not null,
  tokens_in int,
  tokens_out int,
  cost_usd numeric(10,6),
  facts_used uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index generations_page_idx on cyoa_rex.generations(page_id);
create index generations_facts_used_idx on cyoa_rex.generations using gin (facts_used);

-- ============================================================
-- STYLE GUIDE (singleton)
-- ============================================================

create table cyoa_rex.style_guide (
  id int primary key default 1 check (id = 1),
  voice text,
  tone text,
  genre_conventions text,
  forbidden text,
  examples text,
  updated_at timestamptz not null default now()
);

insert into cyoa_rex.style_guide (id) values (1);

-- ============================================================
-- updated_at triggers
-- ============================================================

create or replace function cyoa_rex.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger t_characters_updated before update on cyoa_rex.characters
  for each row execute function cyoa_rex.touch_updated_at();
create trigger t_episodes_updated before update on cyoa_rex.episodes
  for each row execute function cyoa_rex.touch_updated_at();
create trigger t_pages_updated before update on cyoa_rex.pages
  for each row execute function cyoa_rex.touch_updated_at();
create trigger t_style_guide_updated before update on cyoa_rex.style_guide
  for each row execute function cyoa_rex.touch_updated_at();

-- ============================================================
-- RLS
-- Gate every table on allowlist membership via JWT claim wallet_address.
-- Owner can do anything. Loremaster can do anything EXCEPT:
--   - modify allowlist
--   - unlock locked/canonical pages
--   - hard delete canon_facts referenced by locked pages
-- (Those extra constraints are enforced in application / function layer.)
-- ============================================================

alter table cyoa_rex.allowlist enable row level security;
alter table cyoa_rex.characters enable row level security;
alter table cyoa_rex.episodes enable row level security;
alter table cyoa_rex.pages enable row level security;
alter table cyoa_rex.choices enable row level security;
alter table cyoa_rex.state_tracker enable row level security;
alter table cyoa_rex.canon_facts enable row level security;
alter table cyoa_rex.generations enable row level security;
alter table cyoa_rex.style_guide enable row level security;

-- Helper: current wallet from JWT
create or replace function cyoa_rex.current_wallet()
returns text language sql stable as $$
  select lower(coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'wallet_address', ''))
$$;

create or replace function cyoa_rex.is_allowed()
returns boolean language sql stable as $$
  select exists (select 1 from cyoa_rex.allowlist where wallet_address = cyoa_rex.current_wallet())
$$;

create or replace function cyoa_rex.is_owner()
returns boolean language sql stable as $$
  select exists (select 1 from cyoa_rex.allowlist where wallet_address = cyoa_rex.current_wallet() and role = 'owner')
$$;

-- Generic allowed-only policies
do $$
declare t text;
begin
  foreach t in array array['characters','episodes','pages','choices','state_tracker','canon_facts','generations','style_guide']
  loop
    execute format('create policy %I_select on cyoa_rex.%I for select using (cyoa_rex.is_allowed())', t, t);
    execute format('create policy %I_insert on cyoa_rex.%I for insert with check (cyoa_rex.is_allowed())', t, t);
    execute format('create policy %I_update on cyoa_rex.%I for update using (cyoa_rex.is_allowed()) with check (cyoa_rex.is_allowed())', t, t);
    execute format('create policy %I_delete on cyoa_rex.%I for delete using (cyoa_rex.is_allowed())', t, t);
  end loop;
end $$;

-- allowlist: only owner can mutate; anyone allowed can read
create policy allowlist_select on cyoa_rex.allowlist for select using (cyoa_rex.is_allowed());
create policy allowlist_insert on cyoa_rex.allowlist for insert with check (cyoa_rex.is_owner());
create policy allowlist_update on cyoa_rex.allowlist for update using (cyoa_rex.is_owner()) with check (cyoa_rex.is_owner());
create policy allowlist_delete on cyoa_rex.allowlist for delete using (cyoa_rex.is_owner());

-- ============================================================
-- Seed owner wallets (NoCredits)
-- ============================================================

insert into cyoa_rex.allowlist (wallet_address, role) values
  (lower('0x2Ec43E727CC04e11e7FdBe129D420D680E1480c9'), 'owner'),
  (lower('BEUdDxoMnpAbNsoynyT2h9Xr6yk3anf4cNgzZvKXhkyw'), 'owner')
on conflict (wallet_address) do nothing;

-- ----- from 20260414104036_grants.sql -----
-- Grant Supabase roles access to the cyoa_rex schema.
-- RLS still gates rows; this just lets the roles reach the schema/tables.

grant usage on schema cyoa_rex to anon, authenticated, service_role;

grant all on all tables in schema cyoa_rex to anon, authenticated, service_role;
grant all on all sequences in schema cyoa_rex to anon, authenticated, service_role;
grant all on all functions in schema cyoa_rex to anon, authenticated, service_role;

alter default privileges in schema cyoa_rex
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema cyoa_rex
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema cyoa_rex
  grant all on functions to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- ----- from 20260414104703_fix_rls_recursion.sql -----
-- Fix infinite RLS recursion on cyoa_rex.allowlist.
--
-- Original is_allowed()/is_owner() did `SELECT FROM cyoa_rex.allowlist` under the
-- caller's role, which re-triggered the allowlist RLS policy, which called
-- is_allowed() again, producing "stack depth limit exceeded".
--
-- Marking the helpers SECURITY DEFINER lets them run as the function owner
-- and bypass RLS for the allowlist lookup only.

create or replace function cyoa_rex.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = cyoa_rex, public
as $$
  select exists (
    select 1 from cyoa_rex.allowlist where wallet_address = cyoa_rex.current_wallet()
  )
$$;

create or replace function cyoa_rex.is_owner()
returns boolean
language sql
stable
security definer
set search_path = cyoa_rex, public
as $$
  select exists (
    select 1 from cyoa_rex.allowlist
    where wallet_address = cyoa_rex.current_wallet() and role = 'owner'
  )
$$;

notify pgrst, 'reload schema';

-- ----- from 20260414200246_sessions.sql -----
-- Session tokens for server-mediated wallet auth.
-- A Vercel serverless function verifies a wallet signature once, inserts
-- a row here, and returns the token. Subsequent API calls present the
-- token in the Authorization header; the function looks up the row to
-- resolve the wallet, then performs the DB op using the service role.

create table cyoa_rex.sessions (
  token text primary key,
  wallet_address text not null references cyoa_rex.allowlist(wallet_address) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now()
);

create index sessions_wallet_idx on cyoa_rex.sessions(wallet_address);
create index sessions_expires_idx on cyoa_rex.sessions(expires_at);

alter table cyoa_rex.sessions enable row level security;

-- No policies: anon/authenticated get nothing. Only service_role can read/write.

-- ----- from 20260415194607_default_episode.sql -----
-- Insert a default Episode 1 so pages have somewhere to live before we
-- build proper episode planning UI.

insert into cyoa_rex.episodes (number, title, status)
values (1, 'Episode 1', 'active')
on conflict (number) do nothing;

-- ----- from 20260415215054_pages_facts_used.sql -----
-- Track which canon facts were used to generate each page.
-- Used by the canon_facts delete check: if a fact was baked into a
-- locked/canonical page, it can't be hard-deleted (HIL prompts supersede).

alter table cyoa_rex.pages
  add column if not exists facts_used uuid[] not null default '{}';

create index if not exists pages_facts_used_idx on cyoa_rex.pages using gin (facts_used);

notify pgrst, 'reload schema';

-- ----- from 20260415223115_canon_reconciliation.sql -----
-- Reconciliation support for canon facts.
-- When a new breadcrumb contradicts existing canon, the loremaster must
-- either (a) supersede the old fact, (b) reconcile by writing an explanation
-- that lets both coexist, or (c) cancel. Explanation is stored on the new
-- fact; in the reconcile case we also record which facts the new one links.

alter table cyoa_rex.canon_facts
  add column if not exists reconciles uuid[] not null default '{}',
  add column if not exists resolution_note text;

create index if not exists canon_facts_reconciles_idx on cyoa_rex.canon_facts using gin (reconciles);

notify pgrst, 'reload schema';

-- ----- from 20260420100000_chapters.sql -----
-- Add chapter structure to support paced storytelling.
-- Episode has a goal (final destination).
-- Chapters are milestones proposed by Claude, approved by the loremaster.
-- Pages belong to a chapter.

-- ============================================================
-- Episode goal
-- ============================================================
alter table cyoa_rex.episodes add column if not exists goal text;

-- Remove the old checkpoints/current_checkpoint_id columns (unused)
alter table cyoa_rex.episodes drop column if exists checkpoints;
alter table cyoa_rex.episodes drop column if exists current_checkpoint_id;

-- ============================================================
-- Chapter status enum
-- ============================================================
create type cyoa_rex.chapter_status as enum ('proposed', 'active', 'complete');

-- ============================================================
-- Chapters table
-- ============================================================
create table cyoa_rex.chapters (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references cyoa_rex.episodes(id) on delete cascade,
  sequence int not null,
  title text not null,
  goal text not null,               -- what this chapter must accomplish
  summary text,                     -- filled when chapter completes
  status cyoa_rex.chapter_status not null default 'proposed',
  proposed_at timestamptz not null default now(),
  activated_at timestamptz,
  completed_at timestamptz,
  unique (episode_id, sequence)
);

create index chapters_episode_status_idx on cyoa_rex.chapters(episode_id, status);

-- ============================================================
-- Link pages to chapters
-- ============================================================
alter table cyoa_rex.pages add column if not exists chapter_id uuid references cyoa_rex.chapters(id) on delete set null;
create index if not exists pages_chapter_idx on cyoa_rex.pages(chapter_id);

-- ============================================================
-- updated_at trigger for chapters
-- ============================================================
create trigger chapters_updated_at
  before update on cyoa_rex.chapters
  for each row execute function cyoa_rex.touch_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table cyoa_rex.chapters enable row level security;

create policy "chapters_read" on cyoa_rex.chapters for select
  using (cyoa_rex.is_allowed());

create policy "chapters_write" on cyoa_rex.chapters for all
  using (cyoa_rex.is_allowed());

-- ============================================================
-- Grants
-- ============================================================
grant all on cyoa_rex.chapters to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- ----- from 20260420110000_chapter_lore_text.sql -----
-- Add lore_text to chapters for storing the committed narrative.
alter table cyoa_rex.chapters add column if not exists lore_text text;

notify pgrst, 'reload schema';

