# Deploying CYOA for a new IP

The app is now multi-IP. The same codebase serves any number of stories; each
one gets its own Postgres schema inside the shared RIVALS Supabase project
(ref `ttdrylkhfhkzrtugfhzo`) and its own Vercel project. No code is duplicated.

The schema is chosen by one env var: `VITE_CYOA_SCHEMA`.
- Unset  -> `cyoa`        (Nibbles / Beaver Lodge, the original)
- `cyoa_rex`     -> Tribe Called Rex
- `cyoa_gorgez`  -> Drop Ded Gorgez

Bootstrap SQL for the two new IPs is in `supabase/bootstrap/`. Each file is a
single, self-contained script (structural tables only, placeholder seeds, no
Beaver Lodge story content). Both have been validated against a real Postgres
engine.

---

## Per-IP setup (repeat for each new story)

Using Tribe Called Rex as the example. For Gorgez, swap `cyoa_rex` -> `cyoa_gorgez`
and use `cyoa_gorgez.sql`.

### 1. Create the schema

Open the Supabase dashboard for the RIVALS project -> SQL Editor -> paste the
entire contents of `supabase/bootstrap/cyoa_rex.sql` and run it. This creates
all tables, enums, functions, RLS policies, a default Episode 1, and seeds your
owner wallets.

### 2. Expose the schema to the API

Supabase dashboard -> Project Settings -> API -> "Exposed schemas" -> add
`cyoa_rex` -> save. Then back in the SQL Editor run:

```sql
notify pgrst, 'reload schema';
```

### 3. Create a new Vercel project

Point a new Vercel project at this same Git repo. Set these env vars on it
(Production + Preview + Development):

| Var | Value |
|-----|-------|
| `VITE_CYOA_SCHEMA` | `cyoa_rex` |
| `VITE_SUPABASE_URL` | same as Nibbles (shared project) |
| `VITE_SUPABASE_ANON_KEY` | same as Nibbles (`sb_publishable_*`) |
| `SUPABASE_SECRET_KEY` | same as Nibbles (`sb_secret_*`) |
| `ANTHROPIC_API_KEY` | your Claude API key (can reuse) |

Deploy. The new project gets its own URL and reads/writes only the `cyoa_rex`
schema.

### 4. Allowlist the right wallets

Both bootstraps seed your two owner wallets (`0x2Ec4...80c9` and the Solana
`BEUd...kyw`), so you can log in to every deployment immediately.

To add the Drop Ded Gorgez owner (or a per-IP loremaster) later, run in the SQL
Editor against that schema:

```sql
insert into cyoa_gorgez.allowlist (wallet_address, role)
values (lower('0xTHEIR_WALLET_HERE'), 'owner')   -- or 'loremaster'
on conflict (wallet_address) do nothing;
```

---

## Adding story content (when you move past placeholders)

The bootstrap gives you an empty world. To populate a story you set, in the app:
- **Style Guide** (Create tab) — voice, tone, genre, forbidden rules
- **Episode goal** (Create tab) — the final destination
- **Breadcrumbs** (Font of Truth) — canon facts, characters, locations, rules

Nothing here touches code. Each IP's world lives entirely in its own schema.

---

## Notes

- The original Nibbles deployment is unaffected: with `VITE_CYOA_SCHEMA` unset it
  still defaults to `cyoa`.
- All IPs share one Supabase project, so they share its billing, backups, and
  resource limits. If you later want full isolation for one IP (e.g. handing
  Gorgez to its owner), move that schema into its own Supabase project and point
  that Vercel project's `VITE_SUPABASE_*` vars at the new project — no code
  changes needed.
- Regenerate the bootstrap files after any new structural migration with
  `scripts/build_bootstrap.sh` (see below).
