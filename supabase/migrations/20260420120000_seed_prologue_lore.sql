-- Seed the community's path through Jazzy's story as a completed Prologue chapter.
-- Path B: Pages 1 → 2 → 4 → 7 → 10 → 12 ("You Woke What Slept")

-- Get the active episode id
do $$
declare
  ep_id uuid;
begin
  select id into ep_id from cyoa.episodes where status = 'active' limit 1;

  insert into cyoa.chapters (episode_id, sequence, title, goal, summary, status, activated_at, completed_at, lore_text)
  values (
    ep_id,
    0,
    'Prologue — Secrets of Beaver Lodge',
    'Establish the world, characters, and the ancient disturbance beneath Beaver Lodge.',
    'The community guided Beverly into the Whispering Woods, where she followed glowing footprints to carved symbols, met Wiley the Wolf, learned the lodge sits on something ancient, and chose to continue the expansion — awakening something that slept beneath.',
    'complete',
    now(),
    now(),
    E'At the edge of a dense, whispering forest stood Beaver Lodge. Its windows glowed warmly, welcoming guests — but the woods beyond flickered with strange, dancing lights.\n\nBeverly Beaver adjusted her pink glasses.\n\n"Something isn''t right," she whispered.\n\nHer cousin Beatrice stood beside her, quiet… watchful.\n\n> The community chose: "Investigate the lights in the forest"\n\n---\n\nBeverly steps into the forest. The air hums softly.\n\nA flicker of light darts between trees. Then — footprints. Glowing ones.\n\nA shadow moves behind her…\n\n> The community chose: "Follow the glowing footprints"\n\n---\n\nFollowing the footprints, Beverly finds trees carved with strange symbols.\n\nThey glow faintly.\n\nA voice behind her:\n\n"You shouldn''t be here…"\n\nIt''s Wiley the Wolf, emerging from the shadows.\n\n> The community chose: "Talk to Wiley"\n\n---\n\nWiley the Wolf tilts his head.\n\n"The forest remembers," he says.\n\n"And it does not like being changed."\n\nHe steps closer.\n\n"Your lodge sits on something ancient."\n\n> The community chose: "Ignore the warning and continue exploring"\n\n---\n\nBeatrice (or Wiley) explains:\n\n"This land is a crossing point — where ancient forest energy flows."\n\n"The expansion is disturbing it."\n\nThe symbols?\n\nThey''re warnings.\n\n> The community chose: "Continue anyway"\n\n---\n\nConstruction continues.\n\nThe ground trembles.\n\nThe symbols burn bright.\n\nSomething awakens.\n\nSomething ancient.\n\nSomething watching.\n\nENDING: You Woke What Slept'
  );
end $$;
