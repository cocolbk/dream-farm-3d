import * as THREE from 'three';
import { box, mat } from './materials';
import { Palette } from '../core/Config';
import { ROUTE } from '../customers/customers';

// Phase 3 — fixed roads, parking bays, drive-through lane, service hut.
// Vehicles follow ROUTE waypoints; these meshes visualize the same geometry.
export function buildRoads(scene: THREE.Scene): void {
  const roadM = mat(0x4a4a52);
  const lineM = mat(0xf5f5f5);

  function strip(x1: number, z1: number, x2: number, z2: number, w: number): void {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, len), roadM);
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = -Math.atan2(z2 - z1, x2 - x1) + Math.PI / 2;
    road.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
    road.receiveShadow = true;
    scene.add(road);
  }

  // entry + exit roads
  strip(ROUTE.entrance.x, ROUTE.entrance.z, ROUTE.junctionIn.x, ROUTE.junctionIn.z, 3.5);
  strip(ROUTE.junctionIn.x, ROUTE.junctionIn.z, ROUTE.approach.x, ROUTE.approach.z, 3.5);
  strip(ROUTE.approach.x, ROUTE.approach.z, ROUTE.junctionOut.x, ROUTE.junctionOut.z, 3.5);
  strip(ROUTE.junctionOut.x, ROUTE.junctionOut.z, ROUTE.exit.x, ROUTE.exit.z, 3.5);

  // parking row
  const park = new THREE.Mesh(new THREE.PlaneGeometry(8, 22), roadM);
  park.rotation.x = -Math.PI / 2;
  park.position.set(20, 0.02, 1.5);
  park.receiveShadow = true;
  scene.add(park);
  // bay dividers + P sign
  for (let i = 0; i <= 4; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.25), lineM);
    line.rotation.x = -Math.PI / 2;
    line.position.set(20, 0.03, -8.5 + i * 5);
    scene.add(line);
  }
  const sign = box(0.3, 2.2, 0.3, Palette.wood);
  sign.position.set(16, 1.1, -9);
  scene.add(sign);
  const board = box(1.6, 1, 0.15, 0x2b6cb0);
  board.position.set(16, 2.4, -9);
  scene.add(board);

  // drive-through lane
  strip(4, -16, 4, 4, 3.2);
  for (const q of ROUTE.queue) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.7, 20), lineM);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(q.x, 0.03, q.z);
    scene.add(ring);
  }
  // service hut at front of queue
  const hut = box(3, 2.2, 2.5, Palette.cream);
  hut.position.set(0.5, 1.1, 3.5);
  scene.add(hut);
  const roof = box(3.6, 0.3, 3, Palette.barnRed);
  roof.position.set(0.5, 2.4, 3.5);
  scene.add(roof);
}
