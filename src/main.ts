import * as THREE from 'three';
import './styles.css';
import { buildWorld } from './world/scene';
import { createCameraRig } from './world/cameraRig';
import { buildCropMesh, buildBuildingMesh } from './world/factories';
import { mat } from './world/materials';
import { Balance, CROPS, BUILDINGS, Palette, type CropId } from './core/Config';
import { bus } from './core/EventBus';
import { EconomyService } from './economy/economy';
import { InventoryService } from './inventory/inventory';
import { createPlots, plant, water, tickPlot, harvest, type Plot } from './farming/farming';
import { validatePlacement, type PlacedBuilding } from './buildings/placement';
import { defaultSave, loadSave, writeSave, clearSave, SAVE_KEY } from './save/save';
import { toast, confirmDialog } from './ui/hud';

// ---------- state ----------
let coins = Balance.startCoins;
let eco = new EconomyService(coins);
let inv = new InventoryService({ ...Balance.startSeeds });
let plots: Plot[] = createPlots(Balance.plots);
let buildings: PlacedBuilding[] = [];
let tutorialStep = 0;
let tool: string = 'plant';
let selectedCrop: CropId = 'maize';
let buildDefId = 'barn';
let paused = false;
let soundOn = true;
let saveTimer: number | undefined;

const OBJECTIVES = [
  'Objective 1/5: 🌱 Plant a crop (select Plant, tap a plot)',
  'Objective 2/5: 💧 Water the crop',
  'Objective 3/5: 🧺 Harvest when ready (ready = full plant + READY label)',
  'Objective 4/5: 💰 Sell produce in Storage panel',
  'Objective 5/5: 🏠 Place a building (Build tool → pick → tap ground → confirm)',
  'All done! Farm freely 🎉',
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
  // soil color: tilled vs growing
  const mesh = plotMeshes[i];
  const occupied = plots[i].state !== 'empty';
  (mesh.material as THREE.MeshLambertMaterial) = mat(occupied ? Palette.soilDry : Palette.grassDark);
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
function refreshHUD(): void {
  coinsEl.textContent = `🪙 ${eco.balance}`;
  seedsQuick.textContent = `🌽${inv.seeds.maize} 🥕${inv.seeds.carrot} 🍅${inv.seeds.tomato} | 🧺${inv.produce.maize + inv.produce.carrot + inv.produce.tomato}`;
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
    version: 1, coins: eco.balance, seeds: { ...inv.seeds }, produce: { ...inv.produce },
    plots, buildings, tutorialStep, timestamp: Date.now(),
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
  tutorialStep = data.tutorialStep;
  buildingGroup.clear();
  buildings.forEach(renderBuilding);
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
    return `<div class="row"><span>${c.name}: ${inv.produce[id]} @ ${c.sellBase}🪙</span><button class="btn small" data-sell="${id}">Sell 1</button></div>`;
  }).join('');
  openPanel('Farm Storage (direct sell @ base price)', rows + `<div class="row"><button class="btn small" id="sell-all">Sell ALL produce</button></div>`);
  panelBody.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((b) => {
    b.onclick = () => sellProduce(b.dataset.sell as CropId, 1);
  });
  (panelBody.querySelector('#sell-all') as HTMLButtonElement).onclick = () => {
    (Object.keys(CROPS) as CropId[]).forEach((id) => {
      if (inv.produce[id] > 0) sellProduce(id, inv.produce[id]);
    });
  };
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
function openLedger(): void {
  const rows = eco.ledger.slice(-15).reverse().map((l) =>
    `<div class="row"><span>${l.reason}</span><span>${l.delta >= 0 ? '+' : ''}${l.delta} → ${l.balance}</span></div>`,
  ).join('') || '<p>No transactions yet.</p>';
  openPanel('Finances', `<div class="row"><strong>Balance: 🪙 ${eco.balance}</strong></div>` + rows);
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

// ---------- toolbar / cropbar ----------
function syncToolUI(): void {
  document.querySelectorAll('.tool').forEach((b) => {
    b.classList.toggle('active', (b as HTMLElement).dataset.tool === tool);
  });
  (document.getElementById('cropbar') as HTMLElement).classList.toggle('hidden', tool !== 'plant');
  document.querySelectorAll('.crop-pick').forEach((b) => {
    b.classList.toggle('active', (b as HTMLElement).dataset.crop === selectedCrop);
  });
}
document.querySelectorAll<HTMLButtonElement>('.tool').forEach((btn) => {
  btn.onclick = () => {
    tool = btn.dataset.tool!;
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
(document.getElementById('btn-fin') as HTMLButtonElement).onclick = openLedger;

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
    eco.transact(0, `harvest ${r.crop}x${r.qty}`); // ledger touchpoint (no coins) for traceability
    beep(true);
    toast(`+${r.qty} ${r.crop} harvested`);
    bus.emit({ type: 'crop:harvested', plot: i, crop: r.crop!, qty: r.qty! });
    if (tutorialStep === 2) tutorialStep = 3;
  } else if (tool === 'interact') {
    showPrompt(`Plot ${i}: ${p.state}${p.crop ? ` ${p.crop}` : ''} ${Math.round(p.progress * 100)}% 💧x${p.water}`);
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
  // plots first
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
      // second tap near same spot places (simple: tap places immediately if valid spot away from plots)
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
// ghost follows hover on desktop
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
    plots = createPlots(Balance.plots);
    buildings = [];
    tutorialStep = 0;
    buildingGroup.clear();
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
  scene.traverse((o) => { if (o instanceof THREE.Light) o.visible = true; });
};
(document.getElementById('set-sound') as HTMLInputElement).onchange = (e) => {
  soundOn = (e.target as HTMLInputElement).checked;
};

// ---------- loop: render rAF + 10Hz sim tick (AD-4) ----------
let lastTick = performance.now();
let lastFrame = performance.now();
function animate(now: number): void {
  requestAnimationFrame(animate);
  if (paused || hud.classList.contains('hidden')) return;
  const dtFrame = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  void dtFrame;
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
