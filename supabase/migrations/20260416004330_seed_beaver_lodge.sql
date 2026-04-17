-- Seed: Secrets of Beaver Lodge — backstory canon.
--
-- Wipes all prior test data (canon, pages, choices) and seeds the world
-- derived from Jazzy's original story, fixed on community path B:
--   Page 1 → 2 → 4 → 7 → 10 → 12 ("You Woke What Slept").
--
-- No locked pages are created. The whole prequel is encoded as canon
-- facts; Episode 1 starts fresh with this as context.

-- ── Wipe test data ───────────────────────────────────────
delete from cyoa.choices;
delete from cyoa.pages;
delete from cyoa.canon_facts;

-- ── Reset Episode 1 title ────────────────────────────────
update cyoa.episodes
  set title = 'Episode 1 — After the Awakening',
      status = 'active'
  where number = 1;

-- ── Seed canon ───────────────────────────────────────────
-- Author fallback: the ETH owner wallet in cyoa.allowlist.
do $$
declare
  owner_wallet text := lower('0x2Ec43E727CC04e11e7FdBe129D420D680E1480c9');
begin

  insert into cyoa.canon_facts
    (category, subject_type, content, raw_input, weight, source, added_by)
  values

  -- ── Characters ─────────────────────────────────────────
  ('character_fact', 'character',
   'Beverly Beaver is the protagonist, a young beaver who lives at Beaver Lodge and wears pink glasses.',
   'Beverly Beaver adjusted her pink glasses — introduced at Page 1.',
   'absolute', 'manual', owner_wallet),

  ('character_fact', 'character',
   'Beverly is curious, perceptive, and willing to walk into danger to find the truth.',
   'Path B: Beverly chose to investigate the lights, follow the glowing footprints, and talk to Wiley rather than hide or flee.',
   'strong', 'manual', owner_wallet),

  ('character_fact', 'character',
   'Beatrice is Beverly''s cousin — quiet, watchful, and uneasy about the forest.',
   'Her cousin Beatrice stood beside her, quiet… watchful.',
   'strong', 'manual', owner_wallet),

  ('character_fact', 'character',
   'Beatrice is secretly part of a society that protects the forest, though Beverly has not yet learned this.',
   'Page 11 reveal, not yet triggered on path B — held as latent lore.',
   'strong', 'manual', owner_wallet),

  ('character_fact', 'character',
   'Wiley the Wolf is a creature of the Whispering Woods who knows the forest''s ancient secrets and emerges from shadows to warn outsiders.',
   'It''s Wiley the Wolf, emerging from the shadows. "You shouldn''t be here…"',
   'strong', 'manual', owner_wallet),

  ('character_fact', 'character',
   'Wiley has warned Beverly that "the forest remembers, and it does not like being changed."',
   'Direct quote from Wiley on Page 7.',
   'absolute', 'manual', owner_wallet),

  -- ── Setting ────────────────────────────────────────────
  ('location', 'location',
   'Beaver Lodge stands at the edge of the Whispering Woods, windows glowing warmly into the night.',
   'At the edge of a dense, whispering forest stood Beaver Lodge.',
   'absolute', 'manual', owner_wallet),

  ('location', 'location',
   'Beaver Lodge sits on an ancient crossing point where forest energy flows — the foundation of everything that is now happening.',
   'Wiley''s reveal: "This land is a crossing point—where ancient forest energy flows."',
   'absolute', 'manual', owner_wallet),

  ('location', 'location',
   'The Whispering Woods flicker at night with strange, dancing lights.',
   'The woods beyond flickered with strange, dancing lights.',
   'strong', 'manual', owner_wallet),

  ('location', 'location',
   'Trees deep in the forest bear glowing carved symbols that pulse faintly.',
   'Trees carved with strange symbols. They glow faintly.',
   'strong', 'manual', owner_wallet),

  ('location', 'location',
   'Glowing footprints sometimes appear between the trees, leading deeper into the woods.',
   'Footprints. Glowing ones.',
   'strong', 'manual', owner_wallet),

  -- ── World rules ────────────────────────────────────────
  ('world_rule', 'world',
   'The forest communicates through lights and symbols; it does not attack.',
   'Derived rule from Wiley''s warnings and the symbol behaviour.',
   'absolute', 'manual', owner_wallet),

  ('world_rule', 'world',
   'The glowing symbols on the trees are warnings and boundary markers, not decoration.',
   'Wiley''s explanation: "The symbols? They''re warnings."',
   'absolute', 'manual', owner_wallet),

  ('world_rule', 'world',
   'A campground expansion near Beaver Lodge has been disturbing the forest''s ancient energy.',
   'Wiley: "The expansion is disturbing it."',
   'strong', 'manual', owner_wallet),

  -- ── Past events (community path B) ────────────────────
  ('consequence', 'character',
   'Beverly investigated the strange lights in the forest rather than staying inside with Beatrice.',
   'Community choice on Page 1.',
   'absolute', 'manual', owner_wallet),

  ('consequence', 'character',
   'Beverly followed the glowing footprints deeper into the Whispering Woods.',
   'Community choice on Page 2.',
   'absolute', 'manual', owner_wallet),

  ('consequence', 'character',
   'Beverly met Wiley the Wolf face to face and spoke with him rather than hiding.',
   'Community choice on Page 4.',
   'absolute', 'manual', owner_wallet),

  ('consequence', 'character',
   'Beverly asked Wiley about the symbols and learned the lodge sits on an ancient crossing point.',
   'Community choice on Page 7, leading into Page 10.',
   'absolute', 'manual', owner_wallet),

  ('consequence', 'world',
   'Despite Wiley''s warning, the community chose to let the campground expansion continue.',
   'Community choice on Page 10.',
   'absolute', 'manual', owner_wallet),

  -- ── Current state at story start ──────────────────────
  ('consequence', 'world',
   'Construction at the campground has continued unabated.',
   'Page 12: "Construction continues."',
   'absolute', 'manual', owner_wallet),

  ('consequence', 'world',
   'The ground now trembles, and the symbols on the trees burn bright.',
   'Page 12: "The ground trembles. The symbols burn bright."',
   'strong', 'manual', owner_wallet),

  ('consequence', 'world',
   'Something ancient has been awakened beneath Beaver Lodge.',
   'Page 12: "Something awakens. Something ancient."',
   'absolute', 'manual', owner_wallet),

  ('consequence', 'character',
   'Something ancient is now watching Beverly.',
   'Page 12: "Something watching."',
   'absolute', 'manual', owner_wallet);

end $$;
