import * as THREE from 'three';
import './styles.css';
import { buildWorld } from './world/scene';
import { createCameraRig } from './world/cameraRig';
import { Balance } from './core/Config';
import { toast } from './ui/hud';

// Phase 0 boot: menu -> diorama -> HUD shell. No gameplay yet (Phase 1).
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const { controls } = createCameraRig(canvas);
const { interactables } = buildWorld(scene);

// Selection / interaction prompt (raycast shell for Phase 1)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const prompt = document.getElementById('prompt') as HTMLElement;
let paused = false;

function onTap(clientX: number, clientY: number): void {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(
    pointer,
    (controls as unknown as { object: THREE.Camera }).object as THREE.Camera,
  );
  const hits = raycaster.intersectObjects(interactables, false);
  if (hits.length > 0) {
    const obj = hits[0].object;
    const name = obj.name || 'object';
    prompt.textContent = `🔍 ${name} — gameplay arrives in Phase 1`;
    prompt.classList.remove('hidden');
    window.setTimeout(() => prompt.classList.add('hidden'), 2000);
  }
}
canvas.addEventListener('click', (e) => onTap(e.clientX, e.clientY));
canvas.addEventListener('touchend', (e) => {
  if (e.changedTouches.length > 0) {
    const t = e.changedTouches[0];
    onTap(t.clientX, t.clientY);
  }
}, { passive: true });

// Menu wiring
const menu = document.getElementById('main-menu') as HTMLElement;
const hud = document.getElementById('hud') as HTMLElement;
const coinsEl = document.getElementById('coins') as HTMLElement;
coinsEl.textContent = `🪙 ${Balance.startCoins}`;
(document.getElementById('btn-new') as HTMLButtonElement).onclick = () => {
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  toast('Welcome to Dream Farm! (Phase 0 shell)');
};
(document.getElementById('btn-settings') as HTMLButtonElement).onclick = () =>
  toast('Settings arrive in Phase 1');
(document.getElementById('btn-continue') as HTMLButtonElement).onclick = () =>
  toast('No save yet — Phase 1 adds saving');

// Toolbar (select tool highlight only in Phase 0)
document.querySelectorAll<HTMLButtonElement>('.tool').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('.tool').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    toast(`Tool: ${btn.dataset.tool} (functional in Phase 1)`);
  };
});

// Pause
const pauseMenu = document.getElementById('pause-menu') as HTMLElement;
(document.getElementById('btn-pause') as HTMLButtonElement).onclick = () => {
  paused = true;
  pauseMenu.classList.remove('hidden');
};
(document.getElementById('btn-resume') as HTMLButtonElement).onclick = () => {
  paused = false;
  pauseMenu.classList.add('hidden');
};
(document.getElementById('btn-reset') as HTMLButtonElement).onclick = () => {
  if (window.confirm('Reset save? (Phase 0: nothing stored yet)')) toast('Save reset');
};

// Loop: render at rAF, sim tick stub at 10Hz (AD-4)
let lastTick = 0;
function animate(time: number): void {
  requestAnimationFrame(animate);
  if (!paused) {
    controls.update();
    if (time - lastTick > 100) lastTick = time; // sim tick hook for Phase 1+
    renderer.render(scene, (controls as unknown as { object: THREE.Camera }).object as THREE.Camera);
  }
}
requestAnimationFrame(animate);
