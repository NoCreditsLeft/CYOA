-- Insert a default Episode 1 so pages have somewhere to live before we
-- build proper episode planning UI.

insert into cyoa.episodes (number, title, status)
values (1, 'Episode 1', 'active')
on conflict (number) do nothing;
