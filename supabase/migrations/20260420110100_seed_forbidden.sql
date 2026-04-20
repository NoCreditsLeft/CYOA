-- Seed initial story boundaries from the Loremaster.
update cyoa.style_guide
set forbidden = 'No traveling to outside regions or introducing modes of transportation to outside regions. No additional characters may be added without prior prompting from the Loremaster.'
where id = 1;
