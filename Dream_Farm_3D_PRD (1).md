# Dream Farm 3D — Product Requirements Document (PRD)

**Document version:** 1.0  
**Product type:** 3D farming, construction, village and business-management simulation game  
**Target platforms:** Mobile browsers and desktop browsers, with a future option to package as an Android app  
**Status:** Initial product specification

---

## 1. Product Overview

### 1.1 Product vision

Dream Farm 3D is a cozy 3D simulation game in which players start with a small plot of land and build it into a productive farm and thriving village business. Players grow and sell crops, buy and operate tractors, construct buildings, hire staff, serve villagers arriving in vehicles, and expand their land and facilities.

The game combines:
- Farming and crop management
- Construction and land expansion
- Tractor and equipment purchasing
- Farm shop and customer service
- Vehicle traffic and parking
- Staff hiring and management
- Inventory, pricing, income and expenses
- Progression, upgrades and achievements

### 1.2 Product goal

Deliver a playable, approachable and enjoyable farming-and-building game that runs in modern mobile and desktop browsers. Begin with a manageable single-player MVP, then add deeper simulation systems through updates.

### 1.3 Target audience

- Players who enjoy farming and life-simulation games
- Players who like building, decorating and expanding virtual places
- Players who enjoy managing a small business and staff
- Casual players using Android phones, tablets or computers

### 1.4 Design principles

1. **Easy to learn:** clear goals, visible controls and a guided introduction.
2. **Satisfying progression:** actions should help the farm grow.
3. **Player choice:** players can prioritize crops, construction, machinery or retail.
4. **Living world:** villagers, vehicles and staff should have understandable routines.
5. **Mobile-friendly:** large touch targets, readable text and good performance.
6. **Incremental development:** build working features in stages rather than creating a large, fragile prototype.

---

## 2. Core Gameplay Loop

1. Prepare land and plant crops.
2. Water or care for crops while they grow.
3. Harvest crops and place them in storage.
4. Sell produce at the farm shop or through the drive-through.
5. Earn coins and manage expenses.
6. Buy seeds, tractors, equipment and building materials.
7. Hire staff to help with farming, stocking and customer service.
8. Construct and upgrade farm facilities.
9. Attract more customers and unlock additional land.
10. Repeat and grow the farm into a thriving village business.

---

## 3. Player Experience and Game Modes

### 3.1 Main mode

A single-player sandbox/progression mode. The player controls one farm and gradually unlocks more land, crops, vehicles, buildings and staff roles.

### 3.2 Shopping experiences

Both customer experiences must be supported:

**A. In-store shopping**
- Customer vehicle enters the farm and parks in an available parking space.
- Villager exits the vehicle and walks to the store where supported by the character system.
- Customer requests or selects available products.
- Staff assist, stock workers replenish shelves and a cashier completes the sale.
- Customer returns to the vehicle and exits the farm.

**B. Drive-through shopping**
- Vehicle enters a designated queue.
- Customer submits an order at an order point or through a simple order interaction.
- Staff prepare the order from available inventory and bring it to the vehicle, or the game may represent delivery through a short handoff animation.
- Payment is processed and the vehicle exits.

The player can operate both services at the same time if there are enough staff, inventory and spaces.

---

## 4. Functional Requirements

Priority labels:
- **P0 — MVP:** essential for the first playable version
- **P1 — Next:** important follow-up feature
- **P2 — Later:** advanced enhancement

### 4.1 3D world and controls

**P0**
- Display a 3D farm with terrain, grass, trees, paths, a starter farmhouse and a small crop area.
- Support camera rotation and zoom.
- Support desktop mouse controls and mobile touch controls.
- Provide an on-screen interaction prompt when the player can use an object.
- Include a simple tutorial and pause/settings menu.

**P1**
- Add a controllable player character.
- Add character walking between vehicles, buildings and shop.
- Add more environmental details and animations.

**P2**
- Add more elaborate character animation, day/night cycles, weather and seasonal effects.

### 4.2 Farming and crops

**P0**
- Allow players to select a crop, plant seeds in prepared plots, water crops, wait for growth and harvest.
- Include maize, tomatoes and carrots as initial crops.
- Show crop states: empty, planted, growing, ready to harvest.
- Track seed inventory and harvested produce.
- Let players sell produce or move it into farm-shop stock.
- Use clear feedback for insufficient seeds, unavailable plots and successful harvests.

**P1**
- Add more crops, fertilizer, crop quality and different growth times.
- Add basic farming tasks and crop-related rewards.

**P2**
- Add seasons, weather effects and advanced crop requirements.

### 4.3 Tractors and farm equipment

**P0**
- Include a tractor shop or dealership.
- Display each tractor's price and basic capabilities.
- Allow players to buy a tractor using in-game coins.
- Save tractor ownership and current selection.
- Provide a basic tractor interaction or driving mode.
- Let tractors perform at least one useful farming action, such as preparing or cultivating a field.
- Prevent purchases when the player lacks sufficient coins.

**P1**
- Add several tractor tiers with different speeds and capabilities.
- Add equipment such as cultivators, seeders and trailers.
- Provide a garage or equipment shed to store owned machinery.
- Allow basic upgrades and repair costs.

**P2**
- Add fuel, wear, maintenance and more detailed equipment compatibility.

### 4.4 Building and land expansion

**P0**
- Provide a building mode with selectable structures and a placement preview.
- Allow placement of a farmhouse, basic shop, barn/storage shed, fences and paths.
- Validate placement so buildings do not overlap invalid objects or fall outside owned land.
- Display costs before confirming a build.
- Deduct coins only when a valid placement is confirmed.
- Allow cancellation before placement.

**P1**
- Add a parking area, garage, warehouse, staff quarters, chicken coop and animal pens.
- Allow players to unlock new land plots.
- Add building upgrades that improve capacity or efficiency.

**P2**
- Add decoration collections, landscaping tools and advanced building customization.

### 4.5 Farm shop and product inventory

**P0**
- Provide a farm shop where players can sell harvested produce.
- Track inventory by product and quantity.
- Let the player transfer produce from farm storage into shop stock.
- Let the player set prices within sensible limits.
- Deduct purchased quantities from stock and add sale revenue to coins.
- Prevent sales when requested products are out of stock.
- Display current stock, selling price and recent sales.

**P1**
- Add warehouse capacity and stock-worker restocking.
- Add demand variations and optional product bundles.
- Add daily sales summaries.

**P2**
- Add processed goods, recipes and a wider supply chain.

### 4.6 Villagers and customer vehicles

**P0**
- Spawn customer vehicles at a farm entrance.
- Support a simple vehicle path into the farm, parking/queue, service and exit.
- Reserve parking spaces so vehicles do not overlap.
- Generate customer requests based on available product types.
- Give each customer a shopping list and a spending budget.
- Complete purchases only if the required stock is available and the customer can afford the order.
- Remove sold quantities from stock and credit the farm with revenue.
- Show customer states such as arriving, waiting, shopping, being served and leaving.
- Handle the case where no parking, stock or service capacity is available.

**P1**
- Add animated villagers who exit their vehicles, walk into the shop and return to their vehicles.
- Add vehicle variety: cars, vans and pickup trucks.
- Add customer patience, queues, satisfaction and repeat visits.
- Allow in-store and drive-through customers to arrive concurrently.

**P2**
- Add named villagers, preferences, local reputation and special orders.

### 4.7 Drive-through service

**P0**
- Include a designated drive-through queue and service point.
- Allow a customer to submit an order while remaining in the vehicle.
- Assign an available staff member to prepare and hand over the order.
- Process payment and release the vehicle when the order is completed.
- Display queue length and current order status.

**P1**
- Add separate order, payment and pickup points.
- Allow the player to upgrade the number of service lanes.
- Add queue-management improvements.

### 4.8 Staff hiring and management

**P0**
- Provide a staff-management menu.
- Allow players to hire staff when they can afford the hiring cost.
- Include these initial roles:
  - **Shop attendant:** helps in-store customers find or collect products.
  - **Cashier:** processes purchases and payments.
  - **Stock worker:** transfers produce to shop stock or restocks shelves.
  - **Drive-through attendant:** prepares and hands orders to vehicle customers.
- Give staff an assigned role, wage, availability and workplace.
- Deduct wages at a clearly communicated interval.
- Staff should only complete tasks that their role supports.
- Display staff status and explain when a task cannot be completed.

**P1**
- Add a staff roster, shift/working-hours settings and workplace assignments.
- Allow staff to be reassigned or dismissed.
- Let players hire more staff as customer traffic increases.
- Add efficiency differences between staff members.

**P2**
- Add training, promotions, morale and advanced shift scheduling.

### 4.9 Finances and economy

**P0**
- Track farm coins, product sales, crop purchases, tractor purchases, building costs, staff wages and other implemented expenses.
- Show the current balance and a simple transaction history.
- Confirm costly purchases before committing them.
- Prevent spending more coins than the player owns.
- Ensure sales, costs and inventory changes are consistent.

**P1**
- Add daily profit/loss summaries and income/expense categories.
- Add building maintenance or equipment upgrade costs.

**P2**
- Add loans or more advanced financial systems only if they improve gameplay without overwhelming new players.

### 4.10 Progression and goals

**P0**
- Give the player a short tutorial and a clear first objective.
- Include starter tasks such as planting and harvesting a crop, making a sale and buying a basic item.
- Reward completed tasks with coins or unlocks.
- Save unlocked content and completed objectives.

**P1**
- Unlock additional land, crops, buildings, vehicles and customer capacity.
- Add achievements and milestone rewards.

**P2**
- Add daily challenges, special events and seasonal objectives.

### 4.11 Save system

**P0**
- Save progress locally in the browser.
- Persist coins, crop states, seeds, harvested produce, shop stock, prices, buildings, land unlocks, owned tractors, staff and tutorial progress.
- Save after important changes and provide a visible save indicator.
- Handle missing or outdated save data gracefully.
- Provide a reset option with a confirmation step.

**Limitations**
- Browser local storage saves progress on the current browser/device profile and is not automatically synchronized across devices.
- Online accounts and cloud saves are outside the MVP and may be added later.

### 4.12 Settings and accessibility

**P0**
- Provide basic sound, camera sensitivity and graphics/performance settings where practical.
- Use readable text and high-contrast interactive controls.
- Ensure essential actions can be completed with touch input and mouse input.
- Avoid relying solely on color to communicate crop or staff status.

---

## 5. Screens and Interface

1. **Main Menu:** Continue, New Game, Settings.
2. **Game World:** 3D farm, player controls, coins and task indicator.
3. **Farm Toolbar:** Plant, water, harvest, build and interact.
4. **Seed Shop:** Seeds, prices and purchase controls.
5. **Tractor Dealership:** tractor models, prices, stats and purchase/selection.
6. **Building Menu:** structures, prices, placement and cancel controls.
7. **Farm Storage:** harvested product quantities.
8. **Farm Shop:** inventory, prices and sales.
9. **Customer/Queue Panel:** in-store customers, drive-through orders and service status.
10. **Staff Management:** hiring, roles, wages, assignments and status.
11. **Finances:** current balance, sales and expenses.
12. **Land Expansion:** locked plots, unlock cost and confirmation.
13. **Settings/Pause:** resume, save status, controls and reset option.

On small screens, use collapsible panels or tabs rather than displaying every management panel at once.

---

## 6. Core Rules and Edge Cases

- Customers cannot buy products that are out of stock.
- Customers cannot spend beyond their budget.
- A vehicle must reserve a valid parking space or queue position before moving into it.
- Vehicles must not occupy the same space or drive through buildings.
- A customer should leave or wait according to a clear rule if service is unavailable.
- Drive-through orders require available stock and an available service process.
- Staff cannot work in two places at the same time.
- Staff roles must be respected; for example, a cashier should not automatically perform tractor operations.
- Staff wages should be charged at a clearly displayed interval and never without the player being informed.
- Building placement must be validated before coins are deducted.
- Tractor purchase, building placement and customer purchases must update the economy consistently.
- Saving must not duplicate money, products, staff or vehicles.
- If a saved object refers to missing or invalid content after an update, recover safely without crashing.
- Pause or slow simulation when appropriate for mobile performance and player convenience.

---

## 7. Suggested Technical Approach

### 7.1 Initial technology

- **JavaScript:** core game logic
- **Vite:** local development server and build tooling
- **Three.js:** 3D rendering, camera, lighting and scene objects
- **HTML/CSS:** menus and responsive interface
- **Browser local storage:** MVP save system
- **Git/GitHub:** source control and backup

Use the existing project's setup if it already contains working equivalent tools. Do not replace the project structure without a clear reason.

### 7.2 Architecture principles

Keep the code separated into manageable systems, for example:
- `world`: scene, camera, terrain and environment
- `player`: movement and interaction
- `farming`: plots, crop growth and harvesting
- `inventory`: seeds, produce and shop stock
- `vehicles`: tractor ownership, driving and customer vehicle movement
- `buildings`: placement, validation and upgrades
- `customers`: customer generation, requests and satisfaction
- `staff`: hiring, role assignments and task execution
- `economy`: coins, sales, costs and wages
- `save`: serialization and recovery
- `ui`: menus, HUD and mobile controls

These are suggested responsibilities, not a requirement to create every file immediately.

### 7.3 Performance and assets

- Start with simple low-poly models made from Three.js geometry.
- Avoid loading many large textures or high-polygon models in the MVP.
- Reuse models and materials where practical.
- Limit simultaneous vehicles and animated characters on low-end phones.
- Keep game logic separate from visual animation so features can be tested.
- Use assets that are original, properly licensed or otherwise permitted for the project.

### 7.4 Mobile delivery

The first deliverable is a responsive browser game. Make it installable as a PWA after core gameplay works. An Android package can be considered later using a suitable web-to-app wrapper. Test actual touch controls and performance on a physical Android device before declaring mobile support complete.

---

## 8. Development Roadmap

### Phase 1 — Playable foundation (MVP)
- 3D farm scene and camera
- Mobile and desktop controls
- Crop planting, growth and harvesting
- Coins and basic selling
- Simple building placement
- Local saving
- README and build instructions

**Exit criteria:** A player can start the game, plant and harvest crops, earn coins, place a basic building, save, refresh and continue.

### Phase 2 — Machinery and shop
- Tractor dealership
- Tractor purchase and basic operation
- Farm storage and shop inventory
- Product pricing and sales
- Basic financial ledger

**Exit criteria:** Players can buy a tractor, use it for a basic farming task and sell harvested produce through the shop.

### Phase 3 — Customer vehicles
- Vehicle entrance and exit paths
- Parking and drive-through queue
- Customer shopping requests
- Inventory-aware purchases
- Vehicle movement and service states

**Exit criteria:** Vehicles can arrive, queue or park, complete a valid purchase and leave without overlapping or duplicating sales.

### Phase 4 — Staff and customer service
- Staff hiring, roles and wages
- Stock replenishment
- In-store customer service
- Drive-through order fulfillment
- Basic queue and customer satisfaction logic

**Exit criteria:** Assigned staff perform their intended tasks, sales require available stock, wages are tracked and both shopping modes function.

### Phase 5 — Expansion and polish
- New buildings and land plots
- More tractors and crops
- Animal facilities
- Upgrades, achievements and tutorial improvements
- Performance and usability improvements

**Exit criteria:** Progression works, saved data survives a reload and the game remains usable on supported mobile and desktop browsers.

---

## 9. Acceptance Criteria

The MVP and subsequent features should be accepted only when they can be demonstrated working.

### Farming
- Player plants, waters, grows and harvests at least three crop types.
- Harvested quantities update correctly.
- Seeds and produce quantities persist after reload.

### Building
- Player can preview, place and cancel a building.
- Invalid placement is rejected without charging coins.
- Valid placement deducts the correct amount and persists after reload.

### Tractors
- Player can inspect and buy a tractor.
- Ownership and coin balance update correctly.
- The tractor can perform its implemented farming action.

### Customer vehicles
- Vehicles enter, park or queue, receive service and exit.
- Parking and queue slots cannot be double-occupied.
- Customers cannot buy unavailable products.
- Purchases update both inventory and money exactly once.

### Staff
- Player can hire and assign staff.
- Staff execute tasks that match their role.
- Wage charges are visible and correctly reflected in the balance.
- Unavailable or unassigned staff do not complete work.

### Both shopping modes
- In-store customers can be served and leave.
- Drive-through customers can place an order, receive available products, pay and leave.
- Both modes can operate together when resources and staff are available.

### Saving and compatibility
- Save data restores all implemented core progress after refresh.
- New or damaged save data does not crash the game.
- Core interactions work with mouse and touch.
- A production build completes without errors.

---

## 10. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Too many features for a first build | Deliver in phases and keep each phase playable. |
| 3D performance on entry-level phones | Use low-poly models, limited active vehicles and reusable assets. |
| Vehicle pathing becomes complicated | Begin with fixed routes and reserved parking/queue slots. |
| Staff logic becomes difficult to debug | Use clear task states and role-specific responsibilities. |
| Economy exploits or duplicated sales | Centralize transactions and validate inventory and payment before committing. |
| Local saves are lost or unavailable on another device | Explain local-save limitations; add cloud saves only in a later version. |
| AI-generated code breaks existing features | Commit working milestones to Git and test after each phase. |
| Asset licensing problems | Use original or appropriately licensed models, textures and audio. |

---

## 11. MVP Scope: What to Build First

To avoid overloading the first release, include:
- One small farm map
- Three crops: maize, tomatoes and carrots
- One basic tractor that can cultivate fields
- A small shop and a few parking spaces
- Simple customer vehicles with fixed paths
- Both in-store and drive-through shopping flows, initially with simple animations
- Four staff roles with basic task logic
- A small set of buildings
- Coins, inventory, wages and sales
- Local saving
- Touch-friendly mobile UI

Defer multiplayer, cloud accounts, complex traffic simulation, advanced seasons, elaborate character animation and large-scale economic systems until the core game is stable.

---

## 12. Instructions for OpenCode

Use this PRD as the product source of truth.

1. Inspect the current repository and summarize its structure.
2. Identify which requirements already exist and which are missing.
3. Create or update `README.md`.
4. Propose an implementation plan for Phase 1 only.
5. Implement Phase 1 in small steps without breaking existing functionality.
6. Run the available build and checks; fix errors.
7. Explain how to run and test the game in plain language.
8. Do not claim a feature works unless it has been implemented and tested.
9. Once Phase 1 is stable, proceed to Phase 2 and continue in roadmap order.
10. Keep changes committed to Git in small, clearly named milestones.

**Definition of success:** A player can begin with a small farm, grow and sell crops, build facilities, purchase and use tractors, hire staff, serve villagers arriving by vehicle through both in-store and drive-through options, manage money and stock, expand the farm, and save progress—with features introduced in a stable, testable order.
