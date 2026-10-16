# Dream Farm 3D — Detailed Implementation Plan

**Source of truth:** `Dream_Farm_3D_PRD (1).md` v1.0
**Repo state at time of writing:** empty folder (only PRD, no code, no README, no package.json, no git). This plan therefore starts from zero and is ordered so every phase is playable and testable.
**Target:** Mobile + desktop browsers first, PWA second, Android wrapper later.

---

## Table of Contents

1. [Phase 0 — Design System + Architecture + Project Setup](#phase-0--design-system--architecture--project-setup)
2. [Global Architectural Decisions](#global-architectural-decisions)
3. [Proposed Repo Structure](#proposed-repo-structure)
4. [Core Data Models & Economy Tables](#core-data-models--economy-tables)
5. [Phase 1 — Playable Foundation](#phase-1--playable-foundation-mvp)
6. [Phase 2 — Machinery and Shop](#phase-2--machinery-and-shop)
7. [Phase 3 — Customer Vehicles](#phase-3--customer-vehicles)
8. [Phase 4 — Staff and Customer Service](#phase-4--staff-and-customer-service)
9. [Phase 5 — Expansion and Polish](#phase-5--expansion-and-polish)
10. [Phase 6 — Release, PWA, Mobile QA, Post-MVP](#phase-6--release-pwa-mobile-qa-post-mvp)
11. [Cross-Cutting Concerns](#cross-cutting-concerns-testing-perf-a11y-save-migration)
12. [Milestones, Exit Criteria & Suggested Order of Execution](#milestones-exit-criteria--suggested-order-of-execution)

---

## Phase 0 — Design System + Architecture + Project Setup

> Goal: no gameplay yet, but anyone can clone, `npm install`, `npm run dev`, `npm run build` and see a placeholder 3D scene + UI shell. All visual and technical rules are locked here so later phases don't rework.

### 0.1 Project scaffolding

- [ ] `git init`, `.gitignore` (node, dist, local saves), `README.md`, `LICENSE` (decide: proprietary vs MIT), `IMPLEMENTATION_PLAN.md` (this file).
- [ ] Vite + TypeScript (strict) + Three.js + ESLint + Prettier + Vitest. **Decision:** use TypeScript even though PRD says "JavaScript" — type safety prevents economy/inventory duplication bugs (§6, §10). Compile to JS; no runtime cost.
- [ ] `package.json` scripts: `dev`, `build`, `preview`, `test`, `test:e2e` (Playwright, added in Phase 1), `lint`, `typecheck`.
- [ ] Path aliases: `@/world`, `@/farming`, etc.
- [ ] Environment: Node LTS, no backend. All persistence = `localStorage` (MVP) wrapped in save service.
- [ ] CI (GitHub Actions): install → typecheck → lint → unit test → build. Blocks merge on failure.

**Exit:** fresh clone builds with 0 errors, placeholder canvas renders grass plane.

### 0.2 Design System v1 (locks look + UI language)

**Visual direction: "Cozy low-poly diorama"**

- Low-poly, flat-shaded, rounded shapes. No photorealism. All MVP models built from `three` primitives (`BoxGeometry`, `CylinderGeometry`, `ConeGeometry`, `PlaneGeometry`) + vertex colors. Zero external textures in MVP (perf + licensing risk, PRD §7.3, §10).
- Fixed palette (all materials reuse these — create `src/ui/theme.ts` + `src/world/materials.ts`):
  - Grass base `#7EC850`, dark grass `#5DA93C`, path `#D9B382`, soil tilled `#8A5A33`, soil planted `#6E4426`
  - Water `#5BC0EB`, wood `#A67C52`, barn red `#C94F4F`, roof `#7A4A3A`, cream `#FFF6E9`
  - Crop: maize `#FFC93C` / stalk `#3E9B4F`, tomato `#E94F37`, carrot `#F08A24` / leaf `#4CAF50`
  - UI: bg `#1E2A32` (HUD dark), card `#FFFFFF`, accent `#4CAF50`, warn `#FF9800`, danger `#E53935`, coin `#FFC93C`
- Lighting: hemisphere (sky/ground) + single directional with shadows (2048 map desktop, 1024 mobile, shadows off on low setting). Fog for depth. No day/night in MVP (P2).
- Scale: 1 unit = 1 m. Plots 3×3 m. Buildings snap to 1 m grid. Camera: isometric-ish orbit, min/max distance + max polar angle to prevent going under terrain.

**Typography & UI:**

- System font stack only (no webfont download for perf): `system-ui, -apple-system, "Segoe UI", Roboto...`. Sizes: HUD 14px min, body 16px, touch labels ≥16px.
- Touch targets ≥44×44 px (PRD §1.4.5). All buttons have `:active` scale + disabled state with reason tooltip ("Need 50 coins", "No seeds").
- Layout: bottom `Farm Toolbar` (mobile thumb zone) + top bar (coins, task, save dot, pause). Side panels are tabs/bottom-sheet on <768px, docked right panel on desktop (PRD §5). Never show >1 management panel at once on mobile.
- Components to build once in `src/ui/components/` (vanilla or minimal framework — see §Architecture): `Button`, `Card/Panel`, `Tabs`, `Toast`, `Modal/Confirm`, `Stepper/Quantity`, `ProgressBar` (crop growth), `Badge/StatusDot` (never color-only: always icon + text, PRD §4.12).
- Feedback language (standardize now): toasts for success (`+12 Maize harvested`), inline error + shake for invalid (`Not enough seeds`), coin-deduct always shows `-50` flyup + ledger entry.
- Sound: WebAudio bleeps (no assets yet) + mute toggle. Sounds behind `settings.soundOn` flag.

### 0.3 UX flows locked in Phase 0

- Boot → Main Menu (Continue if save exists / New Game / Settings) → Game World.
- First-time: tutorial overlay chain (5 steps max): 1) plant → 2) water → 3) harvest → 4) sell → 5) build. Each step highlights toolbar button (spotlight) and shows single objective in top bar.
- Pause: stops sim tick + vehicle movement + growth timers; shows Resume / Save status / Settings / Reset (with type-to-confirm or double-confirm).

---

## Global Architectural Decisions

### AD-1: Vite + Three.js + TypeScript, no game engine

**Rationale:** PRD §7.1 mandates Vite + Three.js + browser. Unity/Godot export adds wrapper complexity and hurts mobile web perf. Three.js primitives keep bundle <500 KB gz (target).

### AD-2: System-based architecture, logic decoupled from rendering

```
src/
  main.ts            # boot, game loop, DI wiring
  core/              # Game, Clock/Tick, EventBus, StateStore, Config/Balance
  world/             # scene, cameraRig, terrain, environmentFactory, lighting
  player/            # raycast selection, interactionPrompt (P0); character (P1)
  farming/           # plotManager, cropDefinitions, growthSystem
  inventory/         # seeds, produce, shopStock — single source of truth
  economy/           # wallet, ledger, pricing, wages — ALL coin changes go here
  vehicles/          # customerVehicleManager, pathFollower, parking/queue reservations
  buildings/         # catalog, placementValidator, ghostPreview, instanceStore
  customers/         # spawner, shoppingList generator, stateMachine
  staff/             # roster, hiring, taskQueue, roleCapabilities
  shop/              # store logic, driveThrough logic (uses customers+staff+economy)
  save/              # schema, serialize/deserialize, migration, storage adapter
  ui/                # hud, toolbar, panels (seedShop, dealership, buildMenu...), tutorial, settings
  audio/             # sfx synth
  utils/             # grid math, id gen, result types
```

- Each gameplay domain = `Manager/System` class with `update(dt)` + pure helper functions. Rendering only reads state; never mutates economy/inventory directly.
- Communication via typed `EventBus` (`crop:harvested`, `sale:completed`, `coins:changed`) so UI/ledger/save stay consistent.

### AD-3: Single authoritative stores for money and items

- `EconomyService.transact()` is the ONLY function that changes coins. It validates (no negative, confirm > threshold), writes ledger entry, emits event. Fixes §10 "duplicated sales" risk.
- `InventoryService` is the ONLY mutator of seeds/produce/stock. Sales do `inventory.reserve() → economy.transact() → inventory.commit()` atomically; failure rolls back. Prevents double-spend (§6).

### AD-4: Deterministic fixed-timestep simulation

- Render at rAF, sim ticks at 10 Hz (100 ms) + growth uses wall-clock deltas so tab-switch/pause is safe. Vehicle movement interpolates between ticks. Allows pausing/slow-mo for mobile perf (§6).
- Seeded RNG (`mulberry32`) for customer spawn/budgets so bugs are reproducible.

### AD-5: Save schema versioned from day one

```ts
type SaveV1 = { version: 1, coins, seeds, produce, shopStock, prices, plots[], buildings[], tractors, staff[], unlockedPlots, tutorial, ledgerTail, timestamp }
```

- `save/` validates with `zod`-lite or hand-rolled guards, migrates `vN → vN+1`, recovers corrupt entries by dropping that entity + toast (never crash, PRD §6). Autosave debounced 2 s after mutation + explicit save indicator dot. `Reset` requires confirm modal.

### AD-6: Mobile-first perf budget

- ≤150 draw calls, ≤100k triangles in MVP scene, ≤8 active customer vehicles, texture-free, shared geometries/materials (instanced grass/trees where possible).
- Graphics setting: High/Med/Low (pixelRatio, shadows, antialias). Auto-detect mobile → Med.
- `prefers-reduced-motion` respected; status never color-only (icon + label).

### AD-7: Testing strategy

- Unit (Vitest): economy, inventory, placement validation, growth state machine, customer budget/stock checks, save migration — must be ≥80% on those files.
- Integration: headless sim test — plant→water→harvest→sell→build→save→load round-trip asserts coins/inventory exact.
- E2E (Playwright, from Phase 1): load page, click through tutorial, screenshot HUD on desktop + mobile viewport.

---

## Proposed Repo Structure

```
/
  index.html
  public/ manifest.webmanifest icons/ (Phase 6)
  src/main.ts styles.css
  src/core/ src/world/ src/player/ src/farming/ src/inventory/
  src/vehicles/ src/buildings/ src/customers/ src/staff/
  src/shop/ src/economy/ src/save/ src/ui/ src/audio/ src/utils/
  tests/unit/ tests/integration/
  e2e/
  README.md IMPLEMENTATION_PLAN.md BALANCE.md (economy tables live here too)
```

---

## Core Data Models & Economy Tables

Define in `src/core/Config.ts` + `BALANCE.md` so tuning never requires code search.

**Crops (P0: maize, tomato, carrot):**

| Crop | Seed price | Grow time | Water needed | Yield | Sell base | Min/Max price |
|---|---|---|---|---|---|---|
| Maize | 10 | 90 s | 1 | 3 | 8/unit | 4–14 |
| Tomato | 15 | 120 s | 2 | 2 | 14/unit | 7–22 |
| Carrot | 8 | 60 s | 1 | 4 | 5/unit | 2–9 |

States: `empty → planted → growing → ready`. Watering advances/pauses timer (simple: must water once after planting; P1 adds multi-stage). Harvest → `produce`.

**Starter economy:** start coins 200, 6 plots (2 pre-tilled), 5 maize seeds + 5 carrot seeds free. Barn/storage cap 100 (P0 infinite with warning; cap enforced P1).

**Buildings (P0):** farmhouse (pre-placed, free), shop-small (150), barn (120), fence ×1m (5), path ×1m (2). Placement validated: inside owned land, no overlap (AABB), min spacing 1 m, must connect path to entrance for shop (soft warn P0, hard rule P1+).

**Tractors (P0):** 1 model "Fieldhand T-20" — price 300, action: cultivate (converts grass→tilled plot, instant with 3 s animation). Driving: click tractor → drive mode (WASD/arrows + touch joystick), camera follows. Insufficient coins → blocked with toast.

**Staff (P0, wages per 120 s payday):** shop attendant (hire 80, wage 15), cashier (hire 100, wage 20), stock worker (hire 60, wage 12), drive-through attendant (hire 90, wage 18). One task at a time; role-gated.

**Customers (P0):** spawn every 20–35 s (max 4 concurrent P0), 1–3 item list from available stock types, budget 30–120. States: `arriving → parked/queued → shopping/ordering → served → leaving`. Leave-after-45 s-unserved rule.

---

## Phase 1 — Playable Foundation (MVP)

> PRD §8 Phase 1. **Exit:** plant/water/harvest → earn coins → place building → save → refresh → continue.

1. **1A World + camera + controls (PRD §4.1 P0):** terrain plane + grass color noise, starter farmhouse (boxes), 6 plots grid, trees (cone+cylinder, instanced), dirt paths. OrbitControls (rotate + zoom, damped, clamped) + touch (1-finger orbit, pinch zoom, tap select). Interaction prompt raycast ("[E]/Tap: Harvest Maize"). Pause/settings menu skeleton.
2. **1B Farming (PRD §4.2 P0):** `cropDefinitions`, plot states with progress rings + icon+text (not color-only), seed inventory, plant/water/harvest actions, insufficient-seed/plot-occupied errors. Direct-sell button (sell from storage at base price) so coins work before shop exists.
3. **1C Coins + ledger skeleton (PRD §4.9 P0 subset):** `EconomyService` + HUD coin display + confirm modal for >100 coins + transaction history array (UI table in Phase 2).
4. **1D Building placement (PRD §4.4 P0):** catalog + ghost preview (green/red + validity text) + AABB validation + cost preview + confirm/cancel + Esc/right-click cancel. Coins deducted only on valid confirm.
5. **1E Save v1 (PRD §4.11 P0):** persist coins/seeds/produce/plots/buildings/tutorial; save indicator; reset with confirm; corrupt-save recovery test.
6. **1F Tutorial + HUD + settings (PRD §4.10/4.12 P0):** objective tracker (1 active objective), toolbar (Plant/Water/Harvest/Build/Interact), readable contrast, sound/camera-sensitivity/graphics toggles (functional where practical).

**Phase 1 tests:** unit (growth machine, placement validator, economy guards) + integration round-trip + Playwright smoke + production build green.

---

## Phase 2 — Machinery and Shop

> PRD §8 Phase 2. **Exit:** buy tractor → cultivate with it → transfer produce to shop → set price → sell with ledger entry.

1. **2A Tractor dealership (PRD §4.3 P0):** dealership panel (price, capability "Cultivates fields", Buy/Select), ownership + selection persisted, insufficient-coins block, basic drive mode + cultivate action (raycast plot → till). Tractor = separate controllable entity; camera follow toggle.
2. **2B Storage + shop inventory (PRD §4.5 P0):** Farm Storage panel (produce qty), transfer produce→shop stock (quantity stepper, validates >0 and ≤available), shop panel (stock, price stepper within min/max, recent sales list). Sell path: manual sell (P1-bridge) + auto-sell hook ready for customers.
3. **2C Pricing + ledger UI (PRD §4.5/4.9):** price bounds enforced, out-of-stock blocks sale, Finances panel (balance + categorized history), costly-purchase confirms.
4. **2D Garage/shed placeholder:** owned tractor parked marker (full garage building in P1).

**Tests:** purchase-guard, transfer/sale atomicity (no dup), price-clamp, save includes tractors/stock/prices.

---

## Phase 3 — Customer Vehicles

> PRD §8 Phase 3. **Exit:** vehicles arrive → park/queue → request list → pay iff stock+budget ok → exit, no overlaps/dupes.

1. **3A Roads + parking + drive-through lane (needs building hook):** fixed waypoint spline: entrance → parking bays (4 P0) / drive-through queue (3 slots) → exit. `ReservationManager` — slot reserved before movement; AABB separation enforced; debug-draw paths.
2. **3B Spawner + requests (PRD §4.6 P0):** timed spawn (cap concurrent), vehicle = box+cabin+wheels low-poly (no villager mesh yet — P1), shopping list from in-stock types, budget roll, state machine + Customer/Queue panel (plate id, state, list, status).
3. **3C Purchase transaction (PRD §6 rules):** validate stock + budget → atomic `reserve/commit` → revenue → vehicle release. No-parking/no-stock/no-service → vehicle waits with timeout then leaves (toast + panel reason). All edge cases from §6 covered by unit tests.
4. **3D Drive-through queue (PRD §4.7 P0):** order point trigger when vehicle reaches service window → order ticket → fulfillment by staff if present else player-click handoff (so P0 works pre-staff) → pay → exit. Queue length + order status in panel.

**Tests:** slot double-book rejection, out-of-stock/budget rejection, exact-once revenue (spawn 20 customers headless, assert ledger == inventory delta).

---

## Phase 4 — Staff and Customer Service

> PRD §8 Phase 4. **Exit:** hire 4 roles → each does only its role's tasks → wages deducted on schedule → both shopping modes run concurrently.

1. **4A Roster + hiring (PRD §4.8 P0):** Staff panel (role cards: duty, hire cost, wage/interval, Hire button), staff entity (role, wage, workplace anchor, state: idle/busy), hiring blocked if coins < cost, persisted.
2. **4B Task system:** central `TaskQueue` (priority: drive-through orders > in-store checkout > restock). Capability matrix: attendant→guide/collect, cashier→checkout, stock→storage→shelf transfer, drive-through→prepare/handoff. One-task-at-a-time enforced; unassigned/no-path → task stays queued with reason in panel.
3. **4C In-store service (P0 logic, P1 visuals):** customer waits at shop counter → attendant+ cashier pipeline → sale commits → customer `leaving`. Stock worker auto-restock when shelf < threshold (uses storage).
4. **4D Wages + status:** payday timer (120 s default, visible countdown), auto-deduct via `EconomyService`, payslip entry, can't-pay → warning + staff idle (no silent work). Status + blocked-reason per staffer.

**Tests:** role-gating (cashier can't cultivate), concurrency (no double-assignment), wage deduction exact, both-modes-concurrent sim test.

---

## Phase 5 — Expansion and Polish

> PRD §8 Phase 5. Only after Phases 1–4 are green and saved data survives reload on desktop + one Android device.

1. **5A Land + buildings P1:** locked plots with unlock cost + confirm, parking area, garage, warehouse (capacity), staff quarters (raises staff cap), chicken coop/pen (visual + egg income stub if time; else P2). Building upgrades (capacity/efficiency ×1.5 per level, cost curve).
2. **5B Crops + tractors P1:** +2 crops (e.g., wheat, pumpkin), fertilizer (×1.3 speed), quality tiers (normal/gold), growth-time variance; tractor tiers (speed/capability) + cultivator/seeder/trailer attachments + repair costs.
3. **5C Customers/villagers P1:** walking villager capsules (vehicle→shop→vehicle), car/van/pickup variants, patience/satisfaction stars, repeat-visit weighting, concurrent in-store + drive-through tuning.
4. **5D Drive-through P1:** order→pay→pickup split points, 2nd lane upgrade, queue UX improvements.
5. **5E Staff P1:** shifts/workplace assignment, reassign/dismiss, efficiency stat, headcount scaling with traffic.
6. **5F Economy P1:** daily P/L summary, category breakdown, maintenance costs.
7. **5G Progression P1:** achievements/milestones + rewards, unlock tree UI, tutorial v2 (skippable, resumable).

**Tests:** migration v1→v2 save test, perf budget check (draw calls/tris on Moto-class device), a11y pass (keyboard, contrast, touch size audit).

P2 items (seasons/weather/day-night, fuel/wear, processed goods, named villagers/reputation, loans, training/morale, events) are explicitly **not scheduled** — create GitHub issues labeled `P2-future` and leave hooks (e.g., `cropGrowthModifier` pipeline, `vehicleWear` stub) so they slot in later.

---

## Phase 6 — Release, PWA, Mobile QA, Post-MVP

1. **PWA:** `manifest.webmanifest`, icons (192/512 maskable), service worker (cache shell + fallback offline page; never cache save data), install prompt, theme-color + splash.
2. **Mobile QA gate (PRD §7.4):** test on at least one physical Android (Chrome): touch controls, panel bottom-sheet, perf (≥30 fps Med, ≥20 fps Low), install-to-homescreen, rotation. Record device + result in README.
3. **Build/release:** `npm run build` clean, preview licensed-assets audit (all primitive-generated = pass), README run/test instructions, version tag `v0.1.0-mvp` → `v0.2…` per phase, GitHub Release notes with exit-criteria checklist.
4. **Android wrapper (only after PWA stable):** Capacitor or TWA — decision deferred; spike both, pick one, document.

---

## Cross-Cutting Concerns (Testing, Perf, A11y, Save Migration)

- **Economy integrity:** every coin/item mutation covered by unit + integration test asserting `ledger sum == balance delta` and `stock delta == sales qty`. Any PR touching `economy/` or `inventory/` must add/extend such a test.
- **Save compatibility:** bump `version` on any schema change; add `migrateVNtoVN+1` + fixture test (old save loads, unknown fields dropped with warning, never crash).
- **Perf:** `stats` overlay in dev (fps, draw calls, tris); fail CI if bundle >600 KB gz or MVP scene >150 calls (use `vite-bundle-visualizer` + custom three audit script).
- **A11y:** keyboard operable toolbar/panels, focus trap in modals, `aria-live` for toasts/objectives, contrast ≥4.5:1, reduced-motion disables camera shake/vehicle bounce.
- **Git discipline:** `main` always playable; feature branches `phase-N/short-name`; squash-merge with message `phase-N: what + exit criterion touched`; tag each phase exit.

---

## Milestones, Exit Criteria & Suggested Order of Execution

| # | Milestone | Builds on | Done when (demo-able) |
|---|---|---|---|
| M0 | Setup + Design System + boot scene | — | `npm run dev` shows orbitable farm diorama; README run steps work |
| M1 | Playable foundation | M0 | plant→water→harvest→coins→build→save→reload continues (PRD §8 Ph1) |
| M2 | Machinery + shop | M1 | tractor bought + cultivates; produce→stock→priced sale + ledger (PRD §8 Ph2) |
| M3 | Vehicles | M2 | arrivals park/queue, buy iff stock+budget, exit clean (PRD §8 Ph3) |
| M4 | Staff + service | M3 | 4 roles work concurrently, wages tick, both modes run (PRD §8 Ph4) |
| M5 | Expansion + polish | M4 | land unlocks, upgrades, achievements, mobile+desktop usable (PRD §8 Ph5) |
| M6 | PWA + release | M5 | installable, tested on Android device, tagged release |

**Immediate next actions (for OpenCode agent):**

1. Scaffold Vite+TS+Three (M0), commit `chore: scaffold`.
2. Implement `materials/theme` + world diorama + camera rig, commit.
3. Implement farming + economy skeleton + toolbar HUD (M1 slice), add unit tests, commit.
4. Implement building ghost + save v1 + tutorial + pause (close M1), run build + Playwright smoke, tag `v0.1.0-mvp-foundation`.
5. Proceed M2→M6 in order; never start next milestone with red tests or broken build.

**What NOT to build in MVP:** multiplayer, cloud saves/accounts, traffic AI beyond fixed waypoints, seasons/weather/day-night, fuel/wear, processed-goods supply chain, loans, morale/training — all P2, tracked as future issues.
