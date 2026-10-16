import * as THREE from 'three';
import { box, cone, cyl, mat, std, ground } from './materials';
import { Palette } from '../core/Config';

// Diorama: textured terrain + detailed farmhouse + 12 plots + layered trees.
// 1 unit = 1m. Plots 3x3m. All geometry procedural — no external assets.
export function buildWorld(scene: THREE.Scene): { interactables: THREE.Object3D[] } {
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 60, 140);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5da93c, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.7);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbcd6ff, 0.35);
  fill.position.set(-18, 12, -14);
  scene.add(fill);

  // Ground with procedural grass
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), ground.grass);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  groundMesh.name = 'ground';
  scene.add(groundMesh);

  // Dirt path: entrance -> farmhouse -> plots
  const path = new THREE.Mesh(new THREE.PlaneGeometry(4, 60), ground.path);
  path.rotation.x = -Math.PI / 2;
  path.position.set(8, 0.01, 0);
  path.receiveShadow = true;
  scene.add(path);

  // Farmhouse: foundation, siding walls, windows, porch, chimney
  const house = new THREE.Group();
  house.name = 'farmhouse';
  const foundation = box(6.4, 0.6, 5.4, 0x8d8d94);
  foundation.position.y = 0.3;
  house.add(foundation);
  const base = box(6, 2.8, 5, Palette.cream);
  base.position.y = 2.0;
  house.add(base);
  // siding lines
  for (let y = 1.1; y < 3.3; y += 0.45) {
    const strip = box(6.02, 0.05, 5.02, 0xe8dcc2);
    strip.position.y = y;
    strip.castShadow = false;
    house.add(strip);
  }
  const roof = cone(4.8, 2.1, Palette.roof, 4);
  roof.position.y = 4.4;
  roof.rotation.y = Math.PI / 4;
  (roof.material as THREE.Material) = ground.roof;
  house.add(roof);
  const eaves = box(7.0, 0.18, 6.0, 0x6b4030);
  eaves.position.y = 3.42;
  house.add(eaves);
  // windows front + side
  for (const [wx, wz, ry] of [[-1.8, 2.53, 0], [1.8, 2.53, 0], [3.03, 0, Math.PI / 2]] as Array<[number, number, number]>) {
    const frame = box(1.1, 1.1, 0.12, Palette.cream);
    frame.position.set(wx, 2.1, wz);
    frame.rotation.y = ry;
    house.add(frame);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.14), std(0xbfd9e8, 0.15, 0.4));
    glass.position.set(wx, 2.1, wz);
    glass.rotation.y = ry;
    house.add(glass);
    const muntV = box(0.07, 0.9, 0.15, Palette.cream);
    muntV.position.set(wx, 2.1, wz);
    muntV.rotation.y = ry;
    house.add(muntV);
  }
  const door = box(1.2, 2.1, 0.14, Palette.wood);
  door.position.set(0, 1.55, 2.55);
  house.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std(0xd9a441, 0.3, 0.7));
  knob.position.set(0.4, 1.55, 2.65);
  house.add(knob);
  // porch
  const porch = box(3.2, 0.25, 1.6, Palette.wood);
  porch.position.set(0, 0.55, 3.4);
  house.add(porch);
  for (const sx of [-1.4, 1.4]) {
    const post = cyl(0.09, 0.09, 2.2, Palette.wood, 8);
    post.position.set(sx, 1.7, 4.0);
    house.add(post);
  }
  const porchRoof = box(3.6, 0.15, 1.9, Palette.roof);
  porchRoof.position.set(0, 2.85, 3.4);
  porchRoof.rotation.x = 0.12;
  house.add(porchRoof);
  // chimney
  const stack = box(0.7, 2.2, 0.7, 0x9a5a4a);
  stack.position.set(1.8, 4.6, -1.2);
  house.add(stack);
  const cap = box(1.0, 0.2, 1.0, 0x5a5a60);
  cap.position.set(1.8, 5.75, -1.2);
  house.add(cap);
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

  // Trees: trunk with roots + two-tier foliage + apples on some
  const treePositions: Array<[number, number]> = [
    [-20, 10], [-22, -2], [18, -14], [20, 8], [-5, 18], [5, -20], [-25, -15], [22, 18], [0, 14], [-18, 18],
  ];
  treePositions.forEach(([x, z], ti) => {
    const t = new THREE.Group();
    const trunk = cyl(0.28, 0.42, 1.6, Palette.wood);
    trunk.position.y = 0.8;
    (trunk.material as THREE.Material) = ground.wood;
    t.add(trunk);
    for (const sx of [-0.5, 0.5]) {
      const root = cyl(0.08, 0.12, 0.9, Palette.wood, 5);
      root.position.set(sx, 0.3, 0.2);
      root.rotation.z = sx * 0.9;
      t.add(root);
    }
    const lower = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), mat(ti % 2 ? Palette.grassDark : 0x4e9b41));
    lower.position.y = 2.4;
    lower.scale.y = 0.85;
    lower.castShadow = true;
    t.add(lower);
    const upper = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), mat(ti % 2 ? 0x4e9b41 : Palette.grassDark));
    upper.position.y = 3.5;
    upper.castShadow = true;
    t.add(upper);
    if (ti % 3 === 0) {
      for (let i = 0; i < 4; i++) {
        const apple = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), std(Palette.tomato, 0.4));
        const a = (i / 4) * Math.PI * 2;
        apple.position.set(Math.cos(a) * 1.2, 2.2 + (i % 2) * 0.5, Math.sin(a) * 1.2);
        t.add(apple);
      }
    }
    t.position.set(x, 0, z);
    t.rotation.y = ti * 0.7;
    scene.add(t);
  });

  house.traverse((o) => interactables.push(o));
  return { interactables };
}
