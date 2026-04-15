-- Reconciliation support for canon facts.
-- When a new breadcrumb contradicts existing canon, the loremaster must
-- either (a) supersede the old fact, (b) reconcile by writing an explanation
-- that lets both coexist, or (c) cancel. Explanation is stored on the new
-- fact; in the reconcile case we also record which facts the new one links.

alter table cyoa.canon_facts
  add column if not exists reconciles uuid[] not null default '{}',
  add column if not exists resolution_note text;

create index if not exists canon_facts_reconciles_idx on cyoa.canon_facts using gin (reconciles);

notify pgrst, 'reload schema';
