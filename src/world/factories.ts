import * as THREE from 'three';
import { box, cone, cyl, mat } from './materials';
import { Palette, BUILDINGS } from '../core/Config';
import type { Plot } from '../farming/farming';

// Crop visuals: sprout -> bush -> full + colored produce dots.
// Icon + scale convey state (never color-only); plot ring shows progress in main.ts via scale.
export function buildCropMesh(plot: Plot): THREE.Group {
  const g = new THREE.Group();
  if (plot.state === 'empty' || !plot.crop) return g;
  const stage = plot.state === 'planted' ? 0 : plot.state === 'growing' ? 1 : 2;
  const h = [0.4, 0.9, 1.4][stage];
  // stalk
  const stalk = cyl(0.08, 0.12, h, Palette.stalk);
  stalk.position.y = h / 2;
  g.add(stalk);
  if (plot.crop === 'maize') {
    const cob = cyl(0.16, 0.16, 0.5, Palette.maize);
    cob.position.y = h * 0.7;
    g.add(cob);
  } else if (plot.crop === 'tomato') {
    for (let i = 0; i < 2 + stage; i++) {
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(Palette.tomato));
      t.position.set((i % 2 ? 0.25 : -0.25), h * (0.5 + i * 0.18), 0);
      t.castShadow = true;
      g.add(t);
    }
  } else if (plot.crop === 'carrot') {
    // carrot: leaves above, orange cone below soil line hint
    for (let i = 0; i < 3; i++) {
      const leaf = cone(0.12, 0.5, Palette.leaf, 5);
      leaf.position.set((i - 1) * 0.2, h + 0.15, 0);
      g.add(leaf);
    }
    if (stage === 2) {
      const root = cone(0.16, 0.4, Palette.carrot, 6);
      root.position.y = 0.25;
      root.rotation.x = Math.PI;
      g.add(root);
    }
  } else if (plot.crop === 'wheat') {
    for (let i = 0; i < 3 + stage; i++) {
      const s = cyl(0.05, 0.07, h * (0.8 + i * 0.1), Palette.maize);
      s.position.set((i - 2) * 0.18, h * (0.4 + i * 0.05), 0);
      g.add(s);
    }
  } else if (plot.crop === 'pumpkin') {
    for (let i = 0; i < 2; i++) {
      const leaf = cone(0.14, 0.5, Palette.leaf, 5);
      leaf.position.set((i ? 0.3 : -0.3), h * 0.8, 0);
      g.add(leaf);
    }
    if (stage >= 1) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.22 + stage * 0.12, 10, 8), mat(Palette.carrot));
      p.position.y = 0.3;
      p.castShadow = true;
      g.add(p);
    }
  }
  return g;
}

export function buildBuildingMesh(defId: string): THREE.Group {
  const g = new THREE.Group();
  const def = BUILDINGS[defId];
  if (defId === 'barn') {
    const base = box(def.size[0], 2.5, def.size[1], Palette.barnRed);
    base.position.y = 1.25;
    g.add(base);
    const roof = cone(Math.max(def.size[0], def.size[1]) * 0.75, 1.6, Palette.roof, 4);
    roof.position.y = 3.2;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
  } else if (defId === 'shop') {
    const base = box(def.size[0], 2.6, def.size[1], Palette.cream);
    base.position.y = 1.3;
    g.add(base);
    const awning = box(def.size[0] + 0.6, 0.25, 1.4, Palette.barnRed);
    awning.position.set(0, 2.2, def.size[1] / 2 + 0.5);
    g.add(awning);
    const sign = box(2.4, 0.7, 0.15, Palette.wood);
    sign.position.set(0, 3, def.size[1] / 2);
    g.add(sign);
  } else if (defId === 'fence') {
    const p1 = box(0.18, 1, 0.18, Palette.wood);
    p1.position.set(-0.4, 0.5, 0);
    g.add(p1);
    const p2 = box(0.18, 1, 0.18, Palette.wood);
    p2.position.set(0.4, 0.5, 0);
    g.add(p2);
    const rail = box(1, 0.14, 0.1, Palette.wood);
    rail.position.y = 0.75;
    g.add(rail);
  } else if (defId === 'warehouse') {
    const base = box(def.size[0], 3, def.size[1], Palette.wood);
    base.position.y = 1.5;
    g.add(base);
    const roof = box(def.size[0] + 0.6, 0.3, def.size[1] + 0.6, Palette.roof);
    roof.position.y = 3.1;
    g.add(roof);
    const door = box(1.6, 2, 0.15, Palette.roof);
    door.position.set(0, 1, def.size[1] / 2);
    g.add(door);
  } else if (defId === 'quarters') {
    const base = box(def.size[0], 2.4, def.size[1], Palette.cream);
    base.position.y = 1.2;
    g.add(base);
    const roof = cone(Math.max(def.size[0], def.size[1]) * 0.7, 1.4, Palette.barnRed, 4);
    roof.position.y = 3;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
  } else if (defId === 'coop') {
    const base = box(def.size[0], 1.4, def.size[1], Palette.barnRed);
    base.position.y = 0.7;
    g.add(base);
    const roof = cone(3, 1.2, Palette.roof, 4);
    roof.position.y = 2;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), mat(Palette.cream));
    egg.position.set(1.2, 0.25, 1.2);
    g.add(egg);
  } else if (defId === 'garage') {
    const back = box(def.size[0], 2.6, 0.3, Palette.wood);
    back.position.set(0, 1.3, -def.size[1] / 2);
    g.add(back);
    for (const sx of [-1, 1]) {
      const wall = box(0.3, 2.6, def.size[1], Palette.wood);
      wall.position.set(sx * def.size[0] / 2, 1.3, 0);
      g.add(wall);
    }
    const roof = box(def.size[0] + 0.4, 0.3, def.size[1] + 0.4, Palette.roof);
    roof.position.y = 2.75;
    g.add(roof);
  } else {
    // path: flat slab
    const slab = box(def.size[0], 0.12, def.size[1], Palette.path);
    slab.position.y = 0.06;
    slab.castShadow = false;
    g.add(slab);
  }
  return g;
}

export function buildTractorMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = box(1.6, 0.9, 2.6, Palette.barnRed);
  body.position.y = 0.9;
  g.add(body);
  const cabin = box(1.3, 1.1, 1.2, Palette.cream);
  cabin.position.set(0, 1.9, -0.5);
  g.add(cabin);
  const wheelG = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12);
  wheelG.rotateZ(Math.PI / 2);
  const wheelM = mat(0x333333);
  const wheels: Array<[number, number, number]> = [[-0.9, 0.45, 0.9], [0.9, 0.45, 0.9], [-0.9, 0.55, -0.9], [0.9, 0.55, -0.9]];
  for (const [x, y, z] of wheels) {
    const w = new THREE.Mesh(wheelG, wheelM);
    w.position.set(x, y, z);
    w.castShadow = true;
    g.add(w);
  }
  // cultivator bar at back (visual cue for cultivate action)
  const bar = box(2.0, 0.15, 0.3, Palette.wood);
  bar.position.set(0, 0.4, -1.6);
  g.add(bar);
  return g;
}

export type CustomerVehicleKind = 'car' | 'van' | 'pickup';
// Low-poly customer vehicles: body + cabin + wheels. Kind changes size/color.
export function buildCustomerVehicleMesh(kind: CustomerVehicleKind): THREE.Group {
  const colors = { car: 0x5b8dd9, van: 0x66bb6a, pickup: 0xef9e3a } as const;
  const sizes = { car: [1.6, 0.7, 3.0], van: [1.8, 1.1, 3.6], pickup: [1.7, 0.8, 3.4] } as const;
  const [w, h, l] = sizes[kind];
  const g = new THREE.Group();
  const body = box(w, h, l, colors[kind]);
  body.position.y = 0.55 + h / 2;
  g.add(body);
  const cabin = box(w * 0.85, 0.6, l * 0.4, Palette.cream);
  cabin.position.set(0, 0.55 + h + 0.3, -l * 0.05);
  g.add(cabin);
  const wheelG = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 10);
  wheelG.rotateZ(Math.PI / 2);
  const wheelM = mat(0x2b2b2b);
  for (const [x, z] of [[-w / 2, l / 3], [w / 2, l / 3], [-w / 2, -l / 3], [w / 2, -l / 3]] as Array<[number, number]>) {
    const wh = new THREE.Mesh(wheelG, wheelM);
    wh.position.set(x, 0.35, z);
    wh.castShadow = true;
    g.add(wh);
  }
  return g;
}

// Low-poly staffer: role-colored body + head. One mesh per roster member at a fixed post.
export function buildStaffMesh(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = cyl(0.32, 0.4, 1.1, color);
  body.position.y = 0.55;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(0xf1c27d));
  head.position.y = 1.35;
  head.castShadow = true;
  g.add(head);
  const hat = cyl(0.3, 0.3, 0.14, Palette.wood);
  hat.position.y = 1.6;
  g.add(hat);
  return g;
}
