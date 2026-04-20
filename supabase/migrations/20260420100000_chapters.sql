-- Add chapter structure to support paced storytelling.
-- Episode has a goal (final destination).
-- Chapters are milestones proposed by Claude, approved by the loremaster.
-- Pages belong to a chapter.

-- ============================================================
-- Episode goal
-- ============================================================
alter table cyoa.episodes add column if not exists goal text;

-- Remove the old checkpoints/current_checkpoint_id columns (unused)
alter table cyoa.episodes drop column if exists checkpoints;
alter table cyoa.episodes drop column if exists current_checkpoint_id;

-- ============================================================
-- Chapter status enum
-- ============================================================
create type cyoa.chapter_status as enum ('proposed', 'active', 'complete');

-- ============================================================
-- Chapters table
-- ============================================================
create table cyoa.chapters (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references cyoa.episodes(id) on delete cascade,
  sequence int not null,
  title text not null,
  goal text not null,               -- what this chapter must accomplish
  summary text,                     -- filled when chapter completes
  status cyoa.chapter_status not null default 'proposed',
  proposed_at timestamptz not null default now(),
  activated_at timestamptz,
  completed_at timestamptz,
  unique (episode_id, sequence)
);

create index chapters_episode_status_idx on cyoa.chapters(episode_id, status);

-- ============================================================
-- Link pages to chapters
-- ============================================================
alter table cyoa.pages add column if not exists chapter_id uuid references cyoa.chapters(id) on delete set null;
create index if not exists pages_chapter_idx on cyoa.pages(chapter_id);

-- ============================================================
-- updated_at trigger for chapters
-- ============================================================
create trigger chapters_updated_at
  before update on cyoa.chapters
  for each row execute function cyoa.touch_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table cyoa.chapters enable row level security;

create policy "chapters_read" on cyoa.chapters for select
  using (cyoa.is_allowed());

create policy "chapters_write" on cyoa.chapters for all
  using (cyoa.is_allowed());

-- ============================================================
-- Grants
-- ============================================================
grant all on cyoa.chapters to anon, authenticated, service_role;

notify pgrst, 'reload schema';
