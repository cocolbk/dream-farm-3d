import * as THREE from 'three';
import './styles.css';
import { buildWorld } from './world/scene';
import { createCameraRig } from './world/cameraRig';
import { buildCropMesh, buildBuildingMesh, buildTractorMesh, buildCustomerVehicleMesh, buildStaffMesh, type CustomerVehicleKind } from './world/factories';
import { buildRoads } from './world/roads';
import { mat } from './world/materials';
import { Balance, CROPS, BUILDINGS, TRACTORS, LAND_TIERS, Palette, emptyCrops, type CropId } from './core/Config';
import { bus } from './core/EventBus';
import { EconomyService } from './economy/economy';
import { InventoryService } from './inventory/inventory';
import { createPlots, plant, water, tickPlot, harvest, till, fertilize, type Plot } from './farming/farming';
import { validatePlacement, type PlacedBuilding } from './buildings/placement';
import { levelOf, upgradeCost, canUpgrade, storageCap, staffCap, customerCap, coopIncomePerCycle, hasGarage } from './buildings/effects';
import { GOALS, checkGoals, emptyStats, type FarmStats } from './progression/goals';
import { ShopService } from './shop/shop';
import { canBuyTractor, createTractor, driveStep, type TractorInstance } from './vehicles/tractor';import {
  ReservationManager, generateRequest, checkPurchase, orderTotal, spawnCustomer,
  moveAlong, exitWaypoints, mulberry32, type Customer,
} from './customers/customers';
import {
  STAFF_ROLES, createStaffMember, TaskQueue, wagesDue, isAvailable,
  type StaffMember, type StaffRole, type Task,
} from './staff/staff';
import { defaultSave, loadSave, writeSave, clearSave, SAVE_KEY, SAVE_VERSION } from './save/save';
import { toast, confirmDialog } from './ui/hud';
import { initPWA } from './pwa';

initPWA();

// ---------- state ----------
let eco = new EconomyService(Balance.startCoins);
let inv = new InventoryService({ ...Balance.startSeeds });
let shop = new ShopService();
let plots: Plot[] = createPlots(Balance.plots);
let buildings: PlacedBuilding[] = [];
let tractors: TractorInstance[] = [];
let selectedTractorUid: string | null = null;
let tutorialStep = 0;
let tool: string = 'plant';
let selectedCrop: CropId = 'maize';
let buildDefId = 'barn';
let paused = false;
let soundOn = true;
let driving = false;
let followCam = true;
let saveTimer: number | undefined;

// Phase 3 — customer vehicles (transient: never saved, PRD §6)
let customers: Customer[] = [];
const customerMeshes = new Map<string, THREE.Group>();
const customerKinds = new Map<string, CustomerVehicleKind>();
const resv = new ReservationManager();
let rng = mulberry32(Date.now() % 100000);
let spawnTimer = 8; // first visitor arrives soon after game start
let customerSeq = 0;

// Phase 4 — staff roster + task queue + wages (staff persisted, tasks transient)
let staff: StaffMember[] = [];
let taskQueue = new TaskQueue();
let paydayTimer: number = Balance.paydayInterval;
let staffSeq = 0;
let unpaid = false;

// Phase 5 — progression: stats, goals, days, coop income (persisted)
let stats: FarmStats = emptyStats();
let claimed: string[] = [];
let day = 1;
let todayIn = 0;
let todayOut = 0;
let eggTimer = 0;
let dayTimer = 0;

const OBJECTIVES = [
  'Objective 1/5: 🌱 Plant a crop (select Plant, tap a plot)',
  'Objective 2/5: 💧 Water the crop',
  'Objective 3/5: 🧺 Harvest when ready (ready = full plant + READY label)',
  'Objective 4/5: 💰 Sell produce in Storage panel',
  'Objective 5/5: 🏠 Place a building (Build tool → pick → tap ground → confirm)',
  'All done! Try 🚜 Tractors → buy T-20 → Till new plots → 🏪 Shop stock + prices 🎉',
];

// ---------- three setup ----------
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
const { controls } = createCameraRig(canvas);
const camera = (controls as unknown as { object: THREE.Camera }).object as THREE.PerspectiveCamera;
const { interactables } = buildWorld(scene);
buildRoads(scene);

// plot meshes + crop visuals
const plotMeshes: THREE.Mesh[] = [];
const cropGroups = new Map<number, THREE.Group>();
const plotMeshByUuid = new Map<string, number>();
for (const o of interactables) {
  if (o.name.startsWith('plot-')) {
    const idx = Number(o.name.split('-')[1]);
    plotMeshes[idx] = o as THREE.Mesh;
    plotMeshByUuid.set((o as THREE.Mesh).uuid, idx);
  }
}
function refreshPlotVisual(i: number): void {
  const old = cropGroups.get(i);
  if (old) { scene.remove(old); }
  const g = buildCropMesh(plots[i]);
  const m = plotMeshes[i];
  g.position.set(m.position.x, 0.3, m.position.z);
  scene.add(g);
  cropGroups.set(i, g);
  const mesh = plotMeshes[i];
  const occupied = plots[i].state !== 'empty';
  (mesh.material as THREE.MeshLambertMaterial) = mat(
    plots[i].locked ? 0x9aa0a6
    : occupied ? Palette.soilDry : plots[i].tilled ? Palette.soilTilled : Palette.grassDark,
  );
}
plots.forEach((_, i) => refreshPlotVisual(i));

// buildings group + ghost
const buildingGroup = new THREE.Group();
scene.add(buildingGroup);
function renderBuilding(b: PlacedBuilding): void {
  const g = buildBuildingMesh(b.defId);
  g.position.set(b.x, 0, b.z);
  g.userData.buildingId = b.id;
  buildingGroup.add(g);
}

// tractors
const tractorGroup = new THREE.Group();
scene.add(tractorGroup);
const tractorMeshByUuid = new Map<string, string>(); // mesh uuid -> tractor uid
function renderTractors(): void {
  tractorGroup.clear();
  tractorMeshByUuid.clear();
  for (const t of tractors) {
    const g = buildTractorMesh();
    g.position.set(t.x, 0, t.z);
    g.rotation.y = t.angle;
    // selection ring
    if (t.uid === selectedTractorUid) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.2, 24), mat(Palette.maize));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      g.add(ring);
    }
    g.userData.tractorUid = t.uid;
    g.traverse((o) => { if (o instanceof THREE.Mesh) tractorMeshByUuid.set(o.uuid, t.uid); });
    tractorGroup.add(g);
  }
}
function selectedTractor(): TractorInstance | undefined {
  return tractors.find((t) => t.uid === selectedTractorUid);
}

let ghost: THREE.Group | null = null;
let ghostValid = false;
let ghostPos = new THREE.Vector3(0, 0, 0);
function updateGhost(): void {
  if (ghost) { scene.remove(ghost); ghost = null; }
  if (tool !== 'build') return;
  ghost = buildBuildingMesh(buildDefId);
  ghost.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      (o.material as THREE.Material).transparent = true;
      (o.material as THREE.Material).opacity = 0.6;
    }
  });
  ghost.position.copy(ghostPos);
  scene.add(ghost);
}

// ---------- HUD helpers ----------
const coinsEl = document.getElementById('coins') as HTMLElement;
const seedsQuick = document.getElementById('seeds-quick') as HTMLElement;
const objectiveEl = document.getElementById('objective') as HTMLElement;
const saveDot = document.getElementById('save-dot') as HTMLElement;
const promptEl = document.getElementById('prompt') as HTMLElement;
const joystickEl = document.getElementById('joystick') as HTMLElement;
function refreshHUD(): void {
  coinsEl.textContent = `🪙 ${eco.balance}`;
  seedsQuick.textContent = `🌽${inv.seeds.maize} 🥕${inv.seeds.carrot} 🍅${inv.seeds.tomato} 🌾${inv.seeds.wheat} 🎃${inv.seeds.pumpkin} ✨${inv.fertilizer} | 🧺${inv.totalProduce()}/${storageCap(buildings)} | 🏪${shop.stock.maize + shop.stock.tomato + shop.stock.carrot + shop.stock.wheat + shop.stock.pumpkin} | 🚜${tractors.length} | 🚗${customers.length} | 👥${staff.length}/${staffCap(buildings)} | 📅${day}`;
  objectiveEl.textContent = OBJECTIVES[Math.min(tutorialStep, OBJECTIVES.length - 1)];
}
function showPrompt(msg: string): void {
  promptEl.textContent = msg;
  promptEl.classList.remove('hidden');
  window.clearTimeout((showPrompt as unknown as { t?: number }).t);
  (showPrompt as unknown as { t?: number }).t = window.setTimeout(() => promptEl.classList.add('hidden'), 2200);
}
function beep(ok = true): void {
  if (!soundOn) return;
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.frequency.value = ok ? 660 : 180;
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.08);
    o.onended = () => ctx.close();
  } catch { /* audio unavailable */ }
}
bus.on((e) => {
  if (e.type === 'coins:changed') {
    // Phase 5: lifetime + daily P/L tracking (harvest 0-touchpoints add nothing)
    if (e.delta > 0) { stats.earned += e.delta; todayIn += e.delta; }
    if (e.delta < 0) { todayOut += -e.delta; }
    refreshHUD();
    scheduleSave();
  }
  if (e.type === 'crop:harvested' || e.type === 'sale:completed' || e.type === 'building:placed') {
    refreshHUD();
    scheduleSave();
  }
  if (e.type === 'sale:completed') {
    stats.sales += 1;
    awardGoals();
  }
  if (e.type === 'toast') toast(e.msg);
});

/** Check + pay achievement rewards (idempotent via claimed[]). */
function awardGoals(): void {
  const unlockedPlots = plots.filter((p) => !p.locked).length;
  const fresh = checkGoals({ stats, claimed, staffCount: staff.length, unlockedPlots });
  for (const g of fresh) {
    claimed.push(g.id);
    eco.transact(g.reward, `achievement ${g.id}`);
    toast(`🏆 ${g.name}! +${g.reward}🪙 — ${g.desc}`);
    beep(true);
  }
  if (fresh.length > 0) {
    refreshHUD();
    scheduleSave();
  }
}

// ---------- save ----------
function collectSave() {
  return {
    version: SAVE_VERSION, coins: eco.balance, seeds: { ...inv.seeds }, produce: { ...inv.produce },
    plots, buildings, tractors, selectedTractorUid,
    shopStock: { ...shop.stock }, prices: { ...shop.prices },
    staff: staff.map((m) => ({ ...m, state: 'idle' as const, taskLabel: null, current: null, busyLeft: 0 })),
    paydayTimer,
    fertilizer: inv.fertilizer,
    stats: { ...stats }, claimed: [...claimed],
    day, todayIn, todayOut,
    tutorialStep, timestamp: Date.now(),
  };
}
function scheduleSave(): void {
  saveDot.style.color = '#FF9800';
  saveDot.title = 'saving…';
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    writeSave(localStorage, collectSave());
    saveDot.style.color = '#4CAF50';
    saveDot.title = 'saved';
    bus.emit({ type: 'save:written' });
    (document.getElementById('save-status') as HTMLElement).textContent = `Save: ${new Date().toLocaleTimeString()}`;
  }, 1500);
}
function applySave(data: ReturnType<typeof loadSave>): void {
  if (!data) return;
  eco = new EconomyService(data.coins);
  inv = new InventoryService(data.seeds);
  inv.produce = { ...data.produce };
  plots = data.plots.length === Balance.plots ? data.plots : createPlots(Balance.plots);
  buildings = data.buildings;
  tractors = data.tractors;
  selectedTractorUid = data.selectedTractorUid;
  inv.fertilizer = data.fertilizer;
  shop = new ShopService();
  shop.stock = { ...data.shopStock };
  shop.prices = { ...data.prices };
  tutorialStep = data.tutorialStep;
  buildingGroup.clear();
  buildings.forEach(renderBuilding);
  renderTractors();
  clearCustomers(); // vehicles are transient — never restored from save (§6)
  staff = data.staff;
  staffSeq = staff.reduce((a, m) => Math.max(a, Number(m.uid.slice(1)) || 0), 0);
  paydayTimer = data.paydayTimer;
  unpaid = false;
  taskQueue = new TaskQueue(); // in-flight tasks never restored — customers re-queue fresh
  renderStaff();
  stats = { ...data.stats };
  claimed = [...data.claimed];
  day = data.day;
  todayIn = data.todayIn;
  todayOut = data.todayOut;
  eggTimer = 0;
  dayTimer = 0;
  plots.forEach((_, i) => refreshPlotVisual(i));
  refreshHUD();
}

// ---------- panels ----------
const panel = document.getElementById('panel') as HTMLElement;
const panelTitle = document.getElementById('panel-title') as HTMLElement;
const panelBody = document.getElementById('panel-body') as HTMLElement;
(document.getElementById('panel-close') as HTMLButtonElement).onclick = () => panel.classList.add('hidden');
function openPanel(title: string, html: string): void {
  panelTitle.textContent = title;
  panelBody.innerHTML = html;
  panel.classList.remove('hidden');
}
function openSeedShop(): void {
  const rows = (Object.keys(CROPS) as CropId[]).map((id) => {
    const c = CROPS[id];
    return `<div class="row"><span>🌱 ${c.name} — ${c.seedPrice}🪙 (have ${inv.seeds[id]})</span><button class="btn small" data-buy="${id}">Buy</button></div>`;
  }).join('');
  openPanel('Seed Shop', rows + `<div class="row"><span>✨ Fertilizer — ${Balance.fertilizerPrice}🪙 (have ${inv.fertilizer})<br><small>x${Balance.fertilizerBoost} growth, one crop</small></span><button class="btn small" id="buy-fert">Buy</button></div><div class="row"><span>Balance: 🪙 ${eco.balance}</span></div>`);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.buy as CropId;
      const price = CROPS[id].seedPrice;
      if (price >= Balance.confirmThreshold && !(await confirmDialog(`Buy ${id} seed for ${price} coins?`))) return;
      const r = eco.transact(-price, `seed ${id}`);
      if (!r.ok) { toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
      inv.seeds[id] += 1;
      beep(true);
      toast(`Bought 1 ${id} seed`);
      refreshHUD();
      openSeedShop();
    };
  });
  (panelBody.querySelector('#buy-fert') as HTMLButtonElement).onclick = () => {
    const r = eco.transact(-Balance.fertilizerPrice, 'fertilizer');
    if (!r.ok) { toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
    inv.fertilizer += 1;
    beep(true);
    toast('Bought 1 ✨ fertilizer (use Boost tool)');
    refreshHUD();
    openSeedShop();
  };
}
function openStorage(): void {
  const rows = (Object.keys(CROPS) as CropId[]).map((id) => {
    const c = CROPS[id];
    return `<div class="row"><span>${c.name}: storage ${inv.produce[id]} → shop ${shop.stock[id]}</span><span><button class="btn small" data-move="${id}">Move 1</button> <button class="btn small" data-sell="${id}">Sell 1 @${c.sellBase}</button></span></div>`;
  }).join('');
  openPanel('Farm Storage', rows + `<div class="row"><button class="btn small" id="move-all">Move ALL to shop</button><button class="btn small" id="sell-all">Sell ALL @base</button></div>`);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((b) => {
    b.onclick = () => transferToShop(b.dataset.move as CropId, 1);
  });
  panelBody.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((b) => {
    b.onclick = () => sellProduce(b.dataset.sell as CropId, 1);
  });
  (panelBody.querySelector('#move-all') as HTMLButtonElement).onclick = () => {
    (Object.keys(CROPS) as CropId[]).forEach((id) => {
      if (inv.produce[id] > 0) transferToShop(id, inv.produce[id]);
    });
  };
  (panelBody.querySelector('#sell-all') as HTMLButtonElement).onclick = () => {
    (Object.keys(CROPS) as CropId[]).forEach((id) => {
      if (inv.produce[id] > 0) sellProduce(id, inv.produce[id]);
    });
  };
}
function transferToShop(id: CropId, qty: number): void {
  const r = inv.takeProduce(id, qty);
  if (!r.ok) { toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
  shop.addStock(id, qty);
  beep(true);
  toast(`Moved ${qty} ${id} → shop stock`);
  refreshHUD();
  scheduleSave();
  openStorage();
}
function sellProduce(id: CropId, qty: number): void {
  const r = inv.takeProduce(id, qty);
  if (!r.ok) { toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
  const revenue = qty * CROPS[id].sellBase;
  eco.transact(revenue, `sale ${id}x${qty}`);
  beep(true);
  toast(`Sold ${qty} ${id} +${revenue}🪙`);
  bus.emit({ type: 'sale:completed', qty, revenue });
  if (tutorialStep === 3) { tutorialStep = 4; }
  refreshHUD();
  openStorage();
}
function openFarmShop(): void {
  const rows = (Object.keys(CROPS) as CropId[]).map((id) => {
    const c = CROPS[id];
    return `<div class="row"><span>${c.name}: stock ${shop.stock[id]}</span><span class="price-ctl"><button class="btn small" data-dec="${id}">−</button><strong>${shop.prices[id]}🪙</strong><button class="btn small" data-inc="${id}">+</button> <button class="btn small" data-shopsell="${id}">Sell 1</button></span></div><div class="row"><small>range ${c.minPrice}–${c.maxPrice}</small></div>`;
  }).join('');
  const recent = shop.recentSales.slice(0, 5).map((s) =>
    `<div class="row"><span>${s.qty}x ${s.crop}</span><span>+${s.revenue}🪙</span></div>`,
  ).join('') || '<p>No sales yet — transfer stock, set price, sell.</p>';
  openPanel('Farm Shop', rows + `<h4>Recent sales</h4>` + recent);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-dec]').forEach((b) => {
    b.onclick = () => { shop.setPrice(b.dataset.dec as CropId, shop.prices[b.dataset.dec as CropId] - 1); openFarmShop(); scheduleSave(); };
  });
  panelBody.querySelectorAll<HTMLButtonElement>('[data-inc]').forEach((b) => {
    b.onclick = () => { shop.setPrice(b.dataset.inc as CropId, shop.prices[b.dataset.inc as CropId] + 1); openFarmShop(); scheduleSave(); };
  });
  panelBody.querySelectorAll<HTMLButtonElement>('[data-shopsell]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.shopsell as CropId;
      const s = shop.commitSale(id, 1);
      if (!s.ok) { toast(s.reason ?? 'Blocked', 'error'); beep(false); return; }
      eco.transact(s.revenue!, `shop sale ${id}x1 @${shop.prices[id]}`);
      beep(true);
      toast(`Shop sale: 1 ${id} +${s.revenue}🪙`);
      bus.emit({ type: 'sale:completed', qty: 1, revenue: s.revenue! });
      refreshHUD();
      openFarmShop();
    };
  });
}
function openDealership(): void {
  const rows = Object.values(TRACTORS).map((d) => {
    const owned = tractors.filter((t) => t.defId === d.id).length;
    const locked = d.id === 't50' && !hasGarage(buildings);
    return `<div class="row"><span>🚜 ${d.name}<br><small>${d.capability} · speed ${d.speed} · owned ${owned}</small></span><span><strong>${d.price}🪙</strong> <button class="btn small" data-buy-t="${d.id}"${locked ? ' disabled' : ''}>${locked ? 'Need garage' : 'Buy'}</button></span></div>`;
  }).join('');
  const list = tractors.map((t) =>
    `<div class="row"><span>🚜 ${TRACTORS[t.defId].name} @(${Math.round(t.x)},${Math.round(t.z)})${t.uid === selectedTractorUid ? ' ✓' : ''}</span><button class="btn small" data-sel="${t.uid}">Select</button></div>`,
  ).join('') || '<p>No tractors yet — buy one to till new plots.</p>';
  openPanel('Tractor Dealership', rows + `<h4>Garage</h4>` + list);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-buy-t]').forEach((b) => {
    b.onclick = async () => {
      const defId = b.dataset.buyT!;
      const def = TRACTORS[defId];
      const chk = canBuyTractor(defId, eco.balance, tractors, hasGarage(buildings));
      if (!chk.ok) { toast(chk.reason ?? 'Blocked', 'error'); beep(false); return; }
      if (!(await confirmDialog(`Buy ${def.name} for ${def.price} coins?`))) return;
      const r = eco.transact(-def.price, `tractor ${defId}`);
      if (!r.ok) { toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
      const t = createTractor(defId, 12, 4 + tractors.length * 3);
      tractors.push(t);
      selectedTractorUid = t.uid;
      renderTractors();
      beep(true);
      toast(`${def.name} purchased! Use 🚜 Till on untilled plots.`);
      refreshHUD();
      scheduleSave();
      openDealership();
    };
  });
  panelBody.querySelectorAll<HTMLButtonElement>('[data-sel]').forEach((b) => {
    b.onclick = () => {
      selectedTractorUid = b.dataset.sel!;
      renderTractors();
      refreshHUD();
      scheduleSave();
      openDealership();
    };
  });
}
// ---------- Phase 3: customer vehicles ----------
const KIND_ICON: Record<CustomerVehicleKind, string> = { car: '🚗', van: '🚐', pickup: '🛻' };

function renderCustomerMesh(c: Customer): void {
  const old = customerMeshes.get(c.id);
  if (old) scene.remove(old);
  const kind = customerKinds.get(c.id) ?? 'car';
  const g = buildCustomerVehicleMesh(kind);
  g.position.set(c.x, 0, c.z);
  g.userData.customerId = c.id;
  scene.add(g);
  customerMeshes.set(c.id, g);
}

function removeCustomerMesh(id: string): void {
  const m = customerMeshes.get(id);
  if (m) scene.remove(m);
  customerMeshes.delete(id);
  customerKinds.delete(id);
}

function faceDirection(c: Customer): void {
  const m = customerMeshes.get(c.id);
  const wp = c.waypoints[c.wpIndex];
  if (!m || !wp) return;
  m.rotation.y = Math.atan2(wp.x - c.x, wp.z - c.z);
}

/** Atomic checkout shared by in-store auto-serve, drive-through handoff and tests. */
function checkoutCustomer(c: Customer): boolean {
  const chk = checkPurchase(c.items, c.budget, shop.stock, shop.prices);
  if (!chk.ok) {
    c.reason = chk.reason ?? 'Blocked';
    return false;
  }
  for (const it of c.items) {
    const s = shop.commitSale(it.crop, it.qty);
    if (!s.ok) { c.reason = s.reason ?? 'Blocked'; return false; } // stock changed mid-commit
  }
  eco.transact(chk.total!, `shop sale ${c.mode} ${c.id}`);
  if (c.wait < 15) stats.happyServes += 1; // ★★★ fast serve (patience)
  bus.emit({ type: 'sale:completed', qty: c.items.reduce((a, it) => a + it.qty, 0), revenue: chk.total! });
  beep(true);
  toast(`${KIND_ICON[customerKinds.get(c.id) ?? 'car']} ${c.mode === 'instore' ? 'In-store' : 'Drive-through'} sale +${chk.total}🪙`);
  return true;
}

function releaseSlot(c: Customer): void {
  if (c.slot < 0) return;
  if (c.mode === 'instore') resv.releaseBay(c.slot);
  else resv.releaseQueue(c.slot);
  c.slot = -1;
}

function sendLeaving(c: Customer, reason: string): void {
  c.reason = reason;
  c.state = 'leaving';
  c.waypoints = exitWaypoints();
  c.wpIndex = 0;
  releaseSlot(c); // free the slot before the exit drive (reserved before moving, §6)
  // Phase 4: drop queued tasks + free any staffer holding this customer (no phantom work)
  taskQueue.removeForCustomer(c.id);
  for (const m of staff) {
    if (m.state === 'busy' && m.current?.customerId === c.id) {
      m.state = 'idle';
      m.current = null;
      m.taskLabel = null;
      m.busyLeft = 0;
    }
  }
}

// ---------- Phase 4: staff visuals, task execution, wages ----------
const staffGroup = new THREE.Group();
scene.add(staffGroup);

/** Fixed posts ringed around the service hut — deterministic, no persistence needed. */
function staffPost(i: number): { x: number; z: number } {
  const a = i * 2.4;
  return { x: 0.5 + Math.cos(a) * 3.2, z: 3.5 + Math.sin(a) * 3.2 };
}

function renderStaff(): void {
  staffGroup.clear();
  staff.forEach((m, i) => {
    const g = buildStaffMesh(STAFF_ROLES[m.role].color);
    const p = staffPost(i);
    g.position.set(p.x, 0, p.z);
    g.userData.staffUid = m.uid;
    staffGroup.add(g);
  });
}

function findCustomer(id: string | undefined): Customer | undefined {
  if (!id) return undefined;
  return customers.find((c) => c.id === id);
}

function taskLabelFor(kind: Task['kind'], c: Customer | undefined): string {
  if (kind === 'restock') return 'Restocking shelves';
  if (!c) return kind;
  if (kind === 'collect') return `Collecting ${c.id}`;
  if (kind === 'checkout') return `Checking out ${c.id}`;
  return `Serving ${c.id} (drive)`;
}

function completeTask(m: StaffMember): void {
  const task = m.current;
  m.state = 'idle';
  m.current = null;
  m.taskLabel = null;
  m.busyLeft = 0;
  if (!task) return;
  if (task.kind === 'collect') {
    const c = findCustomer(task.customerId);
    // guard: customer may have left or been served by the owner meanwhile
    if (c && c.state === 'shopping' && c.serveStage === 'collecting') {
      c.serveStage = 'readyCheckout';
      c.reason = 'Order collected — waiting for cashier';
    }
  } else if (task.kind === 'checkout') {
    const c = findCustomer(task.customerId);
    if (c && c.state === 'shopping' && c.serveStage === 'checking') {
      if (checkoutCustomer(c)) sendLeaving(c, 'Served — thank you!');
      else { c.serveStage = 'readyCheckout'; } // stock/budget changed: re-queue next tick
    }
  } else if (task.kind === 'driveOrder') {
    const c = findCustomer(task.customerId);
    if (c && c.state === 'ordering' && c.serveStage === 'driving') {
      if (checkoutCustomer(c)) sendLeaving(c, 'Served — thank you!');
      else { c.serveStage = 'driveQueued'; }
    }
  } else if (task.kind === 'restock' && task.crop) {
    const qty = Math.min(task.qty ?? Balance.restockQty, inv.produce[task.crop]);
    if (qty > 0) {
      inv.takeProduce(task.crop, qty);
      shop.addStock(task.crop, qty);
      toast(`📦 Restocked ${qty}x ${task.crop} to shop`);
      scheduleSave();
    }
  }
  refreshHUD();
}

function maybeAssignRestock(m: StaffMember): boolean {
  const need = (Object.keys(CROPS) as CropId[]).find(
    (crop) => shop.stock[crop] < Balance.restockThreshold && inv.produce[crop] > 0,
  );
  if (!need) return false;
  const qty = Math.min(Balance.restockQty, inv.produce[need]);
  m.state = 'busy';
  m.busyLeft = Balance.restockTime;
  m.current = { id: `r${Date.now()}${m.uid}`, kind: 'restock', crop: need, qty, duration: Balance.restockTime };
  m.taskLabel = `Restocking ${qty}x ${need}`;
  return true;
}

let lastPaydayShown = -1;
/** Phase 5 farm tick: coop payouts + day rollover for P/L summaries. */
function farmTick(dt: number): void {
  eggTimer += dt;
  if (eggTimer >= Balance.eggCycle) {
    eggTimer = 0;
    const income = coopIncomePerCycle(buildings);
    if (income > 0) {
      eco.transact(income, 'coop eggs');
      toast(`🐔 Coops laid eggs +${income}🪙`);
    }
  }
  dayTimer += dt;
  if (dayTimer >= Balance.dayLength) {
    dayTimer = 0;
    day += 1;
    const net = todayIn - todayOut;
    toast(`📅 Day ${day} — yesterday ${net >= 0 ? '+' : ''}${net}🪙 (in ${todayIn} / out ${todayOut})`);
    todayIn = 0;
    todayOut = 0;
    scheduleSave();
  }
}
function staffTick(dt: number): void {
  // payday (PRD §4.8: clearly communicated interval, never silent)
  paydayTimer -= dt;
  if (paydayTimer <= 0) {
    paydayTimer = Balance.paydayInterval;
    if (staff.length > 0 || buildings.length > 0) {
      const due = wagesDue(staff);
      const maint = buildings.length * Balance.maintenancePerBuilding;
      const total = due + maint;
      const r = eco.transact(-total, `wages ${staff.length} staff + maintenance`);
      if (r.ok) {
        unpaid = false;
        toast(`💰 Payday: -${due}🪙 wages${maint > 0 ? ` -${maint}🪙 upkeep (${buildings.length} bldg)` : ''}`);
        beep(true);
      } else {
        unpaid = true; // staff idle until next payday — no silent work (§6)
        toast(`Can't pay ${total}🪙 payday — staff idle until next payday`, 'error');
        beep(false);
      }
    }
  }
  // assign idle staff by priority: drive orders > checkout > collect, restock last
  if (!unpaid) {
    for (const m of staff) {
      if (!isAvailable(m, unpaid)) continue;
      if (m.role === 'stock') {
        if (maybeAssignRestock(m)) continue;
      } else {
        const kind = m.role === 'attendant' ? 'collect' : m.role === 'cashier' ? 'checkout' : 'driveOrder';
        const task = taskQueue.claim(kind);
        if (task) {
          const c = findCustomer(task.customerId);
          // claim only if the customer still needs it; else drop and stay idle
          const valid = c && (
            (kind === 'collect' && c.state === 'shopping' && c.serveStage === 'collectQueued') ||
            (kind === 'checkout' && c.state === 'shopping' && c.serveStage === 'checkoutQueued') ||
            (kind === 'driveOrder' && c.state === 'ordering' && c.serveStage === 'driveQueued')
          );
          if (!valid) continue;
          m.state = 'busy';
          m.current = task;
          m.busyLeft = task.duration;
          m.taskLabel = taskLabelFor(kind, c);
          if (kind === 'collect') c!.serveStage = 'collecting';
          if (kind === 'checkout') c!.serveStage = 'checking';
          if (kind === 'driveOrder') c!.serveStage = 'driving';
        }
      }
    }
  }
  // progress busy staff
  for (const m of staff) {
    if (m.state !== 'busy' || !m.current) continue;
    m.busyLeft -= dt;
    if (m.busyLeft <= 0) completeTask(m);
  }
  const whole = Math.ceil(paydayTimer);
  if (whole !== lastPaydayShown) {
    lastPaydayShown = whole;
    if (panelTitle.textContent === 'Staff') openStaff();
  }
}

function spawnTick(dt: number): void {
  spawnTimer -= dt;
  if (spawnTimer > 0) return;
  spawnTimer = Balance.spawnMin + rng() * (Balance.spawnMax - Balance.spawnMin);
  const active = customers.filter((c) => c.state !== 'gone').length;
  if (active >= customerCap(buildings)) return;
  const mode = rng() < 0.5 ? 'instore' : 'drive';
  const slot = mode === 'instore' ? resv.reserveBay() : resv.reserveQueue();
  if (slot === -1) return; // no parking/queue capacity — vehicle doesn't enter (§6)
  customerSeq += 1;
  const id = `v${customerSeq}`;
  const kinds: CustomerVehicleKind[] = ['car', 'van', 'pickup'];
  customerKinds.set(id, kinds[Math.floor(rng() * kinds.length)]);
  const req = generateRequest(rng, shop.stock, shop.prices);
  const c = spawnCustomer(id, mode, slot, req);
  c.state = 'toSlot';
  c.reason = mode === 'instore' ? 'Arriving — finding parking' : 'Arriving — joining queue';
  customers.push(c);
  renderCustomerMesh(c);
  refreshHUD();
}

/** 10Hz sim-tick portion: spawns + wait timers + checkout attempts. */
function customersTick(dt: number): void {
  spawnTick(dt);
  let panelDirty = false;
  for (const c of customers) {
    if (c.state === 'parked' || c.state === 'shopping' || c.state === 'queued' || c.state === 'ordering') {
      c.wait += dt;
      if (c.state === 'parked' && c.wait >= Balance.shopWait) {
        c.state = 'shopping';
        c.reason = 'Shopping…';
      }
      if (c.state === 'shopping') {
        // Phase 4 pipeline: attendant collects -> cashier checks out (owner Serve = backup)
        if (c.serveStage === 'none') {
          taskQueue.enqueue('collect', Balance.collectTime, { customerId: c.id });
          c.serveStage = 'collectQueued';
          c.reason = 'Shopping — waiting for shop attendant';
        } else if (c.serveStage === 'readyCheckout') {
          taskQueue.enqueue('checkout', Balance.checkoutTime, { customerId: c.id });
          c.serveStage = 'checkoutQueued';
          c.reason = 'Ready — waiting for cashier';
        }
        if (c.wait >= Balance.serveTimeout) {
          sendLeaving(c, `Left: ${c.reason}`);
          toast(`Customer left: ${c.reason}`, 'error');
        }
        panelDirty = true;
      }
      if (c.state === 'queued') {
        c.state = 'ordering';
        c.reason = 'Ordering — Serve in 🚗 panel';
        panelDirty = true;
      }
      if (c.state === 'ordering') {
        if (c.serveStage === 'none') {
          taskQueue.enqueue('driveOrder', Balance.driveServeTime, { customerId: c.id });
          c.serveStage = 'driveQueued';
          c.reason = 'Ordering — waiting for drive attendant (or Serve)';
        }
        if (c.wait >= Balance.driveAutoServe) {
          // owner-help fallback so the lane never jams without staff
          if (c.serveStage === 'driveQueued') taskQueue.removeForCustomer(c.id);
          if (checkoutCustomer(c)) sendLeaving(c, 'Served — thank you!');
          else {
            c.serveStage = 'none'; // re-queue for the attendant next tick; owner retries too
            if (c.wait >= Balance.serveTimeout) {
              sendLeaving(c, `Left: ${c.reason}`);
              toast(`Drive-through left: ${c.reason}`, 'error');
            }
          }
          panelDirty = true;
        } else if (c.wait >= Balance.serveTimeout) {
          sendLeaving(c, `Left: waited too long`);
          panelDirty = true;
        }
      }
    }
  }
  if (panelDirty) {
    refreshHUD();
    if (panelTitle.textContent === 'Customers & Queue') openCustomers();
  }
}

/** Frame-rate portion: smooth vehicle movement + arrival transitions. */
function customersFrame(dt: number): void {
  for (const c of customers) {
    if (c.state === 'toSlot' || c.state === 'leaving') {
      faceDirection(c);
      if (moveAlong(c, dt)) {
        const m = customerMeshes.get(c.id);
        if (c.state === 'toSlot') {
          if (c.mode === 'instore') {
            c.state = 'parked';
            c.reason = 'Parked — shopping';
          } else {
            c.state = 'queued';
            c.reason = 'In queue';
          }
          c.wait = 0;
          if (panelTitle.textContent === 'Customers & Queue') openCustomers();
        } else {
          c.state = 'gone';
          removeCustomerMesh(c.id);
        }
        refreshHUD();
        void m;
      } else {
        const m = customerMeshes.get(c.id);
        if (m) m.position.set(c.x, 0, c.z);
      }
    }
  }
  customers = customers.filter((c) => c.state !== 'gone');
}

function stateBadge(c: Customer): string {
  const cls = c.state === 'leaving' || c.state === 'gone' ? 'out'
    : c.state === 'shopping' || c.state === 'ordering' ? 'wait' : '';
  const label = c.state === 'toSlot' ? 'arriving' : c.state;
  return `<span class="state ${cls}">● ${label}</span>`;
}

function openCustomers(): void {
  const queued = customers.filter((c) => c.mode === 'drive' && c.state !== 'leaving' && c.state !== 'gone').length;
  const parked = resv.bays.filter(Boolean).length;
  let html = `<div class="row"><span>🅿️ Parking ${parked}/${Balance.parkingBays} · 🚗 Queue ${queued}/${Balance.driveQueueSlots}</span></div>`;
  const onDuty = (r: StaffRole) => staff.filter((m) => m.role === r && !unpaid).length;
  html += `<div class="row"><small>On duty: 🧑‍🌾x${onDuty('attendant')} 🧾x${onDuty('cashier')} 📦x${onDuty('stock')} 🍔x${onDuty('drive')}${unpaid ? ' · UNPAID — idle' : ''} — owner Serve works as backup</small></div>`;
  if (customers.length === 0) html += '<p>No visitors yet — stock the 🏪 shop and they will come.</p>';
  for (const c of customers) {
    const total = orderTotal(c.items, shop.prices);
    const list = c.items.map((it) => `${it.qty}x ${it.crop}`).join(', ');
    const stars = c.state === 'served' || c.state === 'leaving' ? '' : c.wait < 15 ? ' ★★★' : c.wait < 30 ? ' ★★' : ' ★';
    const canServe = c.state === 'shopping' || c.state === 'ordering' || c.state === 'parked' || c.state === 'queued';
    html += `<div class="row"><span>${KIND_ICON[customerKinds.get(c.id) ?? 'car']} ${c.mode === 'instore' ? '🏪' : '🚗'} ${list} = ${total}🪙 (budget ${c.budget})${stars}<br><small>${c.reason}</small></span><span>${stateBadge(c)}${canServe ? ` <button class="btn small" data-serve="${c.id}">Serve</button>` : ''}</span></div>`;
  }
  openPanel('Customers & Queue', html);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-serve]').forEach((b) => {
    b.onclick = () => serveCustomer(b.dataset.serve!);
  });
}

/** Player handoff for drive-through orders (Phase 4 staff will call the same path). */
function serveCustomer(id: string): void {
  const c = customers.find((x) => x.id === id);
  if (!c) return;
  if (c.state === 'leaving' || c.state === 'gone' || c.state === 'served') {
    toast('Already on the way out', 'error');
    return;
  }
  if (checkoutCustomer(c)) {
    sendLeaving(c, 'Served — thank you!');
  } else {
    toast(c.reason, 'error');
    beep(false);
  }
  refreshHUD();
  openCustomers();
}

function clearCustomers(): void {
  for (const c of customers) removeCustomerMesh(c.id);
  customers = [];
  customerKinds.clear();
  resv.bays.fill(false);
  resv.queue.fill(false);
  spawnTimer = 8;
}

function categoryOf(reason: string): string {
  if (reason.startsWith('sale') || reason.startsWith('shop sale')) return 'Sales';
  if (reason.startsWith('seed')) return 'Seeds';
  if (reason.startsWith('build')) return 'Building';
  if (reason.startsWith('tractor')) return 'Machinery';
  if (reason.startsWith('harvest')) return 'Harvest';
  if (reason.startsWith('wages')) return 'Wages';
  if (reason.startsWith('hire')) return 'Staff';
  if (reason.startsWith('upgrade') || reason.startsWith('land')) return 'Expansion';
  if (reason.startsWith('coop')) return 'Coops';
  if (reason.startsWith('achievement')) return 'Goals';
  return 'Other';
}
function openLedger(): void {
  const totals = new Map<string, number>();
  for (const l of eco.ledger) totals.set(categoryOf(l.reason), (totals.get(categoryOf(l.reason)) ?? 0) + l.delta);
  const sum = [...totals.entries()].map(([k, v]) => `<div class="row"><span>${k}</span><span>${v >= 0 ? '+' : ''}${v}</span></div>`).join('') || '<p>No transactions yet.</p>';
  const rows = eco.ledger.slice(-15).reverse().map((l) =>
    `<div class="row"><span>${l.reason}</span><span>${l.delta >= 0 ? '+' : ''}${l.delta} → ${l.balance}</span></div>`,
  ).join('');
  openPanel('Finances', `<div class="row"><strong>Balance: 🪙 ${eco.balance}</strong></div><div class="row"><span>📅 Day ${day} — today ${todayIn - todayOut >= 0 ? '+' : ''}${todayIn - todayOut}🪙 (in ${todayIn} / out ${todayOut})</span></div><h4>By category</h4>` + sum + `<h4>Recent</h4>` + rows);
}
function openStaff(): void {
  const due = wagesDue(staff);
  let html = `<div class="row"><span>💰 Payday in ${Math.ceil(paydayTimer)}s — due ${due}🪙${unpaid ? ' · <strong>UNPAID (idle)</strong>' : ''}</span></div>`;
  html += `<div class="row"><span>Tasks queued: collect ${taskQueue.pending('collect')} · checkout ${taskQueue.pending('checkout')} · drive ${taskQueue.pending('driveOrder')}</span></div>`;
  html += `<h4>Hire</h4>`;
  for (const def of Object.values(STAFF_ROLES)) {
    const n = staff.filter((m) => m.role === def.role).length;
    html += `<div class="row"><span>${def.icon} ${def.name} (x${n})<br><small>${def.duty} · hire ${def.hire}🪙 · wage ${def.wage}🪙/payday</small></span><button class="btn small" data-hire="${def.role}">Hire</button></div>`;
  }
  html += `<h4>Roster</h4>`;
  if (staff.length === 0) html += '<p>No staff yet — hire help to serve customers automatically.</p>';
  for (const m of staff) {
    const def = STAFF_ROLES[m.role];
    const status = unpaid ? 'UNPAID — idle' : m.state === 'busy' ? `busy: ${m.taskLabel}` : 'idle';
    html += `<div class="row"><span>${def.icon} ${def.name}<br><small>${status}</small></span><button class="btn small" data-fire="${m.uid}">Dismiss</button></div>`;
  }
  openPanel('Staff', html);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-hire]').forEach((b) => {
    b.onclick = () => hireStaff(b.dataset.hire as StaffRole);
  });
  panelBody.querySelectorAll<HTMLButtonElement>('[data-fire]').forEach((b) => {
    b.onclick = () => dismissStaff(b.dataset.fire!);
  });
}

async function hireStaff(role: StaffRole): Promise<void> {
  const def = STAFF_ROLES[role];
  if (staff.length >= staffCap(buildings)) {
    toast(`Staff full (${staffCap(buildings)}) — build staff quarters`, 'error');
    beep(false);
    return;
  }
  if (eco.balance < def.hire) { toast(`Not enough coins (need ${def.hire}🪙)`, 'error'); beep(false); return; }
  if (def.hire >= Balance.confirmThreshold && !(await confirmDialog(`Hire ${def.name} for ${def.hire} coins? (+${def.wage}🪙/payday)`))) return;
  const r = eco.transact(-def.hire, `hire ${role}`);
  if (!r.ok) { toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
  staffSeq += 1;
  staff.push(createStaffMember(role, staffSeq));
  renderStaff();
  beep(true);
  toast(`${def.icon} ${def.name} hired!`);
  refreshHUD();
  scheduleSave();
  awardGoals();
  openStaff();
}

function dismissStaff(uid: string): void {
  const i = staff.findIndex((m) => m.uid === uid);
  if (i === -1) return;
  const [m] = staff.splice(i, 1);
  // unstick any customer left mid-task: tick re-queues from a clean stage
  if (m.current?.customerId) {
    const c = findCustomer(m.current.customerId);
    if (c && (c.state === 'shopping' || c.state === 'ordering')) {
      if (m.current.kind === 'collect') c.serveStage = 'none';
      if (m.current.kind === 'checkout') c.serveStage = 'readyCheckout';
      if (m.current.kind === 'driveOrder') c.serveStage = 'none';
    }
  }
  renderStaff();
  toast('Staff member dismissed');
  refreshHUD();
  scheduleSave();
  openStaff();
}

function openLand(): void {
  let html = `<div class="row"><span>Open plots: ${plots.filter((p) => !p.locked).length}/${plots.length} · Storage cap: ${storageCap(buildings)} · Staff cap: ${staffCap(buildings)}</span></div>`;
  html += `<h4>Land tiers</h4>`;
  for (const tier of LAND_TIERS) {
    const owned = tier.plots.every((i) => !plots[i]?.locked);
    html += `<div class="row"><span>🗺️ ${tier.name} — ${tier.cost}🪙</span><button class="btn small" data-tier="${tier.id}"${owned ? ' disabled' : ''}>${owned ? 'Owned' : 'Unlock'}</button></div>`;
  }
  html += `<h4>Special buildings</h4>`;
  for (const id of ['warehouse', 'quarters', 'coop', 'garage']) {
    const d = BUILDINGS[id];
    const n = buildings.filter((b) => b.defId === id).length;
    html += `<div class="row"><span>${d.name} (x${n}) — ${d.cost}🪙<br><small>${d.desc}</small></span><button class="btn small" data-bland="${id}">Build…</button></div>`;
  }
  openPanel('Land & Expansion', html);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-tier]').forEach((b) => {
    b.onclick = async () => {
      const tier = LAND_TIERS.find((t) => t.id === b.dataset.tier)!;
      if (!(await confirmDialog(`Unlock ${tier.name} for ${tier.cost} coins?`))) return;
      const r = eco.transact(-tier.cost, `land ${tier.id}`);
      if (!r.ok) { toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
      for (const i of tier.plots) {
        if (plots[i]) { plots[i].locked = false; refreshPlotVisual(i); }
      }
      beep(true);
      toast(`🗺️ ${tier.name} unlocked! Till new plots with 🚜`);
      refreshHUD();
      scheduleSave();
      awardGoals();
      openLand();
    };
  });
  panelBody.querySelectorAll<HTMLButtonElement>('[data-bland]').forEach((b) => {
    b.onclick = () => {
      buildDefId = b.dataset.bland!;
      tool = 'build';
      syncToolUI();
      updateGhost();
      panel.classList.add('hidden');
      toast(`Placing ${buildDefId} — tap open ground`);
    };
  });
}

function openGoals(): void {
  const unlockedPlots = plots.filter((p) => !p.locked).length;
  const net = todayIn - todayOut;
  let html = `<div class="row"><span>📅 Day ${day} · Today ${net >= 0 ? '+' : ''}${net}🪙 (in ${todayIn} / out ${todayOut})</span></div>`;
  html += `<div class="row"><small>Earned ${stats.earned} · sales ${stats.sales} · ★★★ serves ${stats.happyServes} · harvests ${stats.harvests} · plots ${unlockedPlots}/12 · staff ${staff.length}/${staffCap(buildings)} · storage ${inv.totalProduce()}/${storageCap(buildings)}</small></div>`;
  html += `<h4>Achievements</h4>`;
  for (const g of GOALS) {
    const done = claimed.includes(g.id);
    html += `<div class="row"><span>${done ? '✅' : '🔲'} ${g.name} — +${g.reward}🪙<br><small>${g.desc}</small></span></div>`;
  }
  openPanel('Goals & Progress', html);
}

function openBuildingInfo(id: string): void {
  const b = buildings.find((x) => x.id === id);
  if (!b) return;
  const def = BUILDINGS[b.defId];
  const up = canUpgrade(b.defId, b.level ?? 0);
  const cost = upgradeCost(b.defId, b.level ?? 0);
  let effect = def.desc;
  if (b.defId === 'barn') effect += ` (now +${(b.level ?? 0) * Balance.barnCapPerLevel} storage)`;
  if (b.defId === 'shop') effect += ` (now +${b.level ?? 0} customer capacity)`;
  if (b.defId === 'coop') effect += ` (now ${coopIncomePerCycle([b])}🪙/${Balance.eggCycle}s)`;
  openPanel(def.name, `<div class="row"><span>Level ${b.level ?? 0}${def.maxLevel > 0 ? ` / ${def.maxLevel}` : ''}<br><small>${effect}</small></span>${up ? `<button class="btn small" id="upg">Upgrade ${cost}🪙</button>` : '<span>Max / n/a</span>'}</div>`);
  const btn = panelBody.querySelector('#upg') as HTMLButtonElement | null;
  if (btn) {
    btn.onclick = async () => {
      if (!(await confirmDialog(`Upgrade ${def.name} to level ${(b.level ?? 0) + 1} for ${cost} coins?`))) return;
      const r = eco.transact(-cost, `upgrade ${b.defId}`);
      if (!r.ok) { toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
      b.level = (b.level ?? 0) + 1;
      beep(true);
      toast(`⬆️ ${def.name} → level ${b.level}`);
      refreshHUD();
      scheduleSave();
      openBuildingInfo(id);
    };
  }
}

function openBuildMenu(): void {
  const rows = Object.values(BUILDINGS).map((d) =>
    `<div class="row"><span>${d.name} — ${d.cost}🪙</span><button class="btn small" data-build="${d.id}">Select</button></div>`,
  ).join('');
  openPanel('Build (then tap ground)', rows + `<p>Green = valid. Coins deducted only on valid confirm.</p>`);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-build]').forEach((b) => {
    b.onclick = () => {
      buildDefId = b.dataset.build!;
      tool = 'build';
      syncToolUI();
      updateGhost();
      toast(`Placing ${buildDefId} — tap open ground`);
      panel.classList.add('hidden');
    };
  });
}

// ---------- toolbar / cropbar / drive ----------
function syncToolUI(): void {
  document.querySelectorAll('.tool').forEach((b) => {
    b.classList.toggle('active', (b as HTMLElement).dataset.tool === tool);
  });
  (document.getElementById('cropbar') as HTMLElement).classList.toggle('hidden', tool !== 'plant');
  document.querySelectorAll('.crop-pick').forEach((b) => {
    b.classList.toggle('active', (b as HTMLElement).dataset.crop === selectedCrop);
  });
  joystickEl.classList.toggle('hidden', !(tool === 'drive' && driving));
}
document.querySelectorAll<HTMLButtonElement>('.tool').forEach((btn) => {
  btn.onclick = () => {
    tool = btn.dataset.tool!;
    if (tool === 'drive') {
      if (tractors.length === 0) { toast('Buy a tractor first (🚜 Tractors)', 'error'); beep(false); tool = 'plant'; syncToolUI(); return; }
      if (!selectedTractorUid) selectedTractorUid = tractors[0].uid;
      driving = true;
      renderTractors();
      toast('Drive mode: WASD/arrows or joystick. Tap Drive tool again or Exit to stop.');
    } else {
      driving = false;
    }
    syncToolUI();
    if (tool === 'build') { openBuildMenu(); updateGhost(); }
    else if (ghost) { scene.remove(ghost); ghost = null; }
  };
});
document.querySelectorAll<HTMLButtonElement>('.crop-pick').forEach((btn) => {
  btn.onclick = () => { selectedCrop = btn.dataset.crop as CropId; syncToolUI(); };
});
(document.getElementById('btn-shop') as HTMLButtonElement).onclick = openSeedShop;
(document.getElementById('btn-storage') as HTMLButtonElement).onclick = openStorage;
(document.getElementById('btn-farmshop') as HTMLButtonElement).onclick = openFarmShop;
(document.getElementById('btn-customers') as HTMLButtonElement).onclick = openCustomers;
(document.getElementById('btn-staff') as HTMLButtonElement).onclick = openStaff;
(document.getElementById('btn-land') as HTMLButtonElement).onclick = openLand;
(document.getElementById('btn-goals') as HTMLButtonElement).onclick = openGoals;
(document.getElementById('btn-dealer') as HTMLButtonElement).onclick = openDealership;
(document.getElementById('btn-fin') as HTMLButtonElement).onclick = openLedger;
(document.getElementById('joy-exit') as HTMLButtonElement).onclick = () => {
  driving = false;
  tool = 'plant';
  syncToolUI();
};

// drive input (keyboard + touch joystick hold)
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
const joy = { up: false, down: false, left: false, right: false };
function bindHold(id: string, key: 'up' | 'down' | 'left' | 'right'): void {
  const el = document.getElementById(id) as HTMLButtonElement;
  el.onpointerdown = () => { joy[key] = true; };
  el.onpointerup = () => { joy[key] = false; };
  el.onpointerleave = () => { joy[key] = false; };
}
bindHold('joy-up', 'up');
bindHold('joy-down', 'down');
bindHold('joy-left', 'left');
bindHold('joy-right', 'right');
function driveInput(): { throttle: number; steer: number } {
  let throttle = 0;
  let steer = 0;
  if (keys.has('w') || keys.has('arrowup') || joy.up) throttle += 1;
  if (keys.has('s') || keys.has('arrowdown') || joy.down) throttle -= 1;
  if (keys.has('a') || keys.has('arrowleft') || joy.left) steer -= 1;
  if (keys.has('d') || keys.has('arrowright') || joy.right) steer += 1;
  return { throttle, steer };
}

// ---------- plot actions ----------
async function applyToolToPlot(i: number): Promise<void> {
  const p = plots[i];
  if (tool === 'plant') {
    const seed = inv.takeSeed(selectedCrop);
    if (!seed.ok) { toast(`${seed.reason} — buy seeds first`, 'error'); beep(false); openSeedShop(); return; }
    const r = plant(p, selectedCrop);
    if (!r.ok) { inv.seeds[selectedCrop] += 1; toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
    beep(true);
    showPrompt(`🌱 ${selectedCrop} planted (state: planted — water it!)`);
    if (tutorialStep === 0) tutorialStep = 1;
  } else if (tool === 'cultivate') {
    if (tractors.length === 0) { toast('Needs a tractor — buy one at 🚜 Tractors', 'error'); beep(false); openDealership(); return; }
    const r = till(p);
    if (!r.ok) { toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
    eco.transact(0, `till plot ${i}`);
    beep(true);
    showPrompt(`🚜 plot ${i} cultivated — now plantable`);
  } else if (tool === 'water') {
    const r = water(p);
    if (!r.ok) { toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
    beep(true);
    showPrompt(`💧 watered (${p.water}x) — state: ${p.state} ${Math.round(p.progress * 100)}%`);
    if (tutorialStep === 1 && (p.state === 'growing' || p.state === 'ready')) tutorialStep = 2;
  } else if (tool === 'harvest') {
    const r = harvest(p);
    if (!r.ok) { toast(`${r.reason} (${p.state} ${Math.round(p.progress * 100)}%)`, 'error'); beep(false); return; }
    if (inv.totalProduce() + r.qty! > storageCap(buildings)) {
      toast(`Storage full (${storageCap(buildings)}) — build a barn/warehouse`, 'error');
      beep(false);
      // put the crop back: re-mark ready
      p.state = 'ready';
      p.crop = r.crop!;
      p.progress = 1;
      p.growthTime = CROPS[r.crop!].growTime;
      refreshPlotVisual(i);
      return;
    }
    inv.addProduce(r.crop!, r.qty!);
    eco.transact(0, `harvest ${r.crop}x${r.qty}`);
    stats.harvests += 1;
    awardGoals();
    beep(true);
    toast(`+${r.qty} ${r.crop} harvested`);
    bus.emit({ type: 'crop:harvested', plot: i, crop: r.crop!, qty: r.qty! });
    if (tutorialStep === 2) tutorialStep = 3;
  } else if (tool === 'boost') {
    if (inv.fertilizer <= 0) { toast('No fertilizer — buy some in 🌱 Seeds', 'error'); beep(false); openSeedShop(); return; }
    const r = fertilize(p);
    if (!r.ok) { toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
    inv.fertilizer -= 1;
    eco.transact(0, 'fertilize plot');
    beep(true);
    showPrompt(`✨ fertilized — growing x${Balance.fertilizerBoost}`);
  } else if (tool === 'interact' || tool === 'drive') {
    const tillTxt = p.locked ? '🔒 LOCKED (expand land)' : p.tilled ? 'tilled' : 'UNTILLED (🚜 Till needed)';
    const boostTxt = p.boosted ? ' · ✨ boosted' : '';
    showPrompt(`Plot ${i}: ${p.state}${p.crop ? ` ${p.crop}` : ''} ${Math.round(p.progress * 100)}% 💧x${p.water} · ${tillTxt}${boostTxt}`);
    return;
  } else if (tool === 'build') {
    showPrompt('Build tool: tap open ground, not a plot');
    return;
  }
  refreshPlotVisual(i);
  refreshHUD();
  scheduleSave();
}

async function tryPlaceBuilding(): Promise<void> {
  const def = BUILDINGS[buildDefId];
  const v = validatePlacement(buildDefId, ghostPos.x, ghostPos.z, buildings);
  if (!v.ok) { toast(v.reason ?? 'Invalid placement', 'error'); beep(false); return; }
  if (def.cost >= Balance.confirmThreshold && !(await confirmDialog(`Place ${def.name} for ${def.cost} coins?`))) return;
  const r = eco.transact(-def.cost, `build ${buildDefId}`);
  if (!r.ok) { toast(r.reason ?? 'Blocked', 'error'); beep(false); return; }
  const b: PlacedBuilding = { id: `b${Date.now()}`, defId: buildDefId, x: Math.round(ghostPos.x), z: Math.round(ghostPos.z), rot: 0, level: 0 };
  buildings.push(b);
  renderBuilding(b);
  beep(true);
  toast(`${def.name} placed -${def.cost}🪙`);
  bus.emit({ type: 'building:placed', id: b.id, cost: def.cost });
  if (tutorialStep === 4) tutorialStep = 5;
  refreshHUD();
  scheduleSave();
}

// ---------- picking ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function pick(clientX: number, clientY: number): void {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  // tractor tap -> select (+ enter drive if drive tool)
  const tHits = raycaster.intersectObjects(tractorGroup.children, true);
  if (tHits.length > 0) {
    let uid: string | undefined;
    let o: THREE.Object3D | null = tHits[0].object;
    while (o && !uid) { uid = (o.userData as { tractorUid?: string }).tractorUid ?? tractorMeshByUuid.get(o.uuid); o = o.parent; }
    if (uid) {
      selectedTractorUid = uid;
      renderTractors();
      if (tool === 'drive') { driving = true; syncToolUI(); showPrompt('Driving! WASD / joystick'); }
      else showPrompt('🚜 tractor selected — use Drive tool to drive, Till tool on plots to cultivate');
      refreshHUD();
      scheduleSave();
      return;
    }
  }
  // customer vehicle tap -> open queue panel
  const vHits = raycaster.intersectObjects([...customerMeshes.values()], true);
  if (vHits.length > 0) {
    openCustomers();
    return;
  }
  // building tap (interact tool) -> upgrade info
  if (tool === 'interact') {
    const bHits = raycaster.intersectObjects(buildingGroup.children, true);
    if (bHits.length > 0) {
      let o: THREE.Object3D | null = bHits[0].object;
      let bid: string | undefined;
      while (o && !bid) { bid = (o.userData as { buildingId?: string }).buildingId; o = o.parent; }
      if (bid) { openBuildingInfo(bid); return; }
    }
  }
  // plots
  const hits = raycaster.intersectObjects(plotMeshes, false);
  if (hits.length > 0 && tool !== 'build') {
    const idx = plotMeshByUuid.get(hits[0].object.uuid);
    if (idx !== undefined) { void applyToolToPlot(idx); return; }
  }
  // build mode: move ghost / place
  if (tool === 'build') {
    const pt = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, pt)) {
      ghostPos.set(Math.round(pt.x), 0, Math.round(pt.z));
      const v = validatePlacement(buildDefId, ghostPos.x, ghostPos.z, buildings);
      ghostValid = v.ok;
      if (ghost) {
        ghost.position.copy(ghostPos);
        ghost.traverse((o) => {
          if (o instanceof THREE.Mesh) (o.material as THREE.MeshLambertMaterial).color.set(ghostValid ? 0x4caf50 : 0xe53935);
        });
      } else updateGhost();
      if (hits.length === 0) void tryPlaceBuilding();
      else showPrompt(v.ok ? 'Valid here — tap ground once more to confirm' : (v.reason ?? 'Invalid'));
    }
  }
}
let downAt = 0;
canvas.addEventListener('pointerdown', (e) => { downAt = Date.now(); });
canvas.addEventListener('pointerup', (e) => {
  if (Date.now() - downAt < 400) pick(e.clientX, e.clientY); // tap, not orbit-drag
});
canvas.addEventListener('pointermove', (e) => {
  if (tool !== 'build' || e.pointerType === 'touch') return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const pt = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, pt)) {
    ghostPos.set(Math.round(pt.x), 0, Math.round(pt.z));
    if (ghost) ghost.position.copy(ghostPos);
    else updateGhost();
  }
});

// ---------- menu / pause / settings ----------
const menu = document.getElementById('main-menu') as HTMLElement;
const hud = document.getElementById('hud') as HTMLElement;
const btnContinue = document.getElementById('btn-continue') as HTMLButtonElement;
function hasSave(): boolean {
  try { return localStorage.getItem(SAVE_KEY) !== null; } catch { return false; }
}
function syncMenu(): void {
  btnContinue.disabled = !hasSave();
  btnContinue.textContent = hasSave() ? 'Continue' : 'Continue (no save yet)';
}
syncMenu();
function startGame(fresh: boolean): void {
  if (fresh) {
    eco = new EconomyService(Balance.startCoins);
    inv = new InventoryService({ ...Balance.startSeeds });
    shop = new ShopService();
    plots = createPlots(Balance.plots);
    buildings = [];
    tractors = [];
    selectedTractorUid = null;
    tutorialStep = 0;
    driving = false;
    buildingGroup.clear();
    renderTractors();
    clearCustomers();
    staff = [];
    taskQueue = new TaskQueue();
    paydayTimer = Balance.paydayInterval;
    unpaid = false;
    staffSeq = 0;
    renderStaff();
    stats = emptyStats();
    claimed = [];
    day = 1;
    todayIn = 0;
    todayOut = 0;
    eggTimer = 0;
    dayTimer = 0;
    plots.forEach((_, i) => refreshPlotVisual(i));
  }
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  refreshHUD();
  syncToolUI();
}
(document.getElementById('btn-new') as HTMLButtonElement).onclick = () => {
  if (hasSave() && !window.confirm('Start new game? This overwrites the saved farm.')) return;
  if (hasSave()) clearSave(localStorage);
  startGame(true);
  toast('New farm! Plant a crop 🌱');
};
btnContinue.onclick = () => {
  const data = loadSave(localStorage);
  if (!data) { toast('Save corrupt or missing — starting fresh', 'error'); startGame(true); return; }
  applySave(data);
  startGame(false);
  toast('Welcome back!');
};
(document.getElementById('btn-settings-menu') as HTMLButtonElement).onclick = () => {
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  paused = true;
  (document.getElementById('pause-menu') as HTMLElement).classList.remove('hidden');
};
const pauseMenu = document.getElementById('pause-menu') as HTMLElement;
(document.getElementById('btn-pause') as HTMLButtonElement).onclick = () => { paused = true; pauseMenu.classList.remove('hidden'); };
(document.getElementById('btn-resume') as HTMLButtonElement).onclick = () => { paused = false; pauseMenu.classList.add('hidden'); };
(document.getElementById('btn-reset') as HTMLButtonElement).onclick = () => {
  if (window.confirm('Reset save and restart?')) {
    clearSave(localStorage);
    location.reload();
  }
};
(document.getElementById('set-sens') as HTMLInputElement).oninput = (e) => {
  controls.rotateSpeed = Number((e.target as HTMLInputElement).value);
};
(document.getElementById('set-gfx') as HTMLSelectElement).onchange = (e) => {
  const v = (e.target as HTMLSelectElement).value;
  renderer.setPixelRatio(v === 'low' ? 1 : v === 'med' ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = v !== 'low';
};
(document.getElementById('set-sound') as HTMLInputElement).onchange = (e) => {
  soundOn = (e.target as HTMLInputElement).checked;
};

// ---------- loop: render rAF + 10Hz sim tick (AD-4) + drive ----------
let lastTick = performance.now();
let lastFrame = performance.now();
function animate(now: number): void {
  requestAnimationFrame(animate);
  if (paused || hud.classList.contains('hidden')) return;
  const dtFrame = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  // player tractor drive at frame rate for smoothness
  const t = selectedTractor();
  if (driving && t && tool === 'drive') {
    const { throttle, steer } = driveInput();
    if (throttle !== 0 || steer !== 0) {
      const def = TRACTORS[t.defId];
      const next = driveStep(t, throttle, steer, dtFrame, def.speed, Balance.farmBounds);
      Object.assign(t, next);
      renderTractors();
      if (followCam) controls.target.set(t.x, 1, t.z);
    }
    controls.enabled = throttle === 0 && steer === 0; // orbit when idle, drive when moving
  } else {
    controls.enabled = true;
  }
  customersFrame(dtFrame);
  if (now - lastTick >= 100) {
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    customersTick(dt);
    staffTick(dt);
    farmTick(dt);
    let grown = false;
    for (let i = 0; i < plots.length; i++) {
      const before = plots[i].state;
      tickPlot(plots[i], dt);
      if (plots[i].state !== before) { refreshPlotVisual(i); grown = true; }
    }
    if (grown) refreshHUD();
  }
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
refreshHUD();
syncToolUI();
