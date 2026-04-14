# Project Handover: Nibbles Choose Your Own Adventure — X Spaces

## What This Is

An interactive Choose Your Own Adventure story designed for live play on X Spaces. A community audience votes on story directions in real time. The project runs as a series of weekly episodes over ~2 months, with a fixed ending that all story paths eventually converge toward. The story world and characters are drawn from the **Nibbles NFT collection by Franky the Frog**.

---

## Core Design Principle: Lore Possibility, Not Lore Building

We are NOT pre-writing storylines or scripting character arcs. We are building **character frameworks** — parameter tables that define how characters behave, what they want, and how they'd react in any given situation. Combined with a running state tracker of community choices, these frameworks allow Claude to generate dynamic, contextually consistent, in-character story content on the fly.

The operative concept is **lore possibility** — keeping the design space open and generative rather than closed and prescriptive.

---

## Episode Structure

- **8–10 episodes**, one per week
- Each episode uses a **funnel/diamond model**: choices diverge at the start, converge to **2–3 fixed checkpoint outcomes** at the end
- A fixed ending exists that all paths eventually reach
- Episodes contain multiple "pages" — short narrative chunks (a few paragraphs to a couple of pages) read aloud on Spaces, followed by a community vote on direction
- Some choices affect pacing (how quickly we reach an outcome), some affect the story arc dramatically, but all paths funnel to the episode's checkpoint outcomes

### What's Needed (not yet built)
- The fixed ending
- 8–10 episode checkpoint definitions (the 2–3 possible states at the end of each episode)

---

## Character Framework System

Each character is defined by a **parameter table**, not a script. When community choices place a character in a situation, Claude generates their response using these parameters + the cumulative choice history.

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
| **Secondary** | Appear based on community choices — their storyline may or may not cross the main plot |
| **Cameo** | Flavor characters, low investment, high color |

### What's Needed (not yet built)
- Nibbles NFT collection details and world context from NoCredits
- Character assignments to cast tiers
- Completed parameter tables per character

---

## State Tracker

A living document that logs:
- Every community choice made
- Current character statuses and relationship states
- Consequences owed (things that must pay off later based on earlier decisions)
- Which characters' storylines have intersected the main plot
- Current episode checkpoint state

This is cross-referenced before every new page is generated to ensure continuity — no earlier action is forgotten.

---

## Workflow Per Episode

1. Review state tracker
2. Generate pages based on character frameworks + choice history + episode checkpoint targets
3. Read pages live on X Spaces
4. Community votes on direction
5. Generate next page based on vote outcome
6. Repeat until episode checkpoint is reached
7. Update state tracker

---

## What's Ready

- Episode structure concept (funnel/diamond model) ✅
- Character framework format (parameter tables) ✅
- Cast tier system ✅
- State tracker concept ✅
- Design philosophy locked (lore possibility, not lore building) ✅

## What's Needed Next

1. **Nibbles NFT collection context** — world, characters, visual/thematic tone
2. **The ending** — the fixed destination all paths lead to
3. **Episode checkpoint map** — the 2–3 possible states at the end of each episode
4. **Character parameter tables** — built once world context is provided
5. **Storytelling style definition** — voice, tone, genre conventions

---

## Key Principle for Claude

**Structure before world-building.** The systems are designed to be world-agnostic — once the Nibbles context arrives, it slots into the existing framework. Do not invent world details. Do not write lore. Build parameter tables. Generate in-character responses dynamically from those tables and the state tracker. Every output should be emergent from the system, not scripted.
