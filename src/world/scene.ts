import * as THREE from 'three';
import { box, cone, cyl, mat } from './materials';
import { Palette } from '../core/Config';

// Phase 0 diorama: terrain + farmhouse + 6 plots + trees + paths.
// 1 unit = 1m. Plots 3x3m. All primitives, shared materials.
export function buildWorld(scene: THREE.Scene): { interactables: THREE.Object3D[] } {
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 60, 140);

  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x5da93c, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff6e9, 1.6);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);

  // Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat(Palette.grass));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  // Dirt path: entrance -> farmhouse -> plots
  const path = new THREE.Mesh(new THREE.PlaneGeometry(4, 60), mat(Palette.path));
  path.rotation.x = -Math.PI / 2;
  path.position.set(8, 0.01, 0);
  path.receiveShadow = true;
  scene.add(path);

  // Farmhouse (starter, boxes)
  const house = new THREE.Group();
  house.name = 'farmhouse';
  const base = box(6, 3, 5, Palette.cream);
  base.position.y = 1.5;
  house.add(base);
  const roof = cone(4.6, 2, Palette.roof, 4);
  roof.position.y = 4;
  roof.rotation.y = Math.PI / 4;
  house.add(roof);
  const door = box(1.2, 2, 0.1, Palette.wood);
  door.position.set(0, 1, 2.55);
  house.add(door);
  house.position.set(-10, 0, -10);
  scene.add(house);

  // 12 crop plots: 0-5 open (2 pre-tilled), 6-8 East field, 9-11 North field (locked)
  const interactables: THREE.Object3D[] = [];
  const plotPos = (i: number): [number, number] => {
    if (i < 6) return [-12 + (i % 3) * 4, 2 + Math.floor(i / 3) * 4];
    if (i < 9) return [-12 + ((i - 6) % 3) * 4, 12];
    return [-12 + ((i - 9) % 3) * 4, 17];
  };
  for (let i = 0; i < 12; i++) {
    const [x, z] = plotPos(i);
    const plot = box(3, 0.3, 3, Palette.grassDark);
    plot.position.set(x, 0.15, z);
    plot.name = `plot-${i}`;
    plot.userData = { type: 'plot', index: i };
    scene.add(plot);
    interactables.push(plot);
  }

  // Trees (instanced-style reuse, ~10)
  const treePositions: Array<[number, number]> = [
    [-20, 10], [-22, -2], [18, -14], [20, 8], [-5, 18], [5, -20], [-25, -15], [22, 18], [0, 14], [-18, 18],
  ];
  for (const [x, z] of treePositions) {
    const t = new THREE.Group();
    const trunk = cyl(0.3, 0.4, 1.5, Palette.wood);
    trunk.position.y = 0.75;
    t.add(trunk);
    const leaves = cone(1.6, 2.6, Palette.grassDark);
    leaves.position.y = 2.6;
    t.add(leaves);
    t.position.set(x, 0, z);
    scene.add(t);
  }

  house.traverse((o) => interactables.push(o));
  return { interactables };
}
