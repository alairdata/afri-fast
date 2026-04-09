# Afri Fast — Version 2 Ideas

## Scan / Meal Detection
- **Rescan hint text**: Add subtle text below the rescan button on the results screen — "Results may vary — tap to rescan". Gemini is non-deterministic so the same image can return slightly different results. The button already exists, just needs the hint so users know it's intentional and they can retry.

## Whispers (Community Tab)
- **What it is**: A community feed where users share fasting wins, struggles, hunger tips, recipes, confessions, and motivation. Posts are anonymous — no names shown, just a unique animal emoji avatar (🦁🐯🦊 etc.) derived from the user's Supabase ID. Same emoji always follows the same user everywhere in the app (profile + posts).
- **Unlock threshold**: Whispers tab is completely hidden until the app reaches **25 active users** (counted from the `profiles` table). At that point it appears automatically like a new feature drop — no greyed-out state, no "coming soon", just gone then there.
- **Why 25**: An empty community feels dead. 25 gives enough critical mass for posts to feel lively and for new users to see activity when they first open it.
- **How to enable**: In `FastingApp.jsx`, the `userCount` state fetches `profiles` count on mount. `whispersUnlocked = userCount >= 25` is passed to `BottomTabBar`. To change the threshold, update the `>= 25` check in `FastingApp.jsx`.
- **Categories**: Hunger Tips, Fasting Wins, Motivation, Recipes, Struggles, Science, Confessions.
- **Pages**: Official curated pages (e.g. "Weight Loss Tips") can exist alongside user posts and are followable — these show page names, not emoji avatars.

