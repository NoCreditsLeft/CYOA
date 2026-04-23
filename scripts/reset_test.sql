-- Reset test data back to the post-prologue save point.
-- Keeps: Episode 1, Prologue chapter (seq 0), all 23 canon facts, style guide.
-- Removes: any chapters after prologue, all pages, all choices, all generations.

-- Choices first (FK to pages)
delete from cyoa.choices;

-- Pages (FK to chapters)
delete from cyoa.pages;

-- Chapters except prologue
delete from cyoa.chapters where sequence != 0;

-- Generations (audit trail from test runs)
delete from cyoa.generations;

-- Reset episode goal if one was set during testing
-- (uncomment if you want to clear it too)
-- update cyoa.episodes set goal = null where status = 'active';
