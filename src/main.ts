import * as THREE from 'three';
import './styles.css';
import { buildWorld } from './world/scene';
import { createCameraRig } from './world/cameraRig';
import { buildCropMesh, buildBuildingMesh, buildTractorMesh } from './world/factories';
import { mat } from './world/materials';
import { Balance, CROPS, BUILDINGS, TRACTORS, Palette, type CropId } from './core/Config';
import { bus } from './core/EventBus';
import { EconomyService } from './economy/economy';
import { InventoryService } from './inventory/inventory';
import { createPlots, plant, water, tickPlot, harvest, till, type Plot } from './farming/farming';
import { validatePlacement, type PlacedBuilding } from './buildings/placement';
import { ShopService } from './shop/shop';
import { canBuyTractor, createTractor, driveStep, type TractorInstance } from './vehicles/tractor';
import { defaultSave, loadSave, writeSave, clearSave, SAVE_KEY, SAVE_VERSION } from './save/save';
import { toast, confirmDialog } from './ui/hud';

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
    occupied ? Palette.soilDry : plots[i].tilled ? Palette.soilTilled : Palette.grassDark,
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
  seedsQuick.textContent = `🌽${inv.seeds.maize} 🥕${inv.seeds.carrot} 🍅${inv.seeds.tomato} | 🧺${inv.produce.maize + inv.produce.carrot + inv.produce.tomato} | 🏪${shop.stock.maize + shop.stock.tomato + shop.stock.carrot} | 🚜${tractors.length}`;
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
  if (e.type === 'coins:changed' || e.type === 'crop:harvested' || e.type === 'sale:completed' || e.type === 'building:placed') {
    refreshHUD();
    scheduleSave();
  }
  if (e.type === 'toast') toast(e.msg);
});

// ---------- save ----------
function collectSave() {
  return {
    version: SAVE_VERSION, coins: eco.balance, seeds: { ...inv.seeds }, produce: { ...inv.produce },
    plots, buildings, tractors, selectedTractorUid,
    shopStock: { ...shop.stock }, prices: { ...shop.prices },
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
  shop = new ShopService();
  shop.stock = { ...data.shopStock };
  shop.prices = { ...data.prices };
  tutorialStep = data.tutorialStep;
  buildingGroup.clear();
  buildings.forEach(renderBuilding);
  renderTractors();
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
  openPanel('Seed Shop', rows + `<div class="row"><span>Balance: 🪙 ${eco.balance}</span></div>`);
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
    return `<div class="row"><span>🚜 ${d.name}<br><small>${d.capability} · speed ${d.speed} · owned ${owned}</small></span><span><strong>${d.price}🪙</strong> <button class="btn small" data-buy-t="${d.id}">Buy</button></span></div>`;
  }).join('');
  const list = tractors.map((t) =>
    `<div class="row"><span>🚜 ${TRACTORS[t.defId].name} @(${Math.round(t.x)},${Math.round(t.z)})${t.uid === selectedTractorUid ? ' ✓' : ''}</span><button class="btn small" data-sel="${t.uid}">Select</button></div>`,
  ).join('') || '<p>No tractors yet — buy one to till new plots.</p>';
  openPanel('Tractor Dealership', rows + `<h4>Garage</h4>` + list);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-buy-t]').forEach((b) => {
    b.onclick = async () => {
      const defId = b.dataset.buyT!;
      const def = TRACTORS[defId];
      const chk = canBuyTractor(defId, eco.balance, tractors);
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
function categoryOf(reason: string): string {
  if (reason.startsWith('sale') || reason.startsWith('shop sale')) return 'Sales';
  if (reason.startsWith('seed')) return 'Seeds';
  if (reason.startsWith('build')) return 'Building';
  if (reason.startsWith('tractor')) return 'Machinery';
  if (reason.startsWith('harvest')) return 'Harvest';
  return 'Other';
}
function openLedger(): void {
  const totals = new Map<string, number>();
  for (const l of eco.ledger) totals.set(categoryOf(l.reason), (totals.get(categoryOf(l.reason)) ?? 0) + l.delta);
  const sum = [...totals.entries()].map(([k, v]) => `<div class="row"><span>${k}</span><span>${v >= 0 ? '+' : ''}${v}</span></div>`).join('') || '<p>No transactions yet.</p>';
  const rows = eco.ledger.slice(-15).reverse().map((l) =>
    `<div class="row"><span>${l.reason}</span><span>${l.delta >= 0 ? '+' : ''}${l.delta} → ${l.balance}</span></div>`,
  ).join('');
  openPanel('Finances', `<div class="row"><strong>Balance: 🪙 ${eco.balance}</strong></div><h4>By category</h4>` + sum + `<h4>Recent</h4>` + rows);
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
    inv.addProduce(r.crop!, r.qty!);
    eco.transact(0, `harvest ${r.crop}x${r.qty}`);
    beep(true);
    toast(`+${r.qty} ${r.crop} harvested`);
    bus.emit({ type: 'crop:harvested', plot: i, crop: r.crop!, qty: r.qty! });
    if (tutorialStep === 2) tutorialStep = 3;
  } else if (tool === 'interact' || tool === 'drive') {
    const tillTxt = p.tilled ? 'tilled' : 'UNTILLED (🚜 Till needed)';
    showPrompt(`Plot ${i}: ${p.state}${p.crop ? ` ${p.crop}` : ''} ${Math.round(p.progress * 100)}% 💧x${p.water} · ${tillTxt}`);
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
  const b: PlacedBuilding = { id: `b${Date.now()}`, defId: buildDefId, x: Math.round(ghostPos.x), z: Math.round(ghostPos.z), rot: 0 };
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
  // drive at frame rate for smoothness
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
  if (now - lastTick >= 100) {
    const dt = (now - lastTick) / 1000;
    lastTick = now;
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
