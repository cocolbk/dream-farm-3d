# Dream Farm 3D

Cozy 3D farming / building / shop sim (browser-first). See `Dream_Farm_3D_PRD (1).md` (source of truth) and `IMPLEMENTATION_PLAN.md`.

## Status

- [x] Phase 0 — scaffold + diorama + UI shell
- [x] Phase 1 — playable foundation (plant/water/harvest, coins, build, save)
- [x] Phase 2 — tractor + shop
- [x] Phase 3 — customer vehicles (current)
- [ ] Phase 3 — customer vehicles
- [ ] Phase 4 — staff + service
- [ ] Phase 5 — expansion + polish
- [ ] Phase 6 — PWA + release

## Run (Windows)

Use `npm.cmd` (PowerShell script execution is blocked by default):

```bat
npm.cmd install
npm.cmd run dev
```

Open http://localhost:5173 → New Game → orbit with mouse / 1-finger drag, zoom with wheel / pinch, click plots for prompt.

```bat
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
```

## Controls (Phase 0)

- Orbit / zoom: mouse drag + wheel, touch drag + pinch
- Tap/click object: interaction prompt (gameplay in Phase 1)
- Toolbar: highlights only (functional in Phase 1)
