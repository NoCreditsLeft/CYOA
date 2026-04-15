-- Track which canon facts were used to generate each page.
-- Used by the canon_facts delete check: if a fact was baked into a
-- locked/canonical page, it can't be hard-deleted (HIL prompts supersede).

alter table cyoa.pages
  add column if not exists facts_used uuid[] not null default '{}';

create index if not exists pages_facts_used_idx on cyoa.pages using gin (facts_used);

notify pgrst, 'reload schema';
