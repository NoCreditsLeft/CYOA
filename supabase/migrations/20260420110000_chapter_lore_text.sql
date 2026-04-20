-- Add lore_text to chapters for storing the committed narrative.
alter table cyoa.chapters add column if not exists lore_text text;

notify pgrst, 'reload schema';
