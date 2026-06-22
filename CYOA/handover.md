# Project Handover: Nibbles CYOA — Loremaster Console

## What This Is

An interactive Choose Your Own Adventure story played live on X Spaces. A community audience votes on story directions in real time. The Loremaster (Jazzy) runs each session using a web-based console that leverages Claude AI for narrative generation. The story world is **"Secrets of Beaver Lodge"** from the **Nibbles NFT collection by Franky the Frog**.

**Production URL:** https://cyoa-lake.vercel.app/ (auto-deploys from main via Vercel)

---

## Multi-IP Support

The codebase is IP-agnostic. The same code serves any number of stories; each
gets its own Postgres schema in the shared RIVALS project and its own Vercel
project. The active schema is selected by one env var, `VITE_CYOA_SCHEMA`
(unset -> `cyoa`, the Nibbles default).

| IP | Schema | Status |
|----|--------|--------|
| Nibbles / Beaver Lodge | `cyoa` | live |
| Tribe Called Rex | `cyoa_rex` | bootstrap ready (`supabase/bootstrap/cyoa_rex.sql`) |
| Drop Ded Gorgez | `cyoa_gorgez` | bootstrap ready (`supabase/bootstrap/cyoa_gorgez.sql`) |

Setup steps per IP are in `DEPLOYMENT.md`. Bootstraps are regenerated from the
structural migrations with `scripts/build_bootstrap.sh`.

---

## Architecture

- **Frontend:** React 18 + Vite, single-page app with tab navigation (Create, Breadcrumbs, Lore)
- **Backend:** Vercel serverless functions (`/api/*`) using service-role Supabase client
- **Database:** Supabase Postgres, custom `cyoa` schema inside shared RIVALS project (ref: `ttdrylkhfhkzrtugfhzo`)
- **AI:** Anthropic Claude API for story generation, breadcrumb parsing, chapter proposals, and conflict detection
- **Auth:** WalletConnect — wallet signature verification → server-side session token (7-day expiry). No Supabase Auth/JWKS (legacy JWT revoked).

### Access Control

Only two wallets are allowed:
- **Owner:** `0x2Ec43E727CC04e11e7FdBe129D420D680E1480c9`
- **Loremaster:** `0x80c3Ea7CDbE81fA33df114c69094E682247EBf00`

Gated by `cyoa.allowlist` table. RLS on all tables; `cyoa.is_allowed()` and `cyoa.is_owner()` helper functions (SECURITY DEFINER to avoid recursion).

---

## Story Structure

### Hierarchy

**Episode** → **Chapters** (~10) → **Pages** (~10 per chapter)

- **Episode:** The full story arc. Has a `goal` — the final destination the story must reach.
- **Chapter:** A milestone within the episode. Proposed by Claude based on the episode goal, completed chapters, and current canon. Loremaster approves/rejects/activates. Each chapter has its own `goal` — what it must accomplish.
- **Page:** A short narrative chunk (1–2 minutes read aloud) with 2–3 community choice options. All options lead toward the chapter goal — the community chooses *how*, not *whether*, the story advances.

### Pacing

Claude receives chapter goal + page count + chapters remaining in every generation prompt, allowing it to pace: build/explore early, converge late. The episode goal is always visible as the ultimate destination.

### Backstory

The community previously played through Jazzy's original "Secrets of Beaver Lodge" story, choosing Path B: Pages 1→2→4→7→10→12, ending "You Woke What Slept." This path is:
- Seeded as 23 canon facts in the Font of Truth (backstory, not locked pages)
- Stored as a completed Prologue chapter (sequence 0) on the Lore page
- The starting point for Episode 1 — "After the Awakening"

---

## Features

### Create Tab (Main Workspace)

**Style Guide** — Collapsible editor for voice, tone, genre conventions, forbidden rules, and examples. All fields injected into every generation prompt. Currently has forbidden rules set by the Loremaster.

**Story Arc** — Episode goal input + chapter management:
- Set the episode's final destination
- "Propose Chapter N" — Claude generates a chapter title + goal based on episode goal, completed chapters, canon, and recent story. Loremaster can steer with optional text.
- Activate / Reject proposed chapters
- "Commit to Lore" — completes the active chapter, concatenating all locked pages into `lore_text`

**Pages** — Generation workspace for the active chapter:
- "Generate next page" with optional steering textarea
- Draft pages show full narrative + choice options
- Lock a page by selecting which option the community chose
- Discard/regenerate drafts
- Copy single page or full episode to clipboard

### Breadcrumbs Tab (Font of Truth)

Canon fact management with category filters (Character, World, Location, Relationship, etc.):
- Drop a breadcrumb (natural language) → Claude parses into structured canon fact with category, weight (absolute/strong/soft), and content
- **Conflict detection:** If a new fact contradicts existing canon, a ConflictModal appears requiring the Loremaster to either:
  - **Reconcile** — both facts coexist, Loremaster explains the rule that allows it
  - **Supersede** — new fact wins, old fact is retracted with explanation
- Delete facts (blocked if referenced by locked pages via `facts_used` tracking)
- Filter by category to find specific facts

### Lore Tab

The committed story as shaped by the community:
- Lists all completed chapters with title, summary, and expandable full narrative
- Community choices highlighted in gold
- Currently contains the Prologue (Jazzy's original story, Path B)
- Each future chapter gets committed here via "Commit to Lore" after its live session

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/verify` | Wallet signature verification → session token |
| GET | `/api/auth/me` | Current session info (wallet, role) |
| GET | `/api/canon` | List active canon facts |
| POST | `/api/canon/breadcrumb` | Parse breadcrumb → canon fact (two-phase with conflict resolution) |
| DELETE | `/api/canon?id=` | Delete unused canon fact |
| GET | `/api/pages` | List pages for active episode |
| POST | `/api/pages/generate` | Generate next page via Claude |
| POST | `/api/pages/lock` | Lock page with chosen option |
| POST | `/api/pages/discard` | Delete a draft page |
| GET/PUT | `/api/style` | Get/update style guide |
| PUT | `/api/episodes/goal` | Set episode goal |
| GET | `/api/chapters` | List chapters for active episode |
| POST | `/api/chapters` | Activate a proposed chapter |
| PUT | `/api/chapters` | Complete active chapter (commit to lore) |
| POST | `/api/chapters/propose` | Claude proposes next chapter |
| DELETE | `/api/chapters/delete?id=` | Reject a proposed chapter |

---

## Database Schema (cyoa namespace)

### Tables
- `allowlist` — wallet addresses + roles
- `sessions` — server-mediated auth tokens
- `characters` — parameter tables (tier, fixed traits, decision weights, relationships, destiny, wildcards)
- `episodes` — story arcs with goal and status
- `chapters` — milestones within episodes (sequence, title, goal, summary, lore_text, status)
- `pages` — narrative chunks with options, linked to episode + chapter
- `choices` — winning community vote per page
- `state_tracker` — snapshot per page lock (character states, relationships, consequences)
- `canon_facts` — Font of Truth (category, weight, status, conflict resolution fields)
- `generations` — audit trail of every Claude API call
- `style_guide` — singleton for voice/tone/genre/forbidden/examples

### Key Relationships
- Pages belong to episodes and optionally to chapters
- Choices belong to pages (1:1)
- Canon facts track `reconciles[]` and `resolution_note` for conflict resolution
- Pages track `facts_used uuid[]` for delete-protection of referenced canon

---

## Environment Variables

All set in Vercel (Production + Preview + Development):
- `VITE_SUPABASE_URL` — public, client-side
- `VITE_SUPABASE_ANON_KEY` — public, client-side (`sb_publishable_*`)
- `SUPABASE_SECRET_KEY` — server-only (`sb_secret_*`)
- `ANTHROPIC_API_KEY` — server-only

---

## Loremaster's Current Boundaries

Set in the Style Guide `forbidden` field:
1. No traveling to outside regions or introducing modes of transportation to outside regions
2. No additional characters may be added without prior prompting from the Loremaster

---

## Character Framework System

Each character is defined by a parameter table, not a script. When community choices place a character in a situation, Claude generates their response using these parameters + cumulative choice history.

### Per-Character Parameter Table

| Parameter | Description |
|---|---|
| **Fixed Traits** | Personality, motivations, fears, loyalties — things that don't change |
| **Decision-Weight Spectrums** | e.g. brave↔cautious, selfish↔selfless — spectrums, not binaries |
| **Relationships** | Connections to other characters, whether those can shift, and under what conditions |
| **Destiny** | Best possible outcome and worst possible outcome for this character |
| **Wildcards** | Specific conditions that could flip their behavior unexpectedly |

### Cast Tiers

| Tier | Role |
|---|---|
| **Core** | Always present in the main storyline |
| **Secondary** | Appear based on community choices |
| **Cameo** | Flavor characters, low investment, high color |

---

## Testing & Reset

A reset script exists at `scripts/reset_test.sql` to snap the database back to the post-prologue state (keeps episode, prologue, canon facts, style guide; removes all test chapters, pages, choices, generations).

---

## What's Built ✅

- Wallet-gated auth (WalletConnect → server session) ✅
- Tab navigation (Create / Breadcrumbs / Lore) ✅
- Style Guide editor ✅
- Font of Truth with breadcrumb parsing, conflict detection, reconciliation ✅
- Episode + Chapter + Page hierarchy ✅
- Claude-powered chapter proposals with pacing awareness ✅
- Page generation with canon, style, chapter goal, and steering context ✅
- Page locking with community choice recording ✅
- Lore page with committed chapter narratives ✅
- Prologue seeded from Jazzy's original story (Path B) ✅
- 23 backstory canon facts seeded ✅
- Forbidden rules set ✅
- Reset script for testing ✅

## What's Needed Next

1. **Episode goal** — the Loremaster sets the final destination for Episode 1
2. **World building details** — additional characters, locations, rules from the Loremaster
3. **Style guide content** — voice, tone, genre conventions for Beaver Lodge
4. **Characters UI** — parameter table management in the console (DB table exists, no UI yet)
5. **State tracker integration** — snapshot on page lock (DB table exists, not wired up yet)
6. **Multi-episode management** — creating/advancing episodes
7. **Story export** — serving committed lore to a public-facing storybook frontend
